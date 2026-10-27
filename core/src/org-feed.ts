/** Organization ids in `ORG_FEED_SECRETS` and in the claim UI. */
export const ORG_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Shown before a player links an organization, and returned with the claim code.
 * Everything stored from the feed is public in the world, so the opt-in says so.
 */
export const ORG_FEED_NOTICE =
  "Everything in the world is public. Linking counts this organization's cloud usage on your character: token counts, model names and timestamps, which anyone in the world can see. Message content is never included. Nothing is counted until you opt in.";

/** How close a cloud row must be to a local row, with the same model and token counts, to be the same turn. */
export const ORG_OVERLAP_MS = 2 * 60_000;

/** Claim codes last this long, then the organization can no longer redeem them. */
export const ORG_CLAIM_MS = 15 * 60_000;

/** Eight characters, no 0/O/1/I, so a player can read the code out loud. */
export const ORG_CLAIM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

/** Stored message ids for feed rows start with this, then `<orgId>:<provider id>`. */
export const ORG_MESSAGE_PREFIX = "org:";

/** Sources the feed may store. Cursor and Grok Bot stay on the device's dashboard sync. */
export const ORG_FEED_SOURCES = ["claude_cloud", "codex_cloud"] as const;
export type OrgFeedSource = (typeof ORG_FEED_SOURCES)[number];

export function isOrgFeedSource(source: string): source is OrgFeedSource {
  return source === "claude_cloud" || source === "codex_cloud";
}
