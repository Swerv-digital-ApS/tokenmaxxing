import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AppState, Command, LinkComputer, Message } from "@tokenmaxxing/core/protocol.ts";
import type { CollectOptions } from "@tokenmaxxing/core/sync/collect.ts";
import { emptyState, loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import type { SyncState, TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { registry } from "@tokenmaxxing/server/registry";
import { trimTrailingSlash, typedSwitch } from "hanzio";
import { createClient } from "rivetkit/client";

/** Often enough that your character sits down at the desk soon after your agents start. */
const SYNC_INTERVAL_MS = 2 * 60_000;
/** During a Tokenmaxxing battle, so the scoreboard moves while you burn. */
const BATTLE_SYNC_MS = 10_000;

/** Where the desktop app keeps its sync state, unless `TOKENMAXXING_STATE_DIR` says (`main.ts`). */
export function appStateDir(platform = process.platform, env = process.env, home = homedir()): string {
  if (platform === "darwin") return join(home, "Library", "Application Support", "Tokenmaxxing");
  if (platform === "win32") return join(env.LOCALAPPDATA || join(home, "AppData", "Local"), "Tokenmaxxing");
  return join(env.XDG_DATA_HOME || join(home, ".local", "share"), "Tokenmaxxing");
}
/** v2: the world started from a fresh server, so every Mac re-reads its full history into it. */
export const APP_STATE_FILE = "state.v2.json";

interface HelperOptions {
  statePath: string;
  write: (msg: Message) => void;
  log?: (msg: string) => void;
  /** Where GitHub PRs come from; defaults to `gh`'s accounts, null skips them (tests). */
  githubAccounts?: CollectOptions["githubAccounts"];
}

/** A failed call with a stable code the shell can map to a message. */
class ApiError extends Error {}

type Client = ReturnType<typeof createClient<typeof registry>>;

/** An actor error's code, for people; null for anything without one, which is the network. */
export function errorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && code !== "internal_error" ? code : null;
}

const apiError = (err: unknown): ApiError => new ApiError(errorCode(err) ?? "offline");

/**
 * A client for the server at `serverUrl`. No metadata lookup: our server is the endpoint, and the
 * lookup retries forever when offline.
 */
export const clientFor = (serverUrl: string): Client =>
  createClient<typeof registry>({
    endpoint: `${trimTrailingSlash(serverUrl)}/api/rivet`,
    devtools: false,
    disableMetadataLookup: true,
  });

/**
 * The menu bar app's engine: sign up once, then send new local usage in the
 * background (every 2 minutes, every 10 seconds during a battle), and mint
 * login codes for the game window.
 */
export class Helper {
  private client: Client | null = null;
  private serverUrl = "";
  private token: string | null = null;
  private syncState: SyncState | null = null;
  private syncing: Promise<void> | null = null;
  private ticking: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private every = 0;
  readonly state: AppState;

  constructor(private readonly opts: HelperOptions) {
    this.state = { phase: "starting", today: null, battle: null, github: null };
  }

  /** Handles one command and always replies, so the shell can await every call. */
  async handle(cmd: Command): Promise<void> {
    try {
      const result = await this.run(cmd);
      this.opts.write({ id: cmd.id, ok: true, result: result ?? null });
    } catch (err) {
      const error = err instanceof ApiError ? err.message : "internal";
      if (!(err instanceof ApiError)) this.log(`command ${cmd.cmd} failed: ${String(err)}`);
      this.opts.write({ id: cmd.id, ok: false, error });
    }
    this.emit();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async run(cmd: Command): Promise<unknown> {
    return typedSwitch(cmd, "cmd", {
      init: async (cmd) => {
        this.serverUrl = trimTrailingSlash(cmd.serverUrl);
        this.client = clientFor(this.serverUrl);
        this.syncState = await loadState(this.opts.statePath);
        if (cmd.token) await this.signIn(cmd.token);
        else this.state.phase = "onboarding";
      },
      signUp: async (cmd) => {
        const r = await this.call(() => this.api().town.getOrCreate(["main"]).signUp(cmd.name));
        this.opts.write({ event: "token", token: r.token });
        await this.signIn(r.token);
      },
      syncNow: () => {
        // History imports can outlive the shell command timeout. Acknowledge the start now;
        // tick refreshes the UI when the shared background run finishes.
        void this.tick().catch((err) => this.log(`sync now failed: ${String(err)}`));
      },
      openWorld: async () => ({ code: await this.call(() => this.player().mintLoginCode()) }),
      linkComputer: async (): Promise<LinkComputer> => {
        const code = await this.call(() => this.player().mintLinkCode());
        const command = `curl -fsSL ${this.serverUrl}/install.sh | sh -s -- link ${code}`;
        return { code, command };
      },
    });
  }

  private api(): Client {
    if (!this.client) throw new ApiError("not_ready");
    return this.client;
  }

  private params() {
    if (!this.token) throw new ApiError("signed_out");
    return { params: { token: this.token } };
  }

  private player() {
    return this.api().player.get([this.token?.split(".")[0] ?? "0"], this.params());
  }

  /** Checks the token (a rejected one goes back to onboarding), then syncs in the background. */
  private async signIn(token: string): Promise<void> {
    this.token = token;
    this.state.phase = "ready";
    await this.refresh();
    void this.tick();
  }

  /** Syncs every `ms` (fast during a battle), restarting the timer only when that changes. */
  private cadence(ms: number): void {
    if (this.timer && this.every === ms) return;
    if (this.timer) clearInterval(this.timer);
    this.every = ms;
    this.timer = setInterval(() => void this.tick(), ms);
  }

  /** Periodic work: send new local usage, then show where that leaves me. */
  tick(): Promise<void> {
    this.ticking ??= (async () => {
      try {
        await this.syncOnce();
        await this.refresh();
      } finally {
        this.ticking = null;
      }
    })();
    return this.ticking;
  }

  /**
   * My count today and the battle I'm in, for the menu bar. In a battle, sync fast so its scoreboard
   * moves. Offline, the last numbers stay up.
   */
  async refresh(): Promise<void> {
    if (!this.token) return;
    try {
      const [today, battle] = await this.call(() =>
        Promise.all([
          this.api().town.getOrCreate(["main"], this.params()).today(),
          this.api().arcade.getOrCreate(["main"], this.params()).battle(),
        ]),
      );
      // After `town` has checked the token: a rejected one's player may not exist, and that error
      // would hide the `unauthorized` that signs out.
      const mine = await this.call(() => this.player().todayBySource());
      this.state.today = {
        tokens: today.me.tokensToday,
        rank: today.me.rank,
        level: today.me.level,
        ...mine,
      };
      this.state.battle = battle;
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    if (this.token) this.cadence(this.state.battle ? BATTLE_SYNC_MS : SYNC_INTERVAL_MS);
    this.emit();
  }

  /** Forgets the account and the sync offsets: the next account starts from a clean slate. */
  private signOut(): void {
    this.stop();
    this.token = null;
    this.syncState = emptyState();
    void rm(this.opts.statePath, { force: true });
    Object.assign(this.state, { phase: "onboarding", today: null, battle: null, github: null });
  }

  /** Parse new local events and send them; one run at a time. */
  syncOnce(): Promise<void> {
    if (!this.token || !this.syncState) return Promise.resolve();
    this.syncing ??= (async () => {
      try {
        const r = await sync(this.syncState!, {
          statePath: this.opts.statePath,
          send: (events) => this.send(events),
          onError: (err, where) => this.log(`${where}: ${String(err)}`),
          ...(this.opts.githubAccounts !== undefined ? { githubAccounts: this.opts.githubAccounts } : {}),
        });
        this.syncState = r.state;
        this.state.github = r.state.github?.problem ?? null;
      } catch (err) {
        // Offsets up to the last acked batch are already saved; the next run picks up there.
        this.syncState = await loadState(this.opts.statePath);
        this.log(`sync failed: ${String(err)}`);
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  private send(events: TokenEvent[]) {
    return this.call(() => this.player().ingest(events));
  }

  /** Network failures become `offline`; a rejected token signs out and tells the shell to forget it. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const e = err instanceof ApiError ? err : apiError(err);
      if (e.message === "unauthorized" && this.token) {
        this.signOut();
        this.opts.write({ event: "token", token: null });
        this.emit();
      }
      throw e;
    }
  }

  private emit(): void {
    this.opts.write({ event: "state", state: structuredClone(this.state) });
  }

  private log(msg: string): void {
    (this.opts.log ?? ((m) => console.error(m)))(msg);
  }
}
