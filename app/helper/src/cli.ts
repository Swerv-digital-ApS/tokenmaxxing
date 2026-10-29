import "./quiet.ts";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { compact } from "@tokenmaxxing/core/format.ts";
import type { Message } from "@tokenmaxxing/core/protocol.ts";
import { getErrorMessage } from "hanzio";
import pkg from "../../../package.json" with { type: "json" };
import { APP_STATE_FILE, appStateDir, clientFor, errorCode, Helper } from "./helper.ts";
import {
  configHome,
  installService,
  logsCommand,
  runCommand,
  serviceRunning,
  uninstallService,
} from "./service.ts";

/**
 * `tokenmaxxing`: sync a second computer's usage into your account (ARCHITECTURE.md, "Linked computers"). The app on your
 * main Mac makes a link code; `link` trades it for this computer's own token, which can only sync.
 */

const HELP = `tokenmaxxing ${pkg.version}: adds this computer's AI agent tokens to your Tokenmaxxing account.

  tokenmaxxing link <code>   Link this computer (get a code in the app: Link a computer…)
      --name <name>          What to call it (default: its hostname)
      --server <url>         The server (the install script sets it)
      --no-service           Don't install the background service
  tokenmaxxing status        Which account, the service, today's tokens
  tokenmaxxing sync          Send new usage now
  tokenmaxxing logs          Follow the background service's log
  tokenmaxxing unlink        Remove this computer from your account
  tokenmaxxing run           Sync every 2 minutes, until stopped (what the service runs)
`;

interface Config {
  server: string;
  userId: number;
  token: string;
  deviceId: number;
  name: string;
}

/** Exits with `message` on stderr. */
class Fail extends Error {}

const configDir = (): string =>
  process.env.TOKENMAXXING_CLI_DIR ||
  (process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "Tokenmaxxing CLI")
    : join(configHome(), "tokenmaxxing"));

const configPath = () => join(configDir(), "config.json");
const statePath = () => join(configDir(), "state.json");

/** The desktop app's sync state: if it's there, the app already sends this Mac's usage. */
const appStatePath = () => join(appStateDir(), APP_STATE_FILE);

async function loadConfig(): Promise<Config | null> {
  try {
    return JSON.parse(await readFile(configPath(), "utf8")) as Config;
  } catch {
    return null;
  }
}

async function requireConfig(): Promise<Config> {
  const c = await loadConfig();
  if (!c) throw new Fail("This computer isn't linked. Run: tokenmaxxing link <code>");
  return c;
}

/** Only this user can read the token. */
async function saveConfig(c: Config): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  await writeFile(configPath(), `${JSON.stringify(c, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath(), 0o600);
}

// The state file first: a helper signing out removes it at the same moment, and Bun's recursive rm
// quietly leaves the rest of the directory behind when a file vanishes under it.
const forget = async () => {
  await rm(statePath(), { force: true });
  await rm(configDir(), { recursive: true, force: true });
};

/** A server error's message for people, or a plain one for the network. */
function reason(err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message;
  return errorCode(err) !== null && typeof message === "string"
    ? message
    : "Can't reach the server. Check the connection and try again.";
}

/** My name and tokens today, as a linked computer may read them. */
async function today(c: Config): Promise<{ name: string; tokens: number } | null> {
  try {
    const t = await clientFor(c.server)
      .town.getOrCreate(["main"], { params: { token: c.token } })
      .today();
    return { name: t.top.find((r) => r.isMe)?.name ?? "?", tokens: t.me.tokensToday };
  } catch {
    return null;
  }
}

/** A helper for this computer's token; `onRevoked` runs when the server rejects it. */
function helperFor(onRevoked: () => void): Helper {
  return new Helper({
    statePath: statePath(),
    write: (m: Message) => {
      if ("event" in m && m.event === "token" && m.token === null) onRevoked();
    },
    log: (m) => console.error(`${new Date().toISOString()} ${m}`),
  });
}

async function link(code: string | undefined, opts: { name?: string; server?: string; service: boolean }) {
  const userId = /^(\d{1,12})\./.exec(code ?? "")?.[1];
  if (!code || !userId)
    throw new Fail("Usage: tokenmaxxing link <code>. Get a code in the app: Link a computer…");
  const server = opts.server ?? process.env.TOKENMAXXING_SERVER_URL;
  if (!server) throw new Fail("Which server? Pass --server <url>, or use the install command from the app.");
  const existing = await loadConfig();
  if (existing) throw new Fail(`Already linked as "${existing.name}". Run tokenmaxxing unlink first.`);
  if (existsSync(appStatePath()))
    throw new Fail("The Tokenmaxxing app already sends this computer's usage, so there's nothing to link.");

  const name = (opts.name ?? hostname().replace(/\.local$/, "")).trim();
  const linked = await clientFor(server)
    .player.get([userId])
    .redeemLinkCode(code, name, process.platform)
    .catch((err) => {
      throw new Fail(reason(err));
    });
  const config: Config = {
    server,
    userId: Number(userId),
    token: linked.token,
    deviceId: linked.deviceId,
    name,
  };
  await saveConfig(config);

  console.log(`Linked as "${name}". Sending this computer's history (the first time can take a minute)…`);
  await syncOnce(config);
  const me = await today(config);
  console.log(`Linked to @${me?.name ?? "you"}: ${compact(me?.tokens ?? 0)} tokens today.`);

  if (!opts.service) return console.log("Run `tokenmaxxing run` to keep syncing.");
  const s = await installService();
  if (s.ok) {
    console.log("Syncing in the background every 2 minutes, also after a restart.");
    if (s.note) console.log(s.note);
  } else {
    console.log(`Couldn't set up the background service (${s.why}). Keep it running with:`);
    console.log(
      `  nohup ${runCommand()
        .map((w) => JSON.stringify(w))
        .join(" ")} >> ~/tokenmaxxing.log 2>&1 &`,
    );
  }
}

/** One sync and my numbers after it, then stops. */
async function syncOnce(c: Config): Promise<void> {
  let revoked = false;
  const helper = helperFor(() => {
    revoked = true;
  });
  await helper.handle({ id: 1, cmd: "init", token: c.token, serverUrl: c.server });
  await helper.tick();
  helper.stop();
  if (revoked) {
    await forget();
    throw new Fail("This computer was removed from your account. Link it again with a new code.");
  }
}

async function run(): Promise<void> {
  const c = await requireConfig();
  console.error(`${new Date().toISOString()} tokenmaxxing ${pkg.version}: syncing "${c.name}"`);
  const helper = helperFor(() => {
    // Removed in the game (or unlinked elsewhere): clean up and stop for good. A clean exit is one
    // the service manager doesn't restart.
    console.error(`${new Date().toISOString()} removed from the account; stopping`);
    helper.stop();
    void forget()
      .then(() => uninstallService(false))
      .finally(() => process.exit(0));
  });
  // Syncs now, then every 2 minutes (10 seconds in a battle) on the helper's own timer.
  await helper.handle({ id: 1, cmd: "init", token: c.token, serverUrl: c.server });
  const stop = () => {
    helper.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await new Promise(() => {});
}

async function status(): Promise<void> {
  const c = await requireConfig();
  const [me, running, synced] = await Promise.all([
    today(c),
    serviceRunning(),
    stat(statePath()).then(
      (s) => s.mtime,
      () => null,
    ),
  ]);
  console.log(`Computer:  ${c.name}`);
  console.log(`Account:   ${me ? `@${me.name}` : "(can't reach the server)"}`);
  console.log(`Server:    ${c.server}`);
  if (me) console.log(`Today:     ${compact(me.tokens)} tokens (all your computers)`);
  console.log(`Last sync: ${synced ? synced.toLocaleString() : "never"}`);
  console.log(
    `Service:   ${running === null ? "none (run tokenmaxxing run)" : running ? "running" : "stopped"}`,
  );
}

async function unlink(): Promise<void> {
  const c = await requireConfig();
  const removed = await clientFor(c.server)
    .player.get([String(c.userId)], { params: { token: c.token } })
    .revokeDevice(c.deviceId)
    .then(
      () => true,
      (err) => (err as { code?: unknown }).code === "unauthorized",
    );
  await uninstallService();
  await forget();
  console.log(
    removed
      ? `Unlinked "${c.name}". Its tokens so far stay on your account.`
      : `Removed "${c.name}" here, but couldn't reach the server: remove it in the game too.`,
  );
}

async function logs(): Promise<void> {
  const cmd = logsCommand();
  if (!cmd) throw new Fail("There's no service log on this system.");
  await Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] }).exited;
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: "string" },
      server: { type: "string" },
      "no-service": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  const [cmd, arg] = positionals;
  if (values.version) return console.log(pkg.version);
  if (values.help || !cmd) return console.log(HELP);
  switch (cmd) {
    case "link":
      return link(arg, {
        ...(values.name !== undefined ? { name: values.name } : {}),
        ...(values.server !== undefined ? { server: values.server } : {}),
        service: !values["no-service"],
      });
    case "run":
      return run();
    case "sync": {
      const c = await requireConfig();
      await syncOnce(c);
      const me = await today(c);
      return console.log(me ? `Synced. ${compact(me.tokens)} tokens today.` : "Couldn't reach the server.");
    }
    case "status":
      return status();
    case "unlink":
      return unlink();
    case "logs":
      return logs();
    default:
      throw new Fail(`Unknown command: ${cmd}\n\n${HELP}`);
  }
}

try {
  await main(process.argv.slice(2));
  process.exit(0);
} catch (err) {
  console.error(getErrorMessage(err));
  process.exit(1);
}
