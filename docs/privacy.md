# Privacy: what leaves your computer

Only **token counts, model names, timestamps and opaque session/message ids** leave your Mac. Message
content never does. The app reads local logs and Cursor dashboard usage:

| Source | Where |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (subagents included), and PostHog Desktop's agent sessions in `~/Library/Application Support/@posthog/posthog-code/claude/projects/**/*.jsonl` |
| Claude Cowork | `~/Library/Application Support/Claude/…/.claude/projects/**/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` and `~/.codex/archived_sessions/**/*.jsonl`, and PostHog Desktop's gateway runs in `~/Library/Application Support/@posthog/posthog-code/codex-home/*/sessions/**/*.jsonl`. A rollout named in `state_*.sqlite` (`threads.rollout_path`) is included when that file still exists under the Codex home. `threads.tokens_used` is one running total with no per-turn split, so it is not counted. Consumer ChatGPT chats that never write a Codex rollout have no local token ledger |
| Cursor | Dashboard usage API, including your own usage billed to a Cursor team you belong to; signs in using `cursorAuth/accessToken` from the local `state.vscdb` |
| Grok Bot | The same Cursor dashboard, for models `grok-bot` and `grok-bot-*`, including your own usage billed to a Cursor team. The Grok Bot app's weekly plan percent is not a token count and is not read, so Grok Bot stays at 0 until those dashboard rows exist |
| GitHub | PRs you opened, on every account the `gh` CLI is signed in to (github.com and Enterprise), or else with the github.com login git saved for HTTPS (at most every 15 minutes); only a hash of each PR's URL and when it was opened are sent. The menu says when neither is there |

Cursor must be installed and signed in. Its session credential is read locally and sent only to
`cursor.com`; it is never uploaded to Tokenmaxxing or saved in sync state. Every 15 minutes, the helper
fetches paginated input, output, cache-write and cache-read counts from the dashboard, using the
[authentication approach from cursorbar](https://github.com/c-johannesen/cursorbar). The first sync requests
all history available from Cursor, sending pages of up to 1000 events as they arrive; later syncs
re-read seven days to catch delayed usage. The personal dashboard misses usage a team plan bills to
the team, which is where Grok Bot rows show for those accounts, so
[llm-usage-extraction](https://github.com/HansKristoffer/llm-usage-extraction) also lists your teams
(`POST /api/dashboard/teams`), reads your user id in each (`POST /api/dashboard/team`) and requests
`get-filtered-usage-events` with that `teamId` and `userId`. A team row is kept only when
`owningUser` is you, so teammates' usage is never counted. A row both reads return has the same
message id and counts once. No public
Cursor profile is required. Requests without a token breakdown are skipped. API failures retry on the
next sync without advancing the checkpoint or falling back to text estimates. Existing estimates are
replaced on world days with dashboard events; earlier days remain as previously synced.
Grok Bot models on that dashboard are stored as Grok Bot, not Cursor. An older checkpoint re-reads
history once so rows that used to be skipped are included.

Every source that's installed is read. **Everything is public in the world:** anyone can see your
totals, cost, parallelism, models and daily activity, and the leaderboard ranks everyone. So are your bio and the badges you pin
to your card (a bio is one line and can be reported), when you work, and your time in the Tavern.

**Company websites.** When a company's owner sets its website, the server asks
[Firecrawl](https://firecrawl.dev) to read that site's colours and logo, sends those to Claude to pick the
house's colours, and keeps a copy of the logo. Only the company's public website is involved; nobody's usage
data is sent anywhere for this.

**Weather.** The server asks [Open-Meteo](https://open-meteo.com) for Aarhus's weather (temperature, visibility, wind,
cloud, rain) every 15 minutes and for its pollen count ([air-quality API](https://open-meteo.com/en/docs/air-quality-api))
every hour, once for the whole world. Only the town's coordinates are sent.

**GitHub stars.** The server reads this repo's star count from GitHub's public API four times an hour, for the
star counter on the square. Nothing about players is sent.

**The statue of the #1 model.** Four times a day the server reads the top of
[LMArena's published leaderboard](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) (its
Hugging Face dataset, CC BY 4.0, no key) and puts the Text Arena's #1 on the plinth. It's the one source of the
lot that is official, public and machine-readable: lmarena.ai itself is behind Cloudflare, Artificial Analysis
needs an API key, OpenRouter's rankings measure tokens spent rather than quality, and SWE-bench ranks agent
systems. If a read fails the last leader stays up, and the admin page can pin another model over it. Nothing
about you is sent.

