# tokenmaxxing

A tiny pixel town for people who run AI coding agents. Install the app, pick a name, and
**Open world**: you walk around town as your own character, chat with whoever is in the same room, and
open anyone's stats. Start a **company** (or pick one from the list and ask to join; its owner says yes or
no) and it gets a
house in town, painted in your brand's colours with your logo on it. When you're not playing, your
character is in that house: **at a desk** while your agents run, **asleep in bed** when they don't. Using
AI earns **coins**, and so does finishing a day in the top 3; spend them on clothes, glasses, hats and
pets that follow you around (hold a pet and pick any of its colours and breeds with the eye in your bag; they curl up asleep in the pet bed of your office while you're in it). Or play for them: challenge someone to a game in the town square, from
rock-paper-scissors for founders, Liar's Dice and a typing race to **Tokenmaxxing**, a battle over who burns
the most real tokens in an hour.
A **star counter** on the square shows the project's GitHub stars, live; press E at it (or open the menu) to
star the repo, and every milestone (100, 250, 500, 1000…) sets off fireworks over the square for everyone online.
The Inn is **The Tavern**: a bar with a free daily special, a barkeep, a quest board (three daily quests scaled to how you work, and a weekly one), a Hall of Fame, plaques for the week's regulars, world clocks for San Francisco, New York and Copenhagen (SF's lamp lights up in US working hours, when model launches tend to land), and stairs down to a basement net cafe with arcade cabinets and a live screen of matches. When a big AI launch event is live (OpenAI DevDay, Google I/O, an Anthropic event), the Tavern throws a **keynote watch party**: a projector screen comes down by the stage with the livestream's link, the town's characters gather to cheer, and dropping in earns a badge. A poster and the barkeep announce it a week ahead; the events are scheduled on the admin page.
The town has Aarhus's real sky and weather, and the **windmill** beside the Tavern turns with the real wind: still in calm air, faster as it blows (up to a cap in a storm), its sails turned into it.
The town keeps the Danish calendar: for the week up to **Halloween** a jack-o'-lantern sits on every doorstep and a
few by the pond, lit after dark, and for two weeks round it the Clothes shop sells a Jack-o'-lantern hat (worn all year once bought).

Reads usage from Claude Code (including subagents), Claude Cowork, Codex and Cursor, including the Claude Code and
Codex sessions PostHog Desktop runs, and your pull requests from GitHub.

## Install

```bash
brew install --cask hanskristoffer/tap/tokenmaxxing
```

Open **Tokenmaxxing** and pick a name. From then on it lives in the menu bar: it syncs in the background
and shows your tokens today next to the ⚡. **Open world** (from its menu, the Dock or Spotlight) opens the
game in its own window, where everything else is: leaderboards, stats, companies and games. The app keeps
itself up to date.

### On a second computer

Running agents on another machine too, like a Mac mini under the desk or a Linux box? Link it, and its tokens
count for you. In the app, choose **Link a computer…** (in the menu bar, or on your own card in the game).
That gives you a line to run in a terminal on the other computer, good for 10 minutes:

```bash
curl -fsSL https://<server>/install.sh | sh -s -- link 42.Xk3…
```

It installs the `tokenmaxxing` command (macOS or Linux, in `~/.local/bin`), links it, sends that computer's
history, and keeps syncing in the background (a LaunchAgent, or a systemd user service). Then:
`tokenmaxxing status`, `sync`, `logs` and `unlink`. A linked computer can only send usage: it can't chat,
spend coins or open the world. Your card in the game lists your computers and removes them.

**Coming from 0.5 or earlier?** The world is a new backend and starts fresh: update the app, pick a name again and
recreate your company. Your usage history comes back by itself, because the app re-reads your local logs on
its first sync.

## What's shared

Only **token counts, model names, timestamps and opaque session/message ids** leave your Mac. Message
content never does. The app reads local logs and Cursor dashboard usage:

| Source | Where |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (subagents included), and PostHog Desktop's agent sessions in `~/Library/Application Support/@posthog/posthog-code/claude/projects/**/*.jsonl` |
| Claude Cowork | `~/Library/Application Support/Claude/…/.claude/projects/**/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` and `~/.codex/archived_sessions/**/*.jsonl`, and PostHog Desktop's gateway runs in `~/Library/Application Support/@posthog/posthog-code/codex-home/*/sessions/**/*.jsonl`. A rollout named in `state_*.sqlite` (`threads.rollout_path`) is included when that file still exists under the Codex home. `threads.tokens_used` is one running total with no per-turn split, so it is not counted. Consumer ChatGPT chats that never write a Codex rollout have no local token ledger |
| Cursor | Dashboard usage API; signs in using `cursorAuth/accessToken` from the local `state.vscdb` |
| Grok Bot | The same Cursor dashboard, for models `grok-bot` and `grok-bot-*`, including usage billed to a Cursor team the signed-in user belongs to. The Grok Bot app's weekly plan percent is not a token count and is not read, so Grok Bot stays at 0 until those dashboard rows exist |
| GitHub | PRs you opened, on every account the `gh` CLI is signed in to (github.com and Enterprise), or else with the github.com login git saved for HTTPS (at most every 15 minutes); only a hash of each PR's URL and when it was opened are sent. The menu says when neither is there |

Cursor must be installed and signed in. Its session credential is read locally and sent only to
`cursor.com`; it is never uploaded to Tokenmaxxing or saved in sync state. Every 15 minutes, the helper
fetches paginated input, output, cache-write and cache-read counts from the dashboard, using the
[authentication approach from cursorbar](https://github.com/c-johannesen/cursorbar). The first sync requests
all history available from Cursor, sending pages of up to 1000 events as they arrive; later syncs
re-read seven days to catch delayed usage. A personal call (no team id) misses usage a team plan
bills to the team. That is where Grok Bot rows show on cursor.com/dashboard for those accounts. The
helper also lists teams (`POST /api/dashboard/teams`), reads the signed-in user's id
(`POST /api/dashboard/team`), and requests `get-filtered-usage-events` with that `teamId` and
`userId`. A row is kept only when `owningUser` is that user, so teammates' usage is never counted.
Rows the personal call already returned share its message id and count once. No public
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

**GitHub stars.** The server reads this repo's star count from GitHub's public API four times an hour, for the
star counter on the square. Nothing about players is sent.

## The stats

- **Tokens:** input + output + cache writes + cache reads.
- **Cost:** all sources use [LiteLLM's table](https://github.com/BerriAI/litellm), refreshed daily, including reasoning-effort matching. If no model price matches, Cursor uses the API's `chargedCents`, falling back to `tokenUsage.totalCents`, preserving zero and fractional cents. Reported values reflect usage-time costs and credit adjustments; there are no hardcoded Cursor rates. Models without either a price or a reported cost contribute $0. These totals combine current model-price estimates with historical reported usage values; they are not subscription invoices.
- **Parallelism ×:** the average number of agents running at the same time, measured over the time you
  had at least one running. Three agents working through the same hour is 3.0×. Time is measured in
  5-minute buckets, subagents count as agents, and you need at least 1 active hour in the range to be
  ranked.
- **Peak agents:** the most agents running at once.
- **Tokens / active hour:** tokens divided by hours with at least one agent running.
- **Days** are Copenhagen days for everyone: one world, one clock.
- **Level** comes from lifetime tokens (1M → Lv1, 1B → Lv7).
- **Houses** show how hard a company's people push: tokens **per member** over the last 30 days. Under 100M
  each is a cellar hatch in a fenced yard; then a shack (100M), cottage (1B), two-storey house (5B), villa
  (15B) and a mansion with a tower (40B). A big team of light users stays in the basement.
- **Coins:** from the day you sign up, every day pays `√(tokens ÷ 1M)`: 100M tokens is 10 coins, 1B is 31. A heavy day earns more,
  but not wildly more. Finishing a day 1st, 2nd or 3rd adds 25, 15 or 10.
- **Green hours:** the town reads west Denmark's power grid (price area DK1, from Energinet's free
  [Energi Data Service](https://www.energidataservice.dk)). An hour is green when the hour before it ran at
  75 g CO₂/kWh or less (about a third of hours); a banner says so, and tokens burned in it pay a quarter of
  what they'd pay as a day of their own on top (`¼ √(tokens ÷ 1M)`: 100M green tokens is 2 coins). The price
  board on the square's north-east lamp post shows the power price, and when it's in the day's dearest
  quarter (and over 1 kr/kWh) the street lamps burn dimmer.
- **Quests:** three a day, worth 1, 2 and 3 coins, picked for you and scaled to your own last 30 days (at most 6 a day), plus a weekly one for 15. Some are errands in town. Badges have bronze, silver and gold tiers, and some a diamond; the town hears of the golds and diamonds.
- **The raid:** from the first Monday after launch, every Monday at 08:00 a ladder of five bosses opens in the Raid Dungeon, down the gate in the square,
  easiest first, five in all. Clear all five and the ladder rests until next Monday, when it comes back one level up (The Rate Limit II…) and 10% tougher; fall short and next Monday it starts again at the same level. Every token you sync hits the one up now, no cap, and
  every PR you open is a 25M special attack. When one falls the next, 1.5× tougher, appears at once; each kill pays everyone who'd hit for
  10M or more that week by then 10, 25, 50, 75 and 100 coins (and 10% more for each level the ladder is up). Everyone with agents running sits at a desk in the
  dungeon, wherever they are, firing magic missiles (and a robot minion per extra agent) as fast as they burn
  tokens: that's the show, the hits are the synced tokens. Until the first one the gate is boarded up with a
  ⚠️ and a countdown to that Monday 08:00.
  Each boss also drops its own rare loot: every raider a kill pays rolls its four items, from a 10% hat to a
  0.1% trophy (Golden Hourglass, Infinite Context Crown…). Rolls are fixed per week, rung and player, so nobody
  can reroll. Loot is worn or placed like shop items, and can be traded.

## How it works

```
Tokenmaxxing.app (Tauri, Rust)                     server (Railway, one process)
├─ menu bar: ⚡ 306M, its menu                      Bun.serve
├─ game window ── loads the live game ──────────►  ├─ /             the marketing site (Astro)
├─ Keychain, login item, updater                   ├─ /play         the game (bundled at boot)
│                                                  ├─ /admin        the admin page (ADMIN_TOKEN)
│                                                  ├─ /logos/:file  company logos
└─ sidecar: TS helper ◄─ NDJSON                    ├─ /api/rivet/*  proxy to the Rivet engine's gateway ◄── game
     parses local logs, player.ingest() ────────►  └─ Rivet actors: town, world, player[userId],
                                                      arcade, match[id]
                                                   engine data: $RIVETKIT_STORAGE_PATH (the volume)
```

The backend is [Rivet Actors](https://rivet.dev/docs/actors). `rivetkit` starts the Rivet engine
inside the container; `Bun.serve` exposes only its client gateway under `/api/rivet`.

| Actor | Key | What |
|---|---|---|
| `player` | user id | Raw events (SQLite), device token and browser sessions, daily rollups on ingest |
| `town` | `main` | Accounts, companies, daily rollups for everyone: leaderboards and player cards |
| `world` | `main` | Who's where: steps, rooms, rest spots (bed/desk), room chat, a 10 Hz broadcast loop |
| `arcade` | `main` | Mini games: tables, invites, side bets, and paying out the pot |
| `match` | match id | One game being played: its rules, timers and each player's view |

| Path | What |
|---|---|
| `core/` | Log parsers, sync engine, shell↔helper protocol, `maps.ts` and `world.ts` (the world's rules, shared by client and server) |
| `server/` | `main.ts`, the Rivet proxy, the actors (`src/actors/`) and what `town` does (`src/town/`), company branding, pricing |
| `web/` | The game: canvas renderer in `src/game/`, pixel art drawn in code in `src/art/`, React HUD in `src/hud/` |
| `app/helper/` | The TypeScript helper the app runs as a sidecar (`bun build --compile`) |
| `app/desktop/` | The desktop app: Tauri v2 (`src-tauri/`), the "pick a name" page, icons and build scripts |
| `packaging/tokenmaxxing.rb` | Homebrew cask template |
| `ARCHITECTURE.md` | How it all fits together: serving, auth, the actors, houses, coins, games |

All art is drawn in code (palette-string sprites and rectangles), so the repo carries no image assets.

## Development

Requires Bun 1.4.4+ (for `bun check` and `bun fmt`), Rust (stable), and the native
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. macOS needs Xcode's command
line tools (macOS 14+); Windows needs MSVC C++ build tools and WebView2; Linux needs WebKitGTK 4.1,
GTK/AppIndicator and D-Bus development packages (see the desktop CI job for the Ubuntu package list).

```bash
bun install --ignore-scripts
bun run dev                            # http://localhost:8787 (the site; the game is at /play; data in ./.data/rivet); restart to see web edits
bun run site:dev                       # the marketing site alone, with hot reload
bun run dev:seed                       # a few people, two companies, and a link that signs you in
bun run desktop:dev                    # the desktop app against localhost:8787
bun run check                          # typecheck (bun check) + lint (Biome, bun fmt --check) + tests (tests start their own server)
bun run format                         # Biome's fixes, then bun fmt
(cd app/desktop/src-tauri && cargo test)   # the Rust side, including the protocol contract test
```

Dev builds of the desktop app run the helper from source (so TypeScript changes only need an app restart),
with their own credential-store entry and state dir, so they never touch the installed app's account. Point one at
another server with `TOKENMAXXING_SERVER_URL=… bun run desktop:dev`.
### Linux and Windows desktop preview

The desktop app can be built natively on Linux and Windows with `bun run desktop:dev` or
`bun run desktop:build`. Build on the target OS: Linux produces `.deb` and `.AppImage` packages;
Windows x64 produces an NSIS `.exe` installer. The helper build hook uses Bun, so Git Bash is not
required for local Windows builds. The existing signed macOS release pipeline is unchanged.

CI checks Rust on all three platforms and uploads unsigned Linux/Windows preview installers as
`desktop-Linux` and `desktop-Windows` artifacts. These use the repository's `TOKENMAXXING_SERVER_URL`
variable, or `http://localhost:8787` when it is unavailable (such as on a fork). A local release build
must set `TOKENMAXXING_SERVER_URL` explicitly; in PowerShell:

```powershell
$env:TOKENMAXXING_SERVER_URL = "http://localhost:8787"
bun run desktop:build
```

Tokens stay in macOS Keychain, Windows Credential Manager, or the Linux desktop's Secret Service
(e.g. GNOME Keyring, with an unlocked login keyring and session D-Bus). There is no plaintext token
fallback. Sync state is in `~/Library/Application Support/Tokenmaxxing` on macOS,
`%LOCALAPPDATA%/Tokenmaxxing` on Windows, and `$XDG_DATA_HOME/Tokenmaxxing` (default
`~/.local/share/Tokenmaxxing`) on Linux. Dev state uses `Tokenmaxxing Dev` instead. Helper logs keep
`~/Library/Logs/Tokenmaxxing` on macOS and use `Tokenmaxxing/logs` inside the data directory elsewhere.

Native manual QA is still required: onboarding, restart with saved credentials, tray menu and
clipboard, token sync, launch at login, and closing/reopening the world. Linux needs a tray host
(GNOME may require an AppIndicator extension). Windows signing, Linux/Windows updater artifacts and
release publishing remain follow-ups; previews disable update checks and do not generate signed updater artifacts.
The linked-computer CLI installer and service manager still support macOS/Linux only.

To sync without the UI:

```bash
TOKENMAXXING_TOKEN=… TOKENMAXXING_SERVER_URL=http://localhost:8787 bun run helper:once
```

The CLI for linked computers runs from source too. Get a code from the app (or `player.mintLinkCode()`), and
keep it off your real config with `TOKENMAXXING_CLI_DIR`:

```bash
TOKENMAXXING_CLI_DIR=.data/cli bun app/helper/src/cli.ts link <code> --server http://localhost:8787 --no-service
bash app/helper/scripts/cli.sh dist/cli    # the release binaries, for every platform
```

### Android companion preview

See [app/android/README.md](app/android/README.md) for building the APK and connecting your existing
account. In the game on your computer: player card → Computers → **Connect phone**; scan the two-minute,
single-use QR in the Android app, or paste the code. The phone plays the same character while computers
keep syncing usage. The companion pairing changes must be deployed on the server before this works.

### 3D and graphics

The world runs on a voxel 3D renderer (Three.js, loaded only when needed) on the Medium, High and Ultra graphics tiers, and
on the classic 2D canvas on Low. **Auto** picks from the machine (High at most; Ultra is opt-in) and a frame-rate governor steps
down if it can't keep up; the **Graphics** panel (Esc menu) changes it.

```bash
bun run qa:tour                        # headless tour of the real game's rooms (needs a local server and Playwright; see scripts/qa/lib.mjs)
bun scripts/perf/counts.ts medium      # per-room draw and triangle counts, checked against the budgets
```

Architecture, the `Renderer` interface, the perf budgets and how to profile are in [ARCHITECTURE.md](ARCHITECTURE.md#3d-and-graphics-where-to-look).

### Server config

| Var | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `RIVETKIT_STORAGE_PATH` | `~/.rivetkit` in dev | Where the engine keeps every actor. Required in production: `/data/rivet` on the Railway volume (set in the Dockerfile) |
| `RIVET_LOG_LEVEL` | | `error` keeps the engine quiet |
| `NODE_ENV` | | `production` minifies the game |
| `FIRECRAWL_API_KEY` | | Reads company websites. Without it, a website only goes on the sign |
| `ANTHROPIC_API_KEY` | | Turns a website's brand into house colours. Without it, the site's own colours are used |
| `ADMIN_TOKEN` | | Turns on the admin page at `/admin#token=<it>` (32+ characters: `openssl rand -hex 32`). Without it, the page lets nobody in |
| `CLIENT_IP_HEADER` | `x-real-ip` | Where the client's IP is, for per-IP limits. Railway's edge sets `x-real-ip` |
| `GATEWAY_REQUESTS_PER_MIN` | `1200` | Requests to the actors per client IP a minute |
| `GATEWAY_SOCKETS_PER_MIN` | `300` | New WebSockets per client IP a minute |
| `HEALTH_FAILURES` | `5` | The server exits (so the host restarts it) after this many failed actor probes in a row... |
| `HEALTH_WINDOW_MS` | `120000` | ...the first of them at least this long ago. One success starts over |
| `HEALTH_INTERVAL_MS` | `30000` | Time between probes |
| `HEALTH_TIMEOUT_MS` | `20000` | One probe's patience. Each failure is logged with how long it took and the event loop's lag, so a busy machine can be told from a dead engine |
| `GRID_FEED` | | `off` stops reading the power grid: no green hours (so no bonus), no price board and lamps at full |
| `GITHUB_TOKEN` | | Sent with the star counter's GitHub reads (a higher rate limit; no scopes needed). Without it, they go unauthenticated: 4 an hour, well inside GitHub's 60 |
| `GITHUB_STARS` | | Dev and testing: `480` pins the star count instead of reading GitHub (pin it past a milestone and restart for the fireworks); `off` reads nothing |
| `RAID_LOOT_BOOST` | `1` | Dev and testing only: multiplies every raid drop's odds (1 to 1000), so `100` shows rare loot without waiting for luck. Leave unset in production |
| `RAID_START_WEEK` | | The first raid's Monday (`YYYY-MM-DD`), for dev and testing: `2026-10-19` opens a raid now. Without it, the raid opens the Monday after the town first runs (stored once) |

`RIVETKIT_STORAGE_PATH` and `RIVET_LOG_LEVEL` are read by RivetKit's native side, so they must be set in
the environment before the process starts.

To keep a local server up on its own (for a tailnet game, say), `scripts/supervise.sh` runs
`bun server/src/main.ts` and restarts it when it exits (1 s, doubling to 30 s; a run of 60 s resets it).
The environment is passed through; `SUPERVISE_LOG=path` appends everything to a file; SIGINT/SIGTERM stop
the server, and its engine, cleanly.

```sh
PORT=8787 RIVETKIT_STORAGE_PATH=$HOME/tm-data SUPERVISE_LOG=$HOME/tm.log scripts/supervise.sh
```

### Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (PR titles are checked).
[release-please](https://github.com/googleapis/release-please) keeps a Release PR open. Merging it
tags the version, builds the desktop app (universal, signed and notarized, with `tauri-action`), attaches
the `.dmg` and the updater's files (`.app.tar.gz`, `.sig`, `latest.json`), notarizes the `.dmg` too (and
attaches it again as `Tokenmaxxing.dmg`, what the website's Download button fetches), attaches the CLI for
linked computers (`tokenmaxxing-{darwin,linux}-{arm64,x64}` and `SHA256SUMS`, which `/install.sh` fetches), and
updates the cask in `HansKristoffer/homebrew-tap`. Before that, it checks what people will get: the
downloaded `.dmg` and the app in it pass Gatekeeper, and the published update's signature matches the
app's public key.
Installed apps find the update through `latest.json` on the latest release (hourly), install it by themselves
when no window is open, and otherwise show an "Update" button in the game.
Railway deploys the server from `main`, and the game window picks that up on its own.

Required repo settings: the variable `TOKENMAXXING_SERVER_URL`, and the secrets `MACOS_CERT_P12`,
`MACOS_CERT_PASSWORD`, `MACOS_SIGN_IDENTITY`, `NOTARY_APPLE_ID`, `NOTARY_TEAM_ID`, `NOTARY_PASSWORD`,
`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and `HOMEBREW_TAP_DEPLOY_KEY` (a write
deploy key on the tap repo). `app/desktop/scripts/set-signing-secrets.sh` uploads all but the last. The
updater key lives in `~/.tauri/tokenmaxxing.key`: losing it means installed apps can never update again.

## License

MIT. Based on [anaralabs/tokenleader](https://github.com/anaralabs/tokenleader).
