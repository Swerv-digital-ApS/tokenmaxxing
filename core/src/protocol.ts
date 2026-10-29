/**
 * Desktop app ↔ helper protocol: newline-delimited JSON over the helper's
 * stdin/stdout. The Rust side mirrors these shapes in `app/desktop/src-tauri/src/helper.rs`;
 * the contract test (app/helper/test/protocol.test.ts) writes a fixture the Rust
 * test decodes, so drift fails CI on both sides.
 */
import type { GithubProblem, Source } from "./types.ts";

export type Command =
  | {
      id: number;
      cmd: "init";
      /** From the Keychain; sent over stdin so it never shows up in `ps`. */
      token: string | null;
      serverUrl: string;
    }
  | { id: number; cmd: "signUp"; name: string }
  /** Sync now (sent when the Mac wakes). */
  | { id: number; cmd: "syncNow" }
  /** Replies with `{ code }`: a single-use login code the game window trades for a session. */
  | { id: number; cmd: "openWorld" }
  /** Replies with a `LinkComputer`: how to add another computer's usage to this account. */
  | { id: number; cmd: "linkComputer" };

export type Message =
  | { id: number; ok: true; result: unknown }
  /** Stable codes: name_taken, invalid_name, rate_limited, offline, unauthorized, … */
  | { id: number; ok: false; error: string }
  | { event: "state"; state: AppState }
  /** After signUp → save to Keychain. `null` → the token was rejected; delete it. */
  | { event: "token"; token: string | null };

/** A single-use link code (10 minutes) and the line that installs the CLI with it on another computer. */
export interface LinkComputer {
  code: string;
  command: string;
}

/** A Tokenmaxxing battle I'm in. The app syncs fast until `until`. */
export interface Battle {
  name: string;
  /** Null before anyone has burned a token. */
  place: number | null;
  players: number;
  tokens: number;
  endsAt: number;
  until: number;
}

/** My tokens today from one source, as the server has them. */
interface SourceTokens {
  source: Source;
  tokens: number;
}

/** My tokens today per source (most first) and PRs opened today, as the server has them. */
export interface TodayBySource {
  sources: SourceTokens[];
  prs: number;
}

/** What the desktop app shows: sign-up until there's an account, then my count in the menu bar. */
export interface AppState {
  phase: "starting" | "onboarding" | "ready";
  /** My numbers today, after the first sync. */
  today: ({ tokens: number; rank: number | null; level: number } & TodayBySource) | null;
  battle: Battle | null;
  /** Why this Mac can't count my PRs, if it can't. */
  github: GithubProblem | null;
}
