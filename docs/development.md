# Development

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

All art is drawn in code (palette-string sprites and rectangles), so the game carries no image assets.

## Running it locally

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

## Linux and Windows desktop preview

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
keep it off your real config with `TOKENMAXXING_CLI_DIR`, and off your real service with
`TOKENMAXXING_NO_SERVICE=1` (`run` and `unlink` would otherwise disable it):

```bash
export TOKENMAXXING_CLI_DIR=.data/cli TOKENMAXXING_NO_SERVICE=1
bun app/helper/src/cli.ts link <code> --server http://localhost:8787 --no-service
bash app/helper/scripts/cli.sh dist/cli    # the release binaries, for every platform
```

## Android companion preview

See [app/android/README.md](../app/android/README.md) for building the APK and connecting your existing
account. In the game on your computer: player card → Computers → **Connect phone**; scan the two-minute,
single-use QR in the Android app, or paste the code. The phone plays the same character while computers
keep syncing usage. The companion pairing changes must be deployed on the server before this works.

## 3D and graphics

The world runs on a voxel 3D renderer (Three.js, loaded only when needed) on the Medium, High and Ultra graphics tiers, and
on the classic 2D canvas on Low. **Auto** picks from the machine (High at most; Ultra is opt-in) and a frame-rate governor steps
down if it can't keep up; the **Graphics** panel (Esc menu) changes it.

```bash
bun run qa:tour                        # headless tour of the real game's rooms (needs a local server and Playwright; see scripts/qa/lib.mjs)
bun scripts/perf/counts.ts medium      # per-room draw and triangle counts, checked against the budgets
```

Architecture, the `Renderer` interface, the perf budgets and how to profile are in [ARCHITECTURE.md](../ARCHITECTURE.md#3d-and-graphics-where-to-look).

## Server config

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
| `SKY_WEATHER` | | Dev and screenshots: pins the weather and fetches none. `clear`, `cloudy`, `fog`, `drizzle`, `rain`, `storm`, `snow`, `frost` (freezing: ice, breath, scarves) or `pollen` (sneezes). `?weather=` in the page does the same for one browser |
| `GRID_FEED` | | `off` stops reading the power grid: no green hours (so no bonus), no price board and lamps at full |
| `GITHUB_TOKEN` | | Sent with the star counter's GitHub reads (a higher rate limit; no scopes needed). Without it, they go unauthenticated: 4 an hour, well inside GitHub's 60 |
| `GITHUB_STARS` | | Dev and testing: `480` pins the star count instead of reading GitHub (pin it past a milestone and restart for the fireworks); `off` reads nothing |
| `STATUE_FEED` | | `off` stops reading LMArena's leaderboard for the square's statue; the last leader read stays up. Pin one from the admin page instead |
| `RAID_LOOT_BOOST` | `1` | Dev and testing only: multiplies every raid drop's odds (1 to 1000), so `100` shows rare loot without waiting for luck. Leave unset in production |
| `SKY_SEASON` | | Dev and screenshots only: pins the town's season for everyone (`spring`, `summer`, `autumn`, `winter`, or a date like `11-12`). `?season=autumn` does it for one page |
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

## Releases

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

