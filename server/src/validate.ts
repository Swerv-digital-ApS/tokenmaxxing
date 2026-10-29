import {
  HOST_MAX,
  type KeynoteInput,
  MAX_AHEAD_MS,
  MAX_RUN_MS,
  TITLE_MAX,
  URL_MAX,
} from "@tokenmaxxing/core/keynote.ts";
import { REQUEST_MAX, REQUEST_MIN } from "@tokenmaxxing/core/requests.ts";
import { type MessageType, SOURCES, type Source, type TokenEvent } from "@tokenmaxxing/core/types.ts";
import { BIO_MAX_LENGTH, CHAT_MAX_LENGTH } from "@tokenmaxxing/core/world.ts";
import { isOneOf, normalizeWhitespace } from "hanzio";

/** Zero-width, bidi and byte-order marks: they hide text or flip it. */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this strips
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
/** A scheme, `www.`, or something dotted that ends in a common top-level domain. */
const LINKISH =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|dev|app|co|me|ai|xyz|gg|ly|sh|tv|info|biz|us|uk|de|dk|ru|cn|fr|nl|se|no|eu|ch|gl|to|cc|link|site|online|store|tech)\b)/i;

/**
 * A bio as stored: one line (newlines and runs of space become one space), no control, zero-width or
 * bidi characters, at most `BIO_MAX_LENGTH` code points, no links. Empty is `"clear"`; null is
 * refused. There is deliberately no word list: moderation is escaped text, reports and the admin page.
 */
export function parseBio(raw: unknown): string | null | "clear" {
  if (typeof raw !== "string" || raw.length > BIO_MAX_LENGTH * 8) return null;
  const text = raw.replace(INVISIBLE, "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (text === "") return "clear";
  if ([...text].length > BIO_MAX_LENGTH || LINKISH.test(text)) return null;
  return text;
}

/**
 * A request for the Tavern's pile as stored: one line, no control, zero-width or bidi characters, between
 * `REQUEST_MIN` and `REQUEST_MAX` code points, no links. Null is refused.
 */
export function parseRequest(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > REQUEST_MAX * 8) return null;
  const text = raw.replace(INVISIBLE, "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  const n = [...text].length;
  return n < REQUEST_MIN || n > REQUEST_MAX || LINKISH.test(text) ? null : text;
}

/** One line of plain text: no control, zero-width or bidi characters, single spaces. */
const oneLine = (raw: unknown): string =>
  typeof raw === "string" ? raw.replace(INVISIBLE, "").replace(CONTROL, " ").replace(/\s+/g, " ").trim() : "";

/** An https link to somewhere with a dot in its name, or null. */
function httpsUrl(raw: unknown): string | null {
  const text = oneLine(raw);
  if (!text || text.length > URL_MAX) return null;
  try {
    const u = new URL(text);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * A keynote as the admin page sent it (`core/src/keynote.ts`): a title of 3 to `TITLE_MAX` characters, a host
 * of up to `HOST_MAX`, a start before the end and at most `MAX_RUN_MS` apart, an end that hasn't passed, a
 * start within `MAX_AHEAD_MS`, and an https stream link. A string says what's wrong.
 */
export function parseKeynote(raw: unknown, now: number): KeynoteInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = oneLine(r.title);
  const host = oneLine(r.host);
  const startsAt = Number(r.startsAt);
  const endsAt = Number(r.endsAt);
  const url = httpsUrl(r.url);
  if ([...title].length < 3 || [...title].length > TITLE_MAX)
    return `Give it a title of 3 to ${TITLE_MAX} characters.`;
  if (!host || [...host].length > HOST_MAX) return `Say who's hosting it, in up to ${HOST_MAX} characters.`;
  if (!Number.isSafeInteger(startsAt) || !Number.isSafeInteger(endsAt)) return "Pick a start and an end.";
  if (endsAt <= startsAt) return "It has to end after it starts.";
  if (endsAt - startsAt > MAX_RUN_MS) return `A keynote runs ${MAX_RUN_MS / 3_600_000} hours at most.`;
  if (endsAt <= now) return "That's over already.";
  if (startsAt > now + MAX_AHEAD_MS) return "Schedule it at most a year ahead.";
  if (!url) return "The stream needs an https link.";
  return { title, host, startsAt, endsAt, url };
}

/** Lowercase handle, 2–32 chars. Shown to other users, so no free-form text. */
const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function parseUserName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

/** Company names are display-only (React escapes them); trimmed, 1–32 chars, no control chars. */
export function parseCompanyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = normalizeWhitespace(raw);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  if (name.length < 1 || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

/** A website as its bare host (`acme.com`), from `acme.com`, `https://www.acme.com/about`, etc. */
export function parseWebsite(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 256) return null;
  const text = raw.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    // A registrable name with a TLD: no IPs, no `localhost`, no user:pass@ or ports.
    if (url.username || url.password || url.port) return null;
    return /^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Chat text is shown to everyone in the room (React escapes it); control chars become spaces. */
export function parseChatText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.length >= 1 && text.length <= CHAT_MAX_LENGTH ? text : null;
}

export const MAX_EVENTS_PER_REQUEST = 1000;
/** Clock-skew headroom for events stamped slightly in the future. */
const MAX_FUTURE_MS = 3_600_000;
const MAX_ID_LENGTH = 256;
/**
 * No real turn comes near this (a whole context window is a few million), and it keeps sums far
 * from SQLite's 64-bit limit: `SUM` throws past it, which would break every leaderboard at once.
 */
const MAX_TOKENS_PER_EVENT = 1_000_000_000;
/**
 * Model names are shown on profiles, so they can't carry free text. Real ones look like
 * `claude-opus-4-7`, `us.anthropic.claude-sonnet-4:0`, `claude-opus-4@20250514` or `<synthetic>`;
 * anything else is counted as `unknown` rather than dropped.
 */
const MODEL_RE = /^[\w.:/@<>+-]{1,128}$/;

const isNonNegInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isTokens = (v: unknown): v is number => isNonNegInt(v) && v <= MAX_TOKENS_PER_EVENT;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID_LENGTH;

/** Returns the event, or a reason string. Nothing from the payload is echoed back. */
export function parseEvent(raw: unknown, now: number): TokenEvent | string {
  if (!raw || typeof raw !== "object") return "not an object";
  const e = raw as Record<string, unknown>;
  if (!isOneOf(SOURCES, e.source)) return "source";
  if (!isId(e.sessionId)) return "sessionId";
  if (e.agentId !== null && e.agentId !== undefined && !isId(e.agentId)) return "agentId";
  if (!isId(e.messageId)) return "messageId";
  if (e.requestId !== null && !isId(e.requestId)) return "requestId";
  if (!isNonNegInt(e.timestamp) || e.timestamp > now + MAX_FUTURE_MS) return "timestamp";
  if (e.messageType !== "user" && e.messageType !== "assistant" && e.messageType !== "pr")
    return "messageType";
  if (typeof e.model !== "string" || e.model.length > MAX_ID_LENGTH) return "model";
  if (e.messageType === "assistant" && e.model.length === 0) return "model";
  for (const k of ["inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens"] as const) {
    if (!isTokens(e[k])) return k;
  }
  if (e.reasoningTokens !== null && !isTokens(e.reasoningTokens)) return "reasoningTokens";
  if (
    e.costCents !== undefined &&
    e.costCents !== null &&
    ((e.source !== "cursor_local" && e.source !== "grok_bot") ||
      typeof e.costCents !== "number" ||
      !Number.isFinite(e.costCents) ||
      e.costCents < 0 ||
      e.costCents > 100_000_000)
  )
    return "costCents";
  return {
    ...(e.costCents !== undefined ? { costCents: e.costCents as number | null } : {}),
    source: e.source as Source,
    sessionId: e.sessionId,
    agentId: (e.agentId as string | null | undefined) ?? null,
    messageId: e.messageId,
    requestId: e.requestId as string | null,
    timestamp: e.timestamp,
    model: e.model === "" || MODEL_RE.test(e.model) ? e.model : "unknown",
    messageType: e.messageType as MessageType,
    inputTokens: e.inputTokens as number,
    outputTokens: e.outputTokens as number,
    cacheCreationTokens: e.cacheCreationTokens as number,
    cacheReadTokens: e.cacheReadTokens as number,
    reasoningTokens: e.reasoningTokens as number | null,
  };
}
