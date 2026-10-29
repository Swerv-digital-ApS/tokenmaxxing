import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { once } from "hanzio";
import { type GithubProblem, type TokenEvent, tokenEvent } from "../types.ts";

/** A GUI app starts with a bare PATH, so look where installers put `gh`. */
const GH_PATHS = [
  "/opt/homebrew/bin/gh",
  "/usr/local/bin/gh",
  "/opt/local/bin/gh",
  join(homedir(), ".local", "bin", "gh"),
  join(homedir(), ".nix-profile", "bin", "gh"),
  "/run/current-system/sw/bin/gh",
];

/** Not `/usr/bin/git`: on a Mac without the developer tools it opens an install dialog. */
const GIT_PATHS = [
  "/opt/homebrew/bin/git",
  "/usr/local/bin/git",
  "/Library/Developer/CommandLineTools/usr/bin/git",
  "/Applications/Xcode.app/Contents/Developer/usr/bin/git",
];

/** GitHub search returns at most this many results per query, 100 a page. */
const SEARCH_CAP = 1000;
const PER_PAGE = 100;

/** A signed-in GitHub account whose PRs we count. `host` is github.com or an Enterprise server. */
export interface GithubAccount {
  host: string;
  login: string;
  token: string;
}

/** Runs `gh`; `ok` is a zero exit. */
export type GhRunner = (args: string[]) => Promise<{ ok: boolean; out: string }>;

let shellGh: string | null | undefined;

/** `gh` on the usual paths, else wherever the user's interactive shell finds it (mise, asdf, …). */
function ghPath(): string | null {
  const found = GH_PATHS.find((p) => existsSync(p)) ?? Bun.which("gh");
  if (found) return found;
  // ponytail: asked once per run, so a `gh` installed off the usual paths needs an app restart.
  shellGh ??= (() => {
    try {
      const r = Bun.spawnSync([process.env.SHELL || "/bin/zsh", "-ilc", "command -v gh"], {
        stdin: "ignore",
        stderr: "ignore",
        timeout: 5000,
      });
      const path = r.stdout.toString().trim().split("\n").at(-1) ?? "";
      return path.startsWith("/") && existsSync(path) ? path : null;
    } catch {
      return null;
    }
  })();
  return shellGh;
}

function ghRunner(gh: string): GhRunner {
  return async (args) => {
    const p = Bun.spawn([gh, ...args], {
      stdout: "pipe",
      stderr: "ignore",
      env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1" },
    });
    const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
    return { ok: code === 0, out };
  };
}

/** Every account `gh` is signed in to, on every host, with its token. */
async function ghAccounts(gh: GhRunner): Promise<GithubAccount[]> {
  // Exits 1 when any one account has a problem, so read what it printed regardless.
  const status = await gh(["auth", "status", "--json", "hosts"]);
  let hosts: Record<string, { state?: string; login?: string }[]> = {};
  try {
    hosts = (JSON.parse(status.out) as { hosts?: typeof hosts }).hosts ?? {};
  } catch {
    // gh before 2.61 has no --json: its default account only.
    const r = await gh(["auth", "token"]);
    const token = r.out.trim();
    return r.ok && token ? [{ host: "github.com", login: "", token }] : [];
  }

  const accounts: GithubAccount[] = [];
  for (const [host, list] of Object.entries(hosts)) {
    for (const a of list) {
      if (a.state !== "success" || !a.login) continue;
      const r = await gh(["auth", "token", "--hostname", host, "--user", a.login]);
      const token = r.out.trim();
      if (r.ok && token) accounts.push({ host, login: a.login, token });
    }
  }
  return accounts;
}

/**
 * The github.com login git saved for HTTPS pushes (Keychain, Git Credential Manager), for people
 * without `gh`. Never prompts: no terminal, no browser.
 */
const gitAccount = once(async (): Promise<GithubAccount | null> => {
  // ponytail: once per run, so a credential helper that does show a dialog shows it at most once.
  const git =
    GIT_PATHS.find((p) => existsSync(p)) ?? (process.platform === "darwin" ? null : Bun.which("git"));
  if (!git) return null;
  try {
    const p = Bun.spawn([git, "credential", "fill"], {
      stdin: new Blob(["protocol=https\nhost=github.com\n\n"]),
      stdout: "pipe",
      stderr: "ignore",
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
        GIT_ASKPASS: "",
        SSH_ASKPASS: "",
      },
    });
    const timer = setTimeout(() => p.kill(), 10_000);
    const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
    clearTimeout(timer);
    if (code !== 0) return null;

    // `key=value` lines; a password may itself contain `=`.
    const fields: Record<string, string> = {};
    for (const line of out.split("\n")) {
      const at = line.indexOf("=");
      if (at > 0) fields[line.slice(0, at)] = line.slice(at + 1);
    }
    if (!fields.password) return null;
    return { host: "github.com", login: fields.username ?? "", token: fields.password };
  } catch {
    // No git, or a helper that crashed: there's no saved login to use.
    return null;
  }
});

/** `gh`'s accounts, else git's saved github.com login, else why there's neither. */
export async function githubAccounts(
  gh: GhRunner | null,
  git: () => Promise<GithubAccount | null> = gitAccount,
): Promise<GithubAccount[] | GithubProblem> {
  const accounts = gh ? await ghAccounts(gh) : [];
  if (accounts.length) return accounts;
  const saved = await git();
  if (saved) return [saved];
  return gh ? "signed_out" : "no_gh";
}

/**
 * PRs the account created at or after `since` (ISO time; null = all time), as zero-token `pr`
 * events. Only a hash of the PR URL leaves the Mac, so repo names stay private; the server dedups
 * on it. `since` comes back as the newest `createdAt` seen, for the next run, also when a rate limit
 * cut the search short. A rejected token comes back `rejected`, keeping `since`.
 */
export async function fetchPullRequests(
  account: GithubAccount,
  since: string | null,
  fetchImpl: typeof fetch = fetch,
  log?: (msg: string) => void,
): Promise<{ events: TokenEvent[]; since: string | null; rejected?: true }> {
  const api = account.host === "github.com" ? "https://api.github.com" : `https://${account.host}/api/v3`;
  const headers = {
    authorization: `Bearer ${account.token}`,
    accept: "application/vnd.github+json",
    "user-agent": "tokenmaxxing",
  };
  const events: TokenEvent[] = [];
  for (;;) {
    let got = 0;
    let last = since;
    for (let n = 1; n <= SEARCH_CAP / PER_PAGE; n++) {
      const params = new URLSearchParams({
        q: since ? `is:pr author:@me created:>=${since}` : "is:pr author:@me",
        sort: "created",
        order: "asc",
        per_page: String(PER_PAGE),
        page: String(n),
      });
      const res = await fetchImpl(`${api}/search/issues?${params}`, { headers });

      if (res.status === 401) {
        log?.(`${account.host} rejected the token for ${account.login || "git's saved login"}`);
        return { events, since, rejected: true };
      }
      // Search allows 30 queries a minute: a long history stops here and resumes from `last`.
      if ((res.status === 403 || res.status === 429) && last) {
        log?.(`${account.host} search rate limit; continuing next time from ${last}`);
        return { events, since: last };
      }
      if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);

      // Organizations with SAML SSO hide their PRs until the token is authorized for them.
      const sso = res.headers.get("x-github-sso");
      if (sso && n === 1) log?.(`PRs hidden until the token is authorized for SSO (${sso})`);
      const body = (await res.json()) as { items?: { html_url: string; created_at: string }[] };
      const page = body.items ?? [];
      got += page.length;
      for (const pr of page) {
        const timestamp = Date.parse(pr.created_at);
        if (!Number.isFinite(timestamp)) continue;
        last = pr.created_at;
        events.push(
          tokenEvent({
            source: "github",
            sessionId: "github",
            messageId: createHash("sha256").update(pr.html_url).digest("hex"),
            timestamp,
            messageType: "pr",
          }),
        );
      }
      if (page.length < PER_PAGE) break;
    }
    // A full 1000 means more remain: search on from the newest one. `>=` re-reads it, which the
    // dedup drops; if it didn't advance, stop rather than loop.
    if (got < SEARCH_CAP || last === since) return { events, since: last };
    since = last;
  }
}

/** The installed `gh`'s accounts, else git's saved login. */
export function localGithubAccounts(): Promise<GithubAccount[] | GithubProblem> {
  const gh = ghPath();
  return githubAccounts(gh ? ghRunner(gh) : null);
}
