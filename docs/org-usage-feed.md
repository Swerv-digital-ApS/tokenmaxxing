# Organization usage feed (v1)

An organization can push cloud usage for players who have linked themselves to it. The player's own
app keeps counting local logs and the Cursor dashboard. This feed is only for usage that never
wrote those logs: claude.ai, Claude Code on the web, ChatGPT, Codex on the web, and the same kind
of session from the organization's team accounts.

Version is the URL prefix `/api/v1/` and the body's `"version": 1`. A breaking change will be
`/api/v2/`.

The server stores token counts, model names, timestamps and opaque ids. It does not store message
content, prompts, or a cost. Rows are public on the player's character, the same as usage their Mac
already syncs. The in-game opt-in says so, and nothing is stored before the player opts in.

## Server configuration

```
ORG_FEED_SECRETS=swerv:<secret>,other:<secret>
```

- Never commit a secret. Leave the variable unset to disable the feed (every call is `401`).
- `orgId` matches `^[a-z0-9][a-z0-9-]{0,31}$`. It is lowercased.
- The secret is everything after the first colon, at least 32 characters.
- One secret per organization. A repeated org id or a repeated secret fails boot.
- The secret is the credential. The body does not name the organization. A wrong secret is `401`,
  including when the variable is unset. The response does not say which.

## Opt in

1. The player, in the app or a browser (not a linked computer), opens their character and enters
   the organization id. The card shows: "Everything in the world is public. Linking counts this
   organization's cloud usage on your character: token counts, model names and timestamps, which
   anyone in the world can see. Message content is never included. Nothing is counted until you
   opt in."
2. The game returns an 8-character code (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no `0`, `O`,
   `1` or `I`). It lasts 15 minutes. A new code replaces the player's previous code. Ten codes an
   hour per player. The code is shown once; only its hash is stored.
3. The player gives that code to the organization, out of band.
4. The organization redeems it with the player's email (`POST /api/v1/org-usage/link`).
5. Later pushes for that email count for that player. A player may link more than one email, one
   code each. They can unlink the organization in the game (every email for it). The organization
   can unlink one email.

Events for an email that is not linked are not stored.

## `POST /api/v1/org-usage/link`

`Content-Type: application/json`. `Authorization: Bearer <secret>`.

```json
{ "version": 1, "code": "AB12CD34", "email": "dev@swerv.example" }
```

Email is trimmed and lowercased. One `@`, a dot in the domain, at most 254 characters.

| Status | Body | When |
|---|---|---|
| 200 | `{ "linked": true }` | Linked, or this player was already linked to this email |
| 400 | `{ "error": "invalid_body" }` | Version, code or email is wrong. Values are not echoed |
| 401 | `{ "error": "unauthorized" }` | Missing or unknown bearer token |
| 404 | `{ "error": "claim_not_found" }` | Unknown, expired, or minted for another organization |
| 409 | `{ "error": "email_taken" }` | That email is linked to a different player. The code stays valid |
| 415 | `{ "error": "unsupported_type" }` | Not `application/json` |
| 429 | `{ "error": "rate_limited" }` | More than 60 requests a minute for this organization |

## `POST /api/v1/org-usage/unlink`

```json
{ "version": 1, "email": "dev@swerv.example" }
```

`200` `{ "unlinked": true }` when a link was removed, `{ "unlinked": false }` when there was none.
Same `400` / `401` / `415` / `429` as link.

## `POST /api/v1/org-usage`

```json
{
  "version": 1,
  "events": [
    {
      "email": "dev@swerv.example",
      "source": "claude_cloud",
      "id": "msg_01abc",
      "timestamp": 1761560000000,
      "model": "claude-sonnet-4-5",
      "inputTokens": 1200,
      "outputTokens": 340,
      "cacheCreationTokens": 0,
      "cacheReadTokens": 80,
      "reasoningTokens": null
    }
  ]
}
```

| Field | Rule |
|---|---|
| `events` | 0 to 1000 objects. The whole batch is checked before anything is written |
| `email` | As on link |
| `source` | `claude_cloud` or `codex_cloud`. See the source rules below |
| `id` | 1 to 200 printable ASCII characters (`!` through `~`). Stable for that turn. Unique per player |
| `timestamp` | Unix milliseconds, an integer, not more than one hour in the future |
| `model` | A string. Names that aren't model-shaped are stored as `unknown` and still count. An assistant row needs a non-empty model |
| `inputTokens`, `outputTokens` | Integers, 0 to 1,000,000,000 |
| `cacheCreationTokens`, `cacheReadTokens` | Same, or omit them for 0 |
| `reasoningTokens` | Same, or omit / `null` |
| `costCents` | Do not send it. It is ignored. The server prices the model |

The body is at most 1,000,000 bytes (`413` `{ "error": "too_large" }`). Unknown fields are ignored.
Do not send message content; it is not read and must not be relied on as stored.

`200`:

```json
{
  "inserted": 1,
  "duplicates": 0,
  "overlaps": 0,
  "unlinked": 0,
  "deviceSync": 0,
  "rateLimited": 0
}
```

| Field | Meaning |
|---|---|
| `inserted` | New rows stored |
| `duplicates` | A row with this `id` was already stored for that player. The first write wins; a re-send does not change token counts |
| `overlaps` | Dropped because the player's own app already has that turn (see below) |
| `unlinked` | Dropped because that email is not linked. Not stored |
| `deviceSync` | Dropped because that source is the device's job. Not an error |
| `rateLimited` | Not stored because that player is over the daily event cap. Send them again tomorrow |

A `400` rejects the batch and writes nothing:

```json
{ "error": "invalid_event", "index": 0, "field": "timestamp" }
```

`index` is the event's place in `events`. `field` is `email`, `source`, `id`, or a token field name.
The bad value is not included. `{ "error": "invalid_body" }` means the envelope itself is wrong
(version, `events` not an array, more than 1000).

`500` `{ "error": "ingest_failed", "inserted", "duplicates", "overlaps", "unlinked", "deviceSync", "rateLimited" }`
means a later player in the batch failed after an earlier one was stored. Sending the same batch
again is safe: stored rows come back as `duplicates`.

Other statuses match link: `401`, `405` `{ "error": "method_not_allowed" }`, `413`, `415`, `429`.
Responses send `cache-control: no-store`. Emails, bodies and secrets are not logged.

## Sources

| `source` | Menu and world | What to send |
|---|---|---|
| `claude_cloud` | Claude Cloud | Claude usage that did not write a local jsonl |
| `codex_cloud` | Codex Cloud | OpenAI usage that did not write a local rollout |

The menu lists a source only on days it has tokens, same as the other sources.

These sources are the device's job. Sending them increments `deviceSync` and stores nothing.
Do not push them:

`claude_code`, `claude_cowork`, `codex`, `cursor_local`, `cursor`, `grok_bot`, `grok`, `github`, `claude`.

Cursor and Grok Bot, including usage a team plan bills to the team, are read by the player's own
Cursor dashboard sync. This feed must not send them.

Any other `source` is `400`.

## No double counting

`id` becomes the stored message id `org:<orgId>:<id>`, so a re-send of the same id is one row.

Separately, a cloud row is the same turn as a local row when all of these match:

- local source is `claude_code` or `claude_cowork` for `claude_cloud`, or `codex` for `codex_cloud`
- both are assistant rows
- the same model string
- the same input, output, cache-creation and cache-read counts
- timestamps within 2 minutes, inclusive

The local row wins. A cloud row that arrives second is counted in `overlaps` and not stored. A
local row that arrives second deletes the cloud row, including when the two timestamps fall on
different world days, and that day is counted again from what remains.

This is a safety net. If the team analytics timestamp is more than 2 minutes away from the local
log, both can count. Do not push usage the player's Mac already syncs. A match also requires the
same model and the same four token counts: a looser match would hide a real second call.
