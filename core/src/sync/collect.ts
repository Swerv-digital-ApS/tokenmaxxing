import {
  type Source as Extracted,
  type CollectOptions as ExtractOptions,
  collect as extract,
} from "llm-usage-extraction";
import { fetchPullRequests, type GithubAccount, localGithubAccounts } from "../sources/github.ts";
import type { GithubProblem, Source, SyncState, TokenEvent } from "../types.ts";

const GITHUB_EVERY_MS = 15 * 60_000;

interface Batch {
  events: TokenEvent[];
  /** Apply to the state only after the server has acked `events`. */
  commit: (state: SyncState) => SyncState;
}

export interface CollectOptions extends Omit<ExtractOptions, "enabled"> {
  enabled: ReadonlySet<Source>;
  /** The GitHub accounts to count PRs for; defaults to `gh`'s, then git's saved login. null skips PRs. */
  githubAccounts?: (() => Promise<GithubAccount[] | GithubProblem>) | null;
  githubFetch?: typeof fetch;
}

/**
 * What llm-usage-extraction reads for our sources. Our `cursor_local` is Cursor's dashboard (its
 * `cursor_api`, with Grok Bot), never its local Cursor parsers, which would count the same usage twice.
 */
const extracted = (enabled: ReadonlySet<Source>): Set<Extracted> =>
  new Set(
    [...enabled].flatMap((s): Extracted[] =>
      s === "cursor_local" ? ["cursor_api", "grok_bot"] : s === "github" ? [] : [s],
    ),
  );

/**
 * Every enabled source's new events in batches, from the offsets in `state`: the logs and Cursor's
 * dashboard through llm-usage-extraction, then GitHub PRs. A caller that stops early (send failed)
 * just re-reads the same events next time.
 */
export async function* collect(state: SyncState, opts: CollectOptions): AsyncGenerator<Batch> {
  const { enabled, githubAccounts, githubFetch, ...rest } = opts;
  for await (const batch of extract(state, { ...rest, enabled: extracted(enabled) })) {
    yield {
      // The server reconciles Cursor estimates against dashboard rows stored as `cursor_local`.
      events: batch.events.map((e) => ({
        ...e,
        source: e.source === "cursor_api" ? "cursor_local" : e.source,
      })),
      commit: batch.commit,
    };
  }

  // PRs change a few times a day, and search has a tight rate limit: ask at most every 15 minutes.
  const now = (opts.now ?? Date.now)();
  if (
    !enabled.has("github") ||
    githubAccounts === null ||
    now - (state.github?.checkedAt ?? 0) < GITHUB_EVERY_MS
  )
    return;
  try {
    const found = await (githubAccounts ?? localGithubAccounts)();
    const cursors = { ...state.github?.cursors };
    const events: TokenEvent[] = [];
    let problem: GithubProblem | undefined;
    if (typeof found === "string") {
      problem = found;
    } else {
      let rejected = 0;
      for (const account of found) {
        const key = `${account.host}/${account.login}`;
        const r = await fetchPullRequests(account, cursors[key] ?? null, githubFetch, (msg) =>
          opts.onError?.(msg, "github"),
        );
        events.push(...r.events);
        if (r.since) cursors[key] = r.since;
        if (r.rejected) rejected++;
      }
      if (rejected === found.length) problem = "signed_out";
    }
    yield {
      events,
      commit: (s) => ({ ...s, github: { cursors, checkedAt: now, ...(problem ? { problem } : {}) } }),
    };
  } catch (err) {
    opts.onError?.(err, "github");
  }
}
