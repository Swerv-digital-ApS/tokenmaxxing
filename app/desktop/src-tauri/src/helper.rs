//! Runs the sync helper (the TypeScript in app/helper, compiled with Bun and bundled as a sidecar) and
//! speaks its newline-delimited JSON protocol (core/src/protocol.ts). A command with an id gets one
//! reply; `state` and `token` events arrive on their own. If the helper dies it is restarted, with
//! backoff, and re-sent `init`.

use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// What the helper reports: onboarding until there's an account, then my numbers for the menu bar.
#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
pub struct State {
    pub phase: String,
    pub today: Option<Today>,
    pub battle: Option<Battle>,
    /// Why this Mac can't count my PRs: "no_gh" or "signed_out".
    pub github: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Today {
    pub tokens: f64,
    pub rank: Option<u32>,
    pub level: u32,
    /// Most tokens first.
    pub sources: Vec<SourceTokens>,
    pub prs: u32,
}

/// My tokens today from one source ("claude_code", "codex", …).
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SourceTokens {
    pub source: String,
    pub tokens: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Battle {
    pub name: String,
    pub place: Option<u32>,
    pub players: u32,
    pub tokens: f64,
    pub ends_at: f64,
    pub until: f64,
}

/// One line from the helper.
#[derive(Debug, PartialEq)]
pub enum Message {
    Reply {
        id: u64,
        result: Result<Value, String>,
    },
    State(State),
    /// A new device token to keep, or None: it was rejected, forget it.
    Token(Option<String>),
}

pub fn parse(line: &str) -> Option<Message> {
    #[derive(Deserialize)]
    struct Raw {
        id: Option<u64>,
        ok: Option<bool>,
        result: Option<Value>,
        error: Option<String>,
        event: Option<String>,
        state: Option<State>,
        token: Option<String>,
    }
    let raw: Raw = serde_json::from_str(line).ok()?;
    match raw.event.as_deref() {
        Some("state") => Some(Message::State(raw.state?)),
        Some("token") => Some(Message::Token(raw.token)),
        Some(_) => None,
        None => Some(Message::Reply {
            id: raw.id?,
            result: if raw.ok == Some(true) {
                Ok(raw.result.unwrap_or(Value::Null))
            } else {
                Err(raw.error.unwrap_or_else(|| "internal".into()))
            },
        }),
    }
}

type Reply = Result<Value, String>;

pub struct Helper {
    inner: Mutex<Inner>,
    on_event: Box<dyn Fn(Message) + Send + Sync>,
    /// The `init` command, built fresh on every start (the token may have changed).
    init: Box<dyn Fn() -> Value + Send + Sync>,
}

#[derive(Default)]
struct Inner {
    stdin: Option<ChildStdin>,
    child: Option<Child>,
    next_id: u64,
    pending: HashMap<u64, Sender<Reply>>,
    stopping: bool,
}

/// Failed calls read like the helper's own errors, so the UI maps them the same way.
const UNAVAILABLE: &str = "helper_unavailable";

impl Helper {
    pub fn start(
        on_event: impl Fn(Message) + Send + Sync + 'static,
        init: impl Fn() -> Value + Send + Sync + 'static,
    ) -> Arc<Helper> {
        let helper = Arc::new(Helper {
            inner: Mutex::default(),
            on_event: Box::new(on_event),
            init: Box::new(init),
        });
        let supervisor = helper.clone();
        std::thread::spawn(move || supervisor.supervise());
        helper
    }

    /// Sends a command and waits for its reply. It blocks, so call it off the main thread.
    pub fn call(&self, cmd: Value) -> Reply {
        let (tx, rx) = channel();
        self.send(cmd, Some(tx))?;
        rx.recv_timeout(Duration::from_secs(60))
            .unwrap_or_else(|_| Err(UNAVAILABLE.into()))
    }

    pub fn stop(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.stopping = true;
        inner.stdin = None;
        if let Some(child) = inner.child.as_mut() {
            let _ = child.kill();
        }
    }

    fn send(&self, mut cmd: Value, reply: Option<Sender<Reply>>) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        inner.next_id += 1;
        let id = inner.next_id;
        cmd["id"] = json!(id);
        let mut line = cmd.to_string();
        line.push('\n');
        let sent = match inner.stdin.as_mut() {
            Some(stdin) => stdin
                .write_all(line.as_bytes())
                .and_then(|_| stdin.flush())
                .is_ok(),
            None => false,
        };
        if !sent {
            return Err(UNAVAILABLE.into());
        }
        if let Some(tx) = reply {
            inner.pending.insert(id, tx);
        }
        Ok(())
    }

    /// Starts the helper, reads it until it exits, and starts it again: after 1 s, doubling to a minute
    /// while it keeps dying, and back to 1 s once it has run for a while.
    fn supervise(self: Arc<Self>) {
        let mut delay = Duration::from_secs(1);
        loop {
            if self.inner.lock().unwrap().stopping {
                return;
            }
            match spawn() {
                Ok(mut child) => {
                    let stdout = child.stdout.take().expect("piped stdout");
                    {
                        let mut inner = self.inner.lock().unwrap();
                        inner.stdin = child.stdin.take();
                        inner.child = Some(child);
                    }
                    if let Err(e) = self.send((self.init)(), None) {
                        log::error!("could not send init to the helper: {e}");
                    }
                    let started = Instant::now();
                    for line in BufReader::new(stdout).lines() {
                        let Ok(line) = line else { break };
                        match parse(&line) {
                            Some(Message::Reply { id, result }) => {
                                if let Some(tx) = self.inner.lock().unwrap().pending.remove(&id) {
                                    let _ = tx.send(result);
                                }
                            }
                            Some(event) => (self.on_event)(event),
                            None => log::warn!("unreadable helper line: {line}"),
                        }
                    }
                    let mut inner = self.inner.lock().unwrap();
                    inner.stdin = None;
                    if let Some(mut child) = inner.child.take() {
                        let _ = child.wait();
                    }
                    for (_, tx) in inner.pending.drain() {
                        let _ = tx.send(Err(UNAVAILABLE.into()));
                    }
                    if inner.stopping {
                        return;
                    }
                    if started.elapsed() > Duration::from_secs(60) {
                        delay = Duration::from_secs(1);
                    }
                    log::error!("the helper exited; restarting in {delay:?}");
                }
                Err(e) => log::error!("could not start the helper: {e}"),
            }
            std::thread::sleep(delay);
            delay = (delay * 2).min(Duration::from_secs(60));
        }
    }
}

fn spawn() -> std::io::Result<Child> {
    let mut cmd = command();
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(log_file());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // The background helper must not open a console on every launch or restart.
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
}

/// Dev builds run the helper from source, with its own state dir, so they never move the installed
/// app's read positions. Restart the app to pick up TypeScript changes.
#[cfg(debug_assertions)]
fn command() -> Command {
    let home = dirs::home_dir().expect("the home directory");
    let bun = home
        .join(".bun/bin")
        .join(format!("bun{}", std::env::consts::EXE_SUFFIX));
    let mut cmd = Command::new(if bun.exists() {
        bun.as_os_str()
    } else {
        std::ffi::OsStr::new("bun")
    });
    cmd.arg(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../helper/src/main.ts"
    ))
    .env(
        "TOKENMAXXING_STATE_DIR",
        dirs::data_local_dir()
            .expect("the data directory")
            .join("Tokenmaxxing Dev"),
    );
    cmd
}

/// The compiled helper sits next to the app's own binary (Tauri puts sidecars in Contents/MacOS).
#[cfg(not(debug_assertions))]
fn command() -> Command {
    let exe = std::env::current_exe().expect("the app's own path");
    Command::new(exe.with_file_name(format!(
        "tokenmaxxing-helper{}",
        std::env::consts::EXE_SUFFIX
    )))
}

/// The helper's stderr, in ~/Library/Logs/Tokenmaxxing/helper.log.
/// ponytail: truncated at 5 MB on start, not rotated; add rotation if it's ever needed.
fn log_file() -> Stdio {
    #[cfg(target_os = "macos")]
    let dir = dirs::home_dir().map(|home| home.join("Library/Logs/Tokenmaxxing"));
    #[cfg(not(target_os = "macos"))]
    let dir = dirs::data_local_dir().map(|data| data.join("Tokenmaxxing/logs"));
    let Some(dir) = dir else {
        return Stdio::null();
    };
    let path = dir.join("helper.log");
    let _ = std::fs::create_dir_all(&dir);
    if std::fs::metadata(&path)
        .map(|m| m.len() > 5_000_000)
        .unwrap_or(false)
    {
        let _ = std::fs::remove_file(&path);
    }
    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map(Stdio::from)
        .unwrap_or_else(|_| Stdio::null())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The fixture app/helper/test/protocol.test.ts writes from the TypeScript types: a shape change
    /// on either side fails here.
    #[test]
    fn decodes_every_helper_message() {
        let fixture = include_str!("../tests/fixtures/messages.ndjson");
        let messages: Vec<Message> = fixture.lines().map(|l| parse(l).expect(l)).collect();
        assert_eq!(messages.len(), 8);
        let Message::State(ready) = &messages[0] else {
            panic!("{:?}", messages[0])
        };
        assert_eq!(ready.phase, "ready");
        assert_eq!(
            ready.today,
            Some(Today {
                tokens: 306_000_000.0,
                rank: Some(2),
                level: 5,
                sources: vec![
                    SourceTokens {
                        source: "claude_code".into(),
                        tokens: 250_000_000.0
                    },
                    SourceTokens {
                        source: "codex".into(),
                        tokens: 56_000_000.0
                    },
                ],
                prs: 3,
            })
        );
        let battle = ready.battle.as_ref().unwrap();
        assert_eq!(
            (battle.name.as_str(), battle.place, battle.players),
            ("Tokenmaxxing", Some(2), 4)
        );
        assert_eq!(battle.until - battle.ends_at, 180_000.0);
        assert_eq!(
            messages[1],
            Message::State(State {
                phase: "onboarding".into(),
                today: None,
                battle: None,
                github: Some("signed_out".into())
            })
        );
        assert_eq!(messages[2], Message::Token(Some("12.tok_abc".into())));
        assert_eq!(messages[3], Message::Token(None));
        assert_eq!(
            messages[4],
            Message::Reply {
                id: 1,
                result: Ok(Value::Null)
            }
        );
        assert_eq!(
            messages[5],
            Message::Reply {
                id: 2,
                result: Ok(json!({ "code": "12.x" }))
            }
        );
        assert_eq!(
            messages[6],
            Message::Reply {
                id: 3,
                result: Err("name_taken".into())
            }
        );
        // `linkComputer`: world.rs hands `command` to the game page.
        let Message::Reply {
            result: Ok(link), ..
        } = &messages[7]
        else {
            panic!("{:?}", messages[7])
        };
        assert_eq!(
            link["command"].as_str(),
            Some("curl -fsSL https://x/install.sh | sh -s -- link 12.y")
        );
    }
}
