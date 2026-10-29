import type {
  TokenEvent as Extracted,
  MessageType as ExtractedType,
  ExtractState,
} from "llm-usage-extraction";

export { CURSOR_API_MESSAGE_PREFIX, type ExtractState, type FileState } from "llm-usage-extraction";

/** `cursor_local` is Cursor's dashboard usage (`cursor_api` in llm-usage-extraction), kept for the stored rows. */
export const SOURCES = [
  "claude_code",
  "claude_cowork",
  "codex",
  "cursor_local",
  "grok_bot",
  "github",
] as const;
export type Source = (typeof SOURCES)[number];

/**
 * Cursor dashboard models that belong to Grok Bot, not the Cursor IDE.
 * Matched rows are stored as `grok_bot` with the dashboard's own token counts.
 *
 * The Grok Bot macOS app's `weekly-usage.cache` is plan percent only
 * (`percentUsed`, reset time, plan label). It is not a token ledger and is never
 * read. llm-usage-extraction reads these rows from the Cursor dashboard, including
 * the user's own usage billed to a Cursor team they belong to. Grok Bot stays at 0
 * until those rows exist.
 */
export function isGrokBotModel(model: string): boolean {
  return model === "grok-bot" || model.startsWith("grok-bot-");
}

/** `pr` marks a pull request the user created (GitHub source, zero tokens). */
export type MessageType = ExtractedType | "pr";

/** One model turn read from a local log or Cursor's dashboard, or a PR. Never carries message content. */
export interface TokenEvent extends Omit<Extracted, "source" | "messageType"> {
  source: Source;
  messageType: MessageType;
}

export interface IngestResponse {
  inserted: number;
  duplicates: number;
}

/** Why no PRs can be counted, for the menu: no `gh` (nor a saved git login), or `gh` signed out. */
export type GithubProblem = "no_gh" | "signed_out";

export interface SyncState extends ExtractState {
  /**
   * Per GitHub account (`host/login`), the newest PR `createdAt` fetched; when we last asked; and,
   * when no PRs could be counted, why (shown in the menu).
   */
  github?: { cursors?: Record<string, string>; checkedAt?: number; problem?: GithubProblem };
}

/** An event with only what's given: no tokens, no agent, request or model unless set. */
export const tokenEvent = (
  e: Pick<TokenEvent, "source" | "sessionId" | "messageId" | "timestamp" | "messageType"> &
    Partial<TokenEvent>,
): TokenEvent => ({
  agentId: null,
  requestId: null,
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  reasoningTokens: null,
  ...e,
});
