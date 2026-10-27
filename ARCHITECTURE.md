# Architecture

tokenmaxxing is a small pixel-art town for people who run AI coding agents. The desktop app syncs your token
usage from the menu bar and shows the town in its window. Everyone is in **one world**. You work for at most one **company**, which has a house in
town; when you're not playing, your character sleeps in its bed, or sits at its desk while your agents run.

```
Tokenmaxxing.app (Tauri v2, app/desktop)             server (one Railway service)
├─ menu bar: ⚡ tokens today, menu                   Bun.serve (server/src/main.ts)
├─ sidecar: TS helper ◄─ NDJSON ─► Rust ───────────►  ├─ /               the marketing site (site/, Astro, built in the image)
│    parses logs, player.ingest()                     ├─ /play           the game (web/, bundled at boot)
│                                                     ├─ /admin          the admin page (web/admin.html)
│                                                     ├─ /logos/:file    company logos (sandboxed)
├─ game window: Canvas 2D world + React HUD           ├─ /health
│    (the live page, over WebSocket) ◄─────────────►  └─ /api/rivet/*    proxy to the Rivet engine (gateway only)
└─ Keychain, login item, updater                      Rivet engine on 127.0.0.1, actors in this process,
                                                      storage on the /data volume
```

The game also runs in any browser; the app's window is that same page, at `/play`.

| Path | What |
|---|---|
| `core/` | Sync (log parsing is the `llm-usage-extraction` package; GitHub PRs are `sources/github.ts`), the shell↔helper protocol, `world.ts` (shared rules), `maps.ts` (the maps), `shop.ts` (coins and items), `office.ts` (offices and furniture), `tavern.ts` (the `TAVERN` flag, the daily special, the net cafe's clock), `keynote.ts` (the keynote watch party: admin-scheduled launch events on the Tavern's projector screen, see *The Tavern*), `clocks.ts` (the Tavern's world clocks: SF, New York and Copenhagen off Intl, and SF's working hours as the launch window), `launch.ts` (the new-model stand: `world` reads OpenRouter's public model list every 10 minutes, and a model from the pool of providers stands at the square's left edge from when it's listed until 18:00 that day, or 18:00 tomorrow when it's listed after 16:00), `barkeep.ts`, `themes.ts` (the rooms' background music, same note format as the jukebox's `tunes.ts`), `quests.ts`, `badges.ts` and `collection.ts` (badges and the collection log), `agentType.ts`, `regulars.ts`, `games/` (every game's rules), `format.ts`, `range.ts`, `sky.ts` (sun, moon and weather maths for Copenhagen), `windmill.ts` (the windmill by the Tavern: how fast its sails turn for the weather's wind, and how its cap winds round to face it; each client eases its own, the server keeps nothing), `stars.ts` (the star counter on the square: the repo, its milestones, and what a read of the GitHub stars does to `world`'s state), `fireworks.ts` (a show's rockets worked out from its start, place and seed, so every client draws the same ones without the server sending more than the show), `grid.ts` (the power grid: green hours, expensive power, the green bonus) |
| `server/src/actors/` | The actors (`player`, `town`, `world`, `arcade`, `match`), `registry.ts`, `shared.ts` (auth and SQL helpers) |
| `server/src/town/` | What `town` does, as plain functions: `users`, `companies`, `boards` (leaderboards, profiles, the HUD's corner), `games` (game stats), `coins`, `quests`, `awards` (badge awards and their sweep), `hall` (the Hall of Fame), `card` (bios, showcase, habits, the Tavern's minutes), `sync` (pushes to `world`) |
| `server/src/` | `main.ts`, `proxy.ts`, `headers.ts` (CSP and friends), `brand.ts` (websites → house colours and logos), `pricing.ts`, `stats.ts`, `validate.ts`, `weather.ts` (one Open-Meteo fetch per 15 min, for the `world` actor), `github-stars.ts` (the repo's GitHub stars, one REST read per 15 min for `world`; `GITHUB_TOKEN` optional), `grid.ts` (Energi Data Service's CO₂ every 15 min and prices hourly, for `world`), `tavern-clock.ts` (the minutes `world` counts in the Tavern) |
| `web/src/` | `game/` (canvas loop, input, camera, houses, labels, pets), `art/` (every sprite, drawn in code), `hud/` (React panels), `render3d/` (the 3D renderer: `engine/`, `kit/`, `people/`, `pets/`, `furniture/`, `rooms/`, `town/`, `dungeon/`, `shops/`, `data/`), `settings/` (graphics tiers, detection, governor) |
| `app/helper/` | The sync helper: log parsing and `player.ingest`, run by the app as a sidecar |
| `app/desktop/` | The desktop app (Tauri v2): the menu bar, the game window, updates |
| `site/` | The marketing site at `/` (Astro, static): `bun run site:dev` to work on it, `bun run site:build` before serving it |

## 3D and graphics: where to look

The game draws through a `Renderer`; on Medium and up that is a Three.js voxel renderer (`web/src/render3d/`).

| Topic | Where |
|---|---|
| Graphics tiers (Low / Medium / High / Ultra, Auto), overrides, saved settings | `web/src/settings/graphics.ts`; hardware detection `detect.ts` and its pure scoring `score.ts` (Auto never picks Ultra: it is opt-in, and a laptop saving power is biased to Medium); the FPS governor `governor.ts`; the Graphics panel `web/src/hud/Graphics.tsx`. See "The client" and "3D performance" below |
| The `Renderer` interface | `web/src/game/renderer.ts` (`Renderer2D` wraps `render.ts`; `render3d/index.ts` `create3D()` is loaded on demand). `game/stage.ts` runs the loop and swaps them |
| The 3D architecture | `web/src/render3d/`, by area: `engine/` (pipeline, camera `rig.ts`, overlay labels, batching, picking), `kit/` (the modelling kit), `people/` (avatars, gear, `entities.ts`), `pets/`, `furniture/`, `rooms/` (the world graph, the rooms registry `rooms.ts`, the Tavern, basement and HQ), `town/`, `dungeon/`, `shops/`, `data/`. Described in "The client" |
| The camera and the HUD | `rig.ts` centres the player and the room's framing in the area the HUD leaves free: `game/inset.ts` measures the HUD panels' real rects (resize, panel open and close) into `hudInset`, and `CameraRig.setInsets` eases the picture there. On a phone (`useNarrow`, under 700 px wide or 500 px high) chat, map and corner cards fold into a tray of icons |
| Name tags in a crowd | `render3d/engine/declutter.ts`: nearest keep their place, the next stack up, the rest hide, farther ones fade, capped by tier (`tagCap`); no per-frame allocation |
| Perf budgets and how to profile | "3D performance" below: `web/src/render3d/perf/budgets.ts` (checked by `web/test/perf-budget.test.ts`), `scripts/perf/*` |
| The shops and `ShopBackend` | "The physical shops (ShopBackend)" and "The shops" below. The pet shop builds in slices as you near its door (`warmShop` in `render3d/shops/catalog.ts`, `render3d/rooms/warm.ts`) so entering it does not hitch a frame |
| The common room | "The common room" below (`core/src/common.ts`, `render3d/rooms/room-furnished.ts`) |
| Manual QA of the real game | `scripts/qa/*.mjs` drive it headless with Playwright against a local server (`bun run qa:tour`, `qa:sleep`, `qa:hitch`; others run with `bun scripts/qa/<name>.mjs [tier]`). Set `localStorage["tokenmaxxing.qa"] = "1"` for the `window.__tm` handle (`game/qa.ts`) |
| Blocked storage | Everything in `web/src` reads and writes `localStorage` through `web/src/storage.ts`, which falls back to memory (private mode, blocked cookies) instead of throwing |

## Serving

- `main.ts` bundles the game with `Bun.build`, *then* starts the registry. Once RivetKit's native runtime is
  up, Bun's HTML bundler fails in the same process, so there's no hot reload: restart `bun run dev`.
- `registry.start()` runs the Rivet engine on `127.0.0.1`. `proxy.ts` forwards only the client gateway
  (`/api/rivet/gateway/*` and `/metadata`, HTTP and WebSocket); the engine's admin API is never exposed.
- The gateway would let a browser create any actor, with any key and input. `gatewayAllowed` lets through
  only existing actors (by id, or `get` by key) and `getOrCreate(["main"])` of `town`, `world` and `arcade`,
  with no input. The actors check too: `player` and `match` refuse to be created without `INTERNAL_KEY` in
  their input (`fromInside`), and the singletons refuse any key but `main` (`requireMain`). Otherwise
  anyone could make `player[<the next id>]` with their own token and own the next account.
- Per client IP, the proxy allows 1,200 gateway requests and 300 new WebSockets a minute
  (`GATEWAY_REQUESTS_PER_MIN`, `GATEWAY_SOCKETS_PER_MIN`). The IP is `CLIENT_IP_HEADER` (`x-real-ip`, set by
  Railway's edge) or the socket's; the proxy passes it on to actors as `x-tokenmaxxing-ip`, replacing any
  the client sent.
- `/play` and `/admin` send a CSP (`headers.ts`): our own scripts only, connections only back to us (and the
  desktop app's IPC for the game), no framing. The page files aren't served at their own paths.
- `RIVET__GUARD__TCP_NODELAY=true` turns off Nagle on the engine's sockets. Actors and the engine talk over
  loopback, and without it each actor call waits ~40 ms on a delayed ACK. The runner's end of that connection
  has no such switch yet (rivetkit 2.3.21), so a call still pays some of it.
- `RIVETKIT_STORAGE_PATH`, `RIVET_LOG_LEVEL` and `RIVET__GUARD__TCP_NODELAY` must be real environment
  variables: RivetKit's native side ignores `process.env` changes made at runtime. The Dockerfile and `bun run dev` set them.
- Company logos live next to the Rivet data (`/data/logos` in Docker, `.data/logos` in dev).
- A sync batch is about 300 KB, so `maxIncomingMessageSize` is 1 MB. Shutdown grace is 5 s.

## Auth

- Tokens are `<userId>.<secret>`; the `player` actor stores `sha256(secret)`. Other actors check a token by
  asking that player (`authenticate` in `shared.ts`, cached for a minute) and trust only the caller they get.
- Actors call each other with an in-process `INTERNAL_KEY`.
- **Open world:** the app's window loads `/play`. With no session, the page asks the app (`enter_world`), whose
  helper mints a one-time login code (2 minutes); the page redeems it for a 30-day session. With no account
  yet, the page asks for a name first and the app signs up. The device token never leaves the app.
- A browser can still be signed in with `/#code=…`: the page redeems the code and removes it from the URL.
- The app forgets its token when the server rejects it and goes back to picking a name.
- There's no web sign-up: in a browser, without a session the page says to open the world from the app.
- **Linked computers** (a second machine running agents; see below). The app mints a link code
  (`mintLinkCode`, 10 minutes, single use); the other computer trades it for its own token
  (`redeemLinkCode`). That token only syncs: it can `ingest` and read `town.today` and `arcade.battle`
  (`requireSyncer`), and `requireUser` refuses it everywhere else. The player lists them (`devices`) and
  removes them (`revokeDevice`); a computer can remove only itself, and nobody can remove the app's own.
- **Admin:** `/admin#token=…` keeps the token in `localStorage`, drops it from the URL, and connects to `town`
  with `{ admin: token }`. A fragment never reaches the server, so the token stays out of logs (`?token=`
  works too, but does reach it). `authenticate` checks it against `ADMIN_TOKEN` (constant time; unset lets
  nobody in, and under 32 characters fails the boot). Only `town`'s `admin*` actions accept that caller.
- Login codes, link codes and sessions are capped per player (5 live codes of each kind, 20 sessions; the
  oldest go first).

## The desktop app

`app/desktop/src-tauri/src/`, in Rust:

- **`helper.rs`** runs the helper sidecar (Bun-compiled) and speaks the NDJSON protocol in
  `core/src/protocol.ts`: `init`, `signUp`, `syncNow`, `openWorld` (a login code) and `linkComputer` (a link
  code and the line that uses it), and `state` and `token` events. It
  restarts the helper with backoff. A fixture written by `app/helper/test/protocol.test.ts` keeps the Rust
  types and the TypeScript ones in step.
- **`tray.rs`**: the menu bar. The bolt is a template image with today's tokens as its title. Its menu:
  - Open world;
  - your rank and level, today's tokens per source (Claude Code, Codex, …, as the server has them), and the
    battle you're in;
  - Sync now;
  - Link a computer… (copies the line to run on the other computer);
  - Launch at login;
  - updates;
  - Quit.

  It's rebuilt from the helper's state after every sync: every 2 minutes, or every 10 seconds during a battle.
- **`world.rs`**: the game window, the app's only window.
  - It loads the live page (`/play`) once the helper knows whether there's an account, and opens by itself
    when there isn't one. It stays on the server's origin; other links open in the browser.
  - The page, from the server's origin only, may sign itself in (`enter_world`: a login code, after signing
    up if it's given a name), ask about app updates and start one (`update_status`, `install_update` and
    their `app-update` event), and get the line that links another computer (`link_computer`). The capability is added in `lib.rs`, since it names the server. App commands
    are otherwise denied (`build.rs`).
  - The app is in the Dock only while the window is open (`LSUIElement`, then the activation policy).
- **`keychain.rs`**: the device token, in the login Keychain as `dk.hanskristoffer.tokenmaxxing` /
  `api-token`. Dev builds use `….dev` and their own state dir.
- **`updates.rs`**: Tauri's updater. It checks `latest.json` on this repo's latest release on launch and every
  hour. With no window open, a new version installs right away and the app restarts. While the game is open,
  it waits: the game shows an "Update" button (`web/src/hud/AppUpdate.tsx`) and the menu an "Update to…"
  item, and it installs when either is clicked or the window closes. After an update started with the game
  open, the game opens again. Downloads must be signed with the key in `TAURI_SIGNING_PRIVATE_KEY`, and the
  release job checks the published one against the app's public key before anyone installs it.
- **Plugins:** single-instance (a second launch opens the world), window-state, autostart (a LaunchAgent) and
  log.
- **The server URL** is baked in at build time (`TOKENMAXXING_SERVER_URL`). A release build refuses to build
  without it; a dev build uses `localhost:8787`.

## Linked computers

A second computer running agents syncs into the same player.

- **The CLI** (`app/helper/src/cli.ts`) wraps the same `Helper` as the app: `link`, `run`, `sync`, `status`,
  `logs`, `unlink`. Its token and read positions are in `~/Library/Application Support/Tokenmaxxing CLI/` or
  `$XDG_CONFIG_HOME/tokenmaxxing/` (`TOKENMAXXING_CLI_DIR` for tests), the token readable only by its user.
  It won't link on a Mac where the app syncs already.
- **The service** (`service.ts`): a LaunchAgent, or a `systemd --user` unit with lingering on, so it runs
  while nobody's logged in. Both carry the `PATH` and log-location variables from when it was linked, and
  restart it only when it fails: once its token is revoked, it removes itself and exits cleanly.
- **Installing** (`server/src/install.sh`, served at `/install.sh` with the server's own origin filled in):
  picks the binary for the OS and CPU, checks it against `SHA256SUMS` from the latest release, and runs it
  with its arguments. The binaries are `bun build --compile` output (`app/helper/scripts/cli.sh`), built on a
  Mac so the Mac ones are signed ad hoc; curl doesn't quarantine what it downloads.
- **The game** shows your computers on your own card (`web/src/hud/Computers.tsx`) and removes them; only the
  app's window can make a link code.

## Actors

**`player[userId]`**: raw events (SQLite, deduplicated), devices (the app and linked computers), sessions,
login codes and link codes. Events from every device land in the same table, so a linked computer's usage
counts everywhere with nothing else to add up. `ingest` stores a
batch, recomputes the touched world days (per-model sums, prompts, PRs, 5-minute agent buckets) and sends them
to `town.report`, then tells `world` how many agents are live, and `arcade.usage` in case they're in a battle.
- **The numbers come from the user's own machine,** so they're bounded rather than trusted: an event over 1B
  tokens in any field, or stamped over an hour ahead, is dropped (`validate.ts`); model names that aren't
  model-shaped count as `unknown` (they're shown on profiles). Each minute counts for at most 200M tokens
  (`USAGE_MINUTE_CAP`; a busy real day is ~1.5B): past it, that minute is scaled down and the rest goes in
  `capped_daily`, which flags the account on the admin page. That also keeps every `SUM` far below SQLite's
  64-bit limit, where it would throw and take the leaderboards down.
- Per player: 60 ingests a minute and 500,000 new events a world day. Past either, the app's sync fails and
  picks up where it stopped on its next run, so a big first sync is delayed, never lost.
- `claude_cloud` and `codex_cloud` are not accepted from a device. They arrive only from the organization
  feed (`docs/org-usage-feed.md`): an opted-in player, bearer token in `ORG_FEED_SECRETS`, idempotent
  `org:<orgId>:<id>` message ids. A cloud row with the same model and token counts as a local
  `claude_code` / `claude_cowork` / `codex` row within two minutes is dropped, and a later local row
  deletes the cloud row. The day cap still applies; the device's per-minute ingest limit does not.

**`town["main"]`**: everything cold, joined in SQL.
- Tables: `users`, `companies` (ids never reused), `usage_daily`, `activity_daily`, `capped_daily`,
  `purchases` (coins spent, per kind), `items` (one row per copy anyone holds), `rewards` (level rewards
  handed out), `loot` (raid drops handed out), `ledger` (coins held and paid by games, and traded), `trades` (one open offer per sender),
  `offices`, `company_ledger` (company wallets), `match_players` (one row per player per finished game),
  `quest_days`, `quest_counts`, `green_hours`, `badge_awards`, `bio_reports`, `showcase`, `tavern_daily`, `keynotes`,
  `deleted_users`, `lost_signups` (ids of sign-ups whose `player` failed to start), `admin_log`,
  `org_feed_links` (org id + email → player; the opt-in), `org_claims` (hash of a one-time link code).
- Accounts: `signUp` (20 an hour per IP, 1,000 an hour in all), `rename` (10 an hour), `setLook` (refuses items you don't hold), `me`.
- Companies: create (on a plot the owner picks: any empty block next to the town, see `frontier` in
  `core/src/maps.ts`), leave, kick, rename, `setWebsite`. One company per person, at most 50 members. The
  earliest joiner takes over from a leaving owner; the last one out closes the company. The town is built from
  its companies' plots (`townMap`), so it grows as they start and shrinks, or gets a park, as they close.
- Joining: `listings` shows every company; `apply` asks to join one (one pending application per person,
  applying elsewhere replaces it); the owner will `approve` or `decline`, and `withdraw` takes it back. The
  owner hears about an application, and the applicant about the answer, through `world.notify` (a `notice`
  event, shown as a toast). A new player's first visit opens this choice.
- Stats: `leaderboard`, `profile`, `today` (the HUD's corner), `searchNames`, `gameBoard`. Cost is priced
  when read.
- Coins: `wallet`, `buy`, `bag`; for `arcade`: `hold`, `pay`, `refund`, `recordMatch`. Games: `gameBoard`.
- Trades: `offerTrade` (10 an hour; a new offer replaces your old one), `trades`, `acceptTrade`,
  `declineTrade`, `withdrawTrade`. See *Coins and the shop*.
- Office decor: `setDecor` and `buyDecor` (wallpapers and floors), `setDesk` and `buyDesk` (desk setups), `buyDeskFleet`
  (a company's), `openOffices` (who is open and who's in them); `setDecor` shares the next limit. See *Offices v2*.
- Offices: `setOfficeOpen` (your own, from level 10; 30 a minute, since each one sends the office and its
  building to everyone inside). What's in an office is what its owner dropped there.
- The Tavern's: `questBoard`, `hallOfFame`, `collection`, `regulars`, and for the card `setBio`
  and `reportBio` (5 an hour each), `setShowcase`. See *The Tavern*, *Quests*, *Badges and the Hall of Fame*
  and *The player card*.
- Drops: `drop` (30 a minute) takes one of a kind out of your bag (not a reward; at most 5 of yours on the
  floor at once, not counting your own office's) and asks `world.placeDrop` to put it where you are; a full
  room says so, and the row comes straight back. On the floor a row has `owner_id` NULL, with `dropped_by`
  and `dropped_at`, and `room`, `x`, `y` once `world` has put it down (`placed`). `pickUp` (from
  `world.take`) puts it in the taker's bag, if it's still on that room's floor. **The sweeper** is a cron alarm
  (`sweep`, every 10 minutes; it outlives restarts and wakes the town): drops nobody took in an hour come
  off the floor (`world.removeDrops`) and go back to their droppers, except what's in its dropper's own
  office: that's furniture. A closed company's building and a deleted owner's office give theirs back at
  once (`removeCompany` and `removePlayer` return the ids), and so does a rebuilt town or building for
  drops it has no place for any more (`setCompany` and `setPlayer` return them); a deleted account's own
  drops are deleted with it, office furniture and all.
- Admin (`town/admin.ts`, for `/admin`): `adminOverview`, `adminUsers` and `adminCompanies`; rename people
  and companies; set a balance (the difference goes in the `ledger` as kind and ref `admin`); take someone
  out of their company; close a company; wipe someone's usage (their `player` drops its raw events too:
  `wipe`); delete an account; schedule, change and remove keynote watch parties (`adminKeynotes`,
  `adminSaveKeynote`, `adminRemoveKeynote`, `town/keynotes.ts`). Every change goes in `admin_log`, shown on the page's Log tab. Deleting drops their usage, activity,
  purchases, items, rewards, application and trade offers, hands over or closes their company, takes them out of `world`
  (`removePlayer`) and destroys their `player` (`close`), so every token and session stops working. It's
  refused while they have coins in an unsettled game. Their `ledger` and `match_players` rows stay, and
  `deleted_users` keeps new ids above theirs, so nobody inherits them.
- Every change a player could see is pushed to `world` (`town/sync.ts`); `world` asks `town` only to put a
  taken drop in the bag (`pickUp`), and for every floor and office lock (`seed`) when it starts, and for
  everyone too when it starts from nothing.

**`world["main"]`**: everything live, in actor state, with chat in SQLite (last 200 lines per room).
- A 10 Hz tick sends each room its `moves`, and who's inside each house (`houses`, for town) when it changes.
  Head counts (`occupancy`) go to every connection, so at most once a second: sent every tick, a burst of joins
  stalled the world at 300 connections. Someone's `info` (look, tokens today, agents, coffee, online) goes only
  to their own tabs and whoever is in their room: the game reads it for nobody else, and sent to everyone,
  each player's sync and each join went to every tab.
- **Messages, not CPU, are the limit.** Everything every actor sends goes through the engine's one connection
  to this process, about 3,000 messages a second; past that it all queues, `town` (and `/health`) too.
  A player walking costs about 15 a second (`moves` every tick, their step's answer, `occupancy`, chat), so
  that's about 170 players walking at once. `bun scripts/perf/load.ts` measures it.
- Actions: `join`, `step` (one adjacent walkable tile, no faster than running; doors change room), `sit`,
  `drink` (a coffee machine: each cup adds 90 s of shaking, up to 6 stacked, sent as `coffeeUntil` in `info`),
  `tavern` (the Tavern's tap: the day's special, sent as `specialUntil`), `toss` (a coin in the fountain),
  `say` (20 a minute; `@name` sends `mention` to someone in another room), `back` (after a game), `visit`
  (someone's open office, from their card), `take` (G: the drop you're on, or a blocking piece you face; on
  an office floor, only its owner).
- Events: `snapshot` (on joining or changing room), `moves`, `info`, `companies`, `occupancy`, `houses`, `notice`,
  `chat`, `mention`, `drop`, `pickup`, `stars`.
- **The star counter** (`★` on the square, `core/stars.ts`): every 15 minutes `world` reads the repo's
  `stargazers_count` (`github-stars.ts`) and sends `stars` (the count and the last milestone's show) when it
  changes, and on `join`. Passing a milestone (100, 250, 500, 1000, 2500…) puts a show in it, which every client
  turns into the same fireworks over the square (`core/fireworks.ts`), and the town says so in its chat. The
  count and the last milestone celebrated are in state, so a restart, or a count that dips under a milestone
  and comes back, never sets one off twice; the first read ever only notes the milestone already passed.
  Fireworks on the clock alone (a holiday) need no server: add a source in `web/src/game/fireworks.ts`, and
  both renderers draw it (`drawFireworks` on the 2D canvas, `Fireworks3d` in the 3D town's sky). `?fireworks`
  puts on a show when the page loads, for screenshots.
- From `town`, besides `notify`: `announceTown(text, open?)` sends everyone who has joined a `notice` and puts a
  system line in the town square's chat (badge golds and diamonds, level 30+).
- **Drops** (`DROPS`, in memory only: `town` has every floor, and a starting world forgets its own and lays
  them again from `seed`; at most 30 a room, 40 an office): a hat or a pet lies as itself on the dropper's
  tile or the nearest free one; furniture goes on the tile they face or the nearest free one to it, as
  itself in the room's map (`mapOf`), so a dropped sofa seats. Furniture never lands in front of a door, in
  a building's hallways or at the foot of the passage up to them, or where it would leave anyone in the room
  no way out. An office's map is the template and its drops. `take` lifts it off the floor first, then asks
  `town.pickUp`; if that call fails, it goes back down.
- **Resting.** Closing the last tab sends you to your bed; offline with agents active in the last 10 minutes, to
  your desk. Company members rest in their house, others at the Inn. Your spot is remembered: the next `join` puts
  you back there, unless it's a house you've left, an office that's closed or gone, or a tile that's a wall or
  furniture now (`back` after a game too); a seat that's gone, you wake standing where it was.
  Online with 3 minutes without input, you just doze where you are (`dozing`, drawn as a "z") until
  your next input, so a town left open on a second screen keeps showing what's going on.
- **The Inn's sleepers are a number.** Everyone without a company sleeps at the Inn, so its offline sleepers come
  as `asleep` in the snapshot (and in `moves` when it changes), drawn as "💤 N asleep", not one by one. They join
  the room when they wake up or sit down to work, and leave it when they fall asleep there. Company houses (50 at
  most) still show everyone.

**`arcade["main"]`** and **`match[id]`**: the mini games; see *Games*.

## Companies and houses

- A house's size follows its 30-day tokens **per member** (`houseTier`): basement, shack from 100M, cottage
  1B, house 5B, villa 15B, mansion 40B.
- **Websites** (`brand.ts`). The owner sets one; it goes on the sign at once. If `FIRECRAWL_API_KEY` is set,
  Firecrawl's `branding` format reads the site's colours and logo. Claude (`claude-opus-5-5`, low effort,
  structured output) turns them into roof, wall, trim and plaque colours; without `ANTHROPIC_API_KEY` the site's
  own colours are used. The logo is downloaded from public hosts only (no private or loopback addresses, a few
  redirects, images up to 512 KB), and served from `/logos/` with a sandboxing CSP.

- **The company wallet** (`company_ledger`). Every coin a member earns from tokens (`coinsForTokens`, not
  podiums or quests) is matched 1:1 into their company's wallet, on top of their own: `report` runs
  `matchCoins`, which adds what each touched day's coins grew by since it was last matched (kind `match`,
  ref the day), to the company they're in now, from the day they joined. Outsiders' merch purchases go in
  (`merch`), furniture comes out (`furniture`); an admin can set it (`admin`). Each row names who earned,
  bought or paid. The first migration back-filled current members' days since they joined.
- **Company furniture** (`COMPANY_FURNITURE`, 29 pieces drawn in `web/src/art/furniture-fancy.ts`): the owner
  buys from the wallet (`buyPiece`); any member puts pieces out (`placePiece`, down in front of them in the
  building) and takes them back (G) into the storeroom. Rows are `items` with `company_id` and no
  `owner_id`, so they're never in a bag, the sweeper leaves them, and they go when the company closes.
- **Merch** (`MERCH`): every company's tee, hoodie, cap and mug (`merch.<companyId>.<kind>`), in its colours
  with its initials, worn through `look.merch` and `look.merchWorn`. Outsiders pay full price, into the
  company wallet; members get `EMPLOYEE_MERCH_DISCOUNT` off (1.0: free, one of each). Not tradeable.

## Coins and the shop

- Each world day pays `√(tokens ÷ 1M)` coins (1.5B ≈ 38, 600M ≈ 24, 100M = 10). Finishing a day 1st, 2nd or 3rd
  adds 25, 15 or 10.
- Only days from the world day you signed up count, for pay and for podium places: a first sync backfills
  old logs, and those days would otherwise pay out (and win podiums nobody else was around for).
- Balances aren't stored: they're worked out from `usage_daily` minus `purchases`, so a late sync still pays.
- Three daily quests and a weekly one (`core/src/quests.ts`) pay up to 6 more a day and 15 a week. They're worked out
  from the day's rollups and the days' frozen picks, so no coin is stored; see *Quests*. Days before `LEGACY_FROM` keep the
  old rule (5 agents at once: 5, 2 hours of agents running: 2).
- **Green hours** (`core/src/grid.ts`, `server/src/town/grid.ts`): `world` reads price area DK1 from Energi
  Data Service every 15 minutes (`server/src/grid.ts`: `CO2Emis`, 5-minute g/kWh, the last 26 hours; and
  `DayAheadPrices`, quarter-hourly DKK/MWh, today and tomorrow, at most hourly) and sends everyone a `Grid` (the
  `grid` event, and on `join`). An hour is green when the hour before it averaged `GREEN_CO2` (75 g/kWh) or less over
  at least 6 readings, so it's decided as it starts and the banner and the coins agree. `world` hands each green
  hour to `town.greenHours`, which keeps it once (`green_hours`: world day and hour, from `GREEN_FROM`, never
  taken back), and tries again on its next read if that fails. `player` reports each day's tokens by world hour
  (`activity_daily.hour_tokens`, minute-capped like `usage_daily`), and a day pays `greenCoins` of the tokens
  in its green hours: a quarter of `coinsForTokens`, not in the streak and not matched into the company wallet.
  Nothing is paid out or stored as coins, so a late sync or an hour told late (the feed down, `world` restarted)
  only adds; a failed read keeps the last grid; `GRID_FEED=off` turns it all off. `wallet.green` is today's.
  On the client (`web/src/game/grid.ts`, `?grid=green|expensive|both|off`): the green banner
  (`hud/GreenHour.tsx`), the price board over the square's north-east lamp (`PRICE_LAMP`; 2D `game/grid-board.ts`,
  3D `TownEvents.gridFrame`), and the street lamps at `DIM_LAMPS` while power is expensive (`isExpensive`: the
  day's 75th percentile and at least `EXPENSIVE_DKK`, 1 kr/kWh). 2D dims the lamps' glow (`drawLights`); 3D eases
  the street lamps' point lights and their shared pool material (`setStreetLampDim`) in `Fx`.
- The catalogue (`core/src/shop.ts`): 4 outfits, 3 glasses, 3 hats, 5 pets and the 11 pieces of furniture
  (`furn.<ch>`), 10 to 1,500 coins. The raid's 20 loot items are in it too, never sold (see *The raid*). Items are worn through `Look` (`outfit` ≥ 8, `glasses`, `hat`, `pet`).
  Pets follow their owner in the client (`game/pets.ts`: `followPet`), except in the owner's own office,
  where they go to the bed and sleep (`art/pet-sleep.ts`: `sleepingFrame(petFrame(...), left, tick)` derives
  the curled pose from any pet's normal frame: legs and tail tucked, squashed, eyes shut, a breathing bob and
  rising z's; so every pet and every variation of one has it, cached per source canvas).
- **Pet looks**: every shop pet has variations (`PET_VARIANTS` in `core/src/pets.ts`: the ids, in a fixed order
  that saved looks depend on, so only append). `Look.petVariant` is 0 for the pet as the shop sells it and n
  for `PET_VARIANTS[pet][n - 1]`; `parseLook` refuses one `>= petLooks(pet)` (so any variant without a pet),
  and old looks parse as 0. Holding a pet unlocks all of its looks, free: `setLook` needs only the pet in the
  bag plus the bound. Taking a pet off or losing its last copy (`unwear`) resets the variant, and so does
  wearing another pet from the bag. The art is in `web/src/art/pet-variants/` (`variantArt`, `missingArt`;
  `petFrame(pet, left, hop, variant)` falls back to the original while art is missing); `web/test/pet-variants.test.ts`
  checks every grid. In the 🎒 a pet kind with looks has a 👁 button that opens `PetLooks` (the `petLooks`
  panel): every look hopping, the worn one marked; picking one wears the pet in it. Dropped and shop pets
  are always the original.
- **Pet names**: `Look.petName` (optional) is saved with the look: `cleanPetName` (`core/src/pets.ts`) trims it, makes
  runs of spaces one and allows letters, digits, spaces, apostrophes and hyphens, 1 to `PET_NAME_MAX` (16) long;
  `parseLook` refuses a bad one and old looks have none. The ✏️ in the bag names (and wears) a pet; an empty name
  clears it. In the world the name is a small label under the pet, for your own and for pets within a few tiles.
  `PET_NAMED` is a table of costumes (name, pet, look, art id) matched case-insensitively on the cleaned name by
  `petOutfit`; the art is in `web/src/art/pet-variants/named.ts` and `petFrame` takes it as its last argument, so it
  works in every frame, the sleeping pose and the picker. To add one: append a row, add its art.
- The wardrobe (`core/src/wardrobe.ts`, art in `web/src/art/wardrobe.ts`): 36 more, each with a rarity and a
  line of flavour: 12 outfits (`outfit` ≥ 13), and three slots of its own: `held` (in the hand), `back` and
  `petwear` (drawn on the pet). The rubber duck, cape and jetpack are level rewards at 5, 15 and 25.
- **The bag** (`items`, the 🎒 panel): one row per copy, so you can hold two Ducks; you can wear a kind if you
  hold one. Buying adds a row and adds the price to `purchases` (spend only, one row per kind); buying a
  kind you hold already is fine. `bag()` counts each kind. What's on a floor isn't in anyone's bag.
- **Milestones** (`core/src/milestones.ts`): levels go to 50 (130B lifetime tokens; past 30 the steps grow
  2B, 3B, 5B, 10B). Every tenth level gives a title for the player card, coins and an item: a top hat,
  server-rack armour, a Singularity orb, a Nebula visor and golden regalia, at 10 to 50. The coins are worked
  out from the level in `wallet` like the rest, so nothing is stored. Level 50 also draws a golden aura and halo
  and a crown on the pet, from the level alone (`web/src/art/aura.ts`). `report` hands them out as rows the first time a sync reaches the level (`grantRewards`, once each,
  recorded in `rewards`), with the office's desk and chair at level 10, dropped on its floor
  (`starterDrops`; in the bag if it has furniture already). `setOfficeOpen` hands them out too, for anyone
  who reached level 10 before offices had rows. Rewards are `tradeable: false`.
- **Trades** (from a player card): up to 🪙 500 and 4 items each way, for 7 days; not rewards, and not
  furniture on a floor (pick it up first). Accepting re-checks both sides under `serial` and moves everything in one
  transaction (`settleTrade`): coins through the `ledger` (kind `trade`), items by moving one row of each kind
  to the receiver. Spend stays in `purchases`, so balances don't change. A kind you no longer hold comes off
  your look. While an offer is open to or from you, a 🔁 beside the Bag opens your trades (`wallet.trading`).
- **Offices.** From level 10, every company member has one behind a door with their name on it in the
  company building (`office:<userId>`, one map template plus their furniture). The doors are in hallways of
  10 above the building's floor (negative `y`, `hqMap`), which `world` rebuilds when a door comes or goes.
  Furniture is the map legend's own pieces, bought into the bag and furnished by dropping: in your own
  office a drop stays (no hour, no five), at most 40, and only you take anything off its floor, a
  visitor's gift too. The Menu opens or closes it while you're in it; opening it clears its chat, so
  visitors never read what was said while it was closed. Anyone in the building walks into an open office;
  from outside, from the owner's card. The template has a **pet bed** in its bottom right corner: the map
  tile `Q`, a prop like a plant (not walkable, so nothing can be dropped on it and it can't block a path).
  While its owner is in their own office their pet walks to it and sleeps there, for everyone in the room to
  see; it's all drawn on the client (`game/pets.ts`), the server knows nothing of it. Sizes, wallpapers and the
  list of open offices are in *Offices v2*.

## The Tavern

The Inn is The Tavern: `MAPS.inn`, 28x19 (26x16 inside; the 3D room is built from the same plan), still room id `inn` (saved positions, `homeRoom` and the sleepers' count
all key on it). Its one exit `x` is still in the bottom wall, so `roomEntry` and `outsideDoor` work as before; the
`I` door in town is unchanged.

- **`TAVERN`** (`core/src/tavern.ts`, `true`) is one switch, read by client and server alike. Off, the map is the old
  16x10 Inn and there's no barkeep, no `tavern` action, no regulars' minutes, no game feed for the basement, and
  quests keep their old rule (`paidFrom` becomes "never", `freezeDays` and `questEvent` do nothing). Tables and
  columns stay. The Hall of Fame, badges and the card aren't behind it.
- **Tiles** (`LEGEND`; E acts on the one you face, `interact` in `web/src/game/input.ts`):
  - `m` quest board and the bar `a`: the quests panel. `J` the bar tab on the west wall and `P` a plaque: the regulars. `A` the wall: the Hall of Fame.
    `K` chalkboard: a dialog with today's special. `◷` the world clocks: a dialog with the time in each city and the launch window. `$` the tip jar on the bar (`tosses`, like the fountain): a coin in. `O` coat stands by the door.
  - `y` the tap (`serves`): the `tavern` action. `o` the coffee machine, as everywhere.
  - `v` a stool: sits (a `chair`-kind seat). `b` the dorm's beds.
  - `n` table, `f` hearth, `h` barrel, `k` shelf: a line of text. `e` the stage (walkable).
  - `S` stairs down to the basement (south-east corner), `u` stairs up to the dorm (south-west), `x` the exit.
- **The barkeep's cell** is the rug behind the bar (`=`, not `_`: `restSpot` puts sleepers on free `_` tiles, so nobody
  is bedded there), walled in by shelves and the bar. `tidyInn` runs when `world` wakes: anyone saved on a tile that
  is a wall or furniture now, or can't reach the door, goes back to bed or the door, and a sitter with no seat under
  them stands. The "💤 N asleep" count works as before.
- **The special** (`SPECIALS`, 49 lines, the same for everyone): `specialOn(at)` walks the list by Copenhagen day with a
  stride of 17 (`STRIDE`, coprime with the length, so every one comes round before any repeats). E at the tap
  (`world.tavern`) sets `specialUntil = now + 15 min` (`SPECIAL.ms`) and is refused while it's running. It's
  free and cosmetic, like coffee: no ledger row, no pace. The effect is `jitter` (the coffee
  shake) or `glow`, alternating by the day it was served (`buffOf`, `specialBuff(until)`), so `specialUntil` is the
  only field on the wire. The chalkboards in town and in the Tavern write the day's line.
- **The world clocks** (`◷`, two wall tiles on the north wall between the request pile and the hearth's plaque, where the
  3D Tavern had a window; `core/src/clocks.ts`): San Francisco, New York and Copenhagen, west to east. Pure and
  clock-driven like the street's things: each city's time and daylight saving come from Intl (`cityTime`), never a fixed
  offset, so in the weeks the US and the EU are out of step (mid March, late October) SF is 8 hours behind, not 9, and
  the window lands at 17:00 here. The launch window (`inLaunchWindow`) is SF's working day, Monday to Friday 09:00 to
  17:00 there, when US model launches tend to land: SF's lamp is on and its face glows, a sign over the clocks says so,
  and E says it's time to watch the launch stand (`clocksLine`), or when the next window opens, in Copenhagen time
  (`nextWindow`). `web/src/game/clocks.ts` works the hands out once a minute for both renderers; no server state.
- **The barkeep** (`BARKEEP`, `core/src/barkeep.ts`; id -4, the cop is -3) is a bot in `BOTS` only with `TAVERN`.
  `home` puts him on the rug on every wake and `still` keeps `walkBots` off him. His lines (`lineFor`, shared with
  the other bots, said as bubbles and never in chat, only with someone in the room) come a third of the time from the
  room's state: a busy room (`BUSY_CROWD`, 5 people), the weather (`world`'s current
  one) and the day's special (`{special}`); else half the time from the hour and weekday (`moments`), else any.
- **Evening** (`web/src/game/tavern.ts`, `inn` only; rooms get no sky of their own): the hearth fire, wall sconces
  and a candle on every table and the tap are drawn, and after dark the room dims by the sky's darkness times 0.4
  (`darknessNow`), the fire and candles glow through it, and `♪` drifts up from the stage once it's dark enough.
  The regulars' plates are drawn here too.
- **Jukebox** (`J` on the Tavern's west wall; E opens the `jukebox` panel). Free and cosmetic. `core/src/jukebox.ts`
  holds the rules: one track at a time, 60 s between a player's own starts, skip at 2 votes or the majority of a
  room of one or two (`skipNeeded`), votes of people who left don't count. The `world` actor keeps
  `{track, startedAt, by, skips}` in memory (`vars.jukebox`; a restart stops the music) and sends everyone online in
  `inn` a `jukebox` event (track, how far in, votes); the tick ends a finished or skipped track, and `join` or a
  move into `inn` sends the current one. The six tunes are note strings in `core/src/tunes.ts`, played by
  `web/src/game/jukebox.ts` with WebAudio (oscillators and noise, no files), looped for about a minute. Any other
  snapshot or a closed connection stops it; mute and volume are kept in localStorage. Actions: `jukeboxPlay`,
  `jukeboxSkip` (each returns a reason or null).
- **Poker** (a 4x2 table of `♠` and six `♣` chairs in the Tavern's middle; E on a chair buys you in). Texas Hold'em
  at 1/2 blinds for 🪙 50 a seat, from the wallet. `core/src/poker.ts` is the whole game, pure: the deck (Fisher-Yates
  over `crypto.getRandomValues`, `randomInt`), `evaluate` (a hand as one number: category, then base 13 kickers, wheel
  included), the betting round (`act`, `legal`: min-raise, a short all-in doesn't reopen, all-in as a raise to the stack),
  side pots (`pots`), the clock (`tick`: 25 s a turn, a check if free else a fold, two timeouts in a row stand you up, 5 s
  between hands) and what each side may see (`view` has no hole cards, `holeOf` is the owner's). `core/src/pokertable.ts`
  reads the chairs off the map, clockwise from the top left: seat `i` of the engine is chair `i`. The `world` actor keeps
  one `Table` in `vars.poker` (memory only) and sends the room `poker` (the table, names, clocks as ms left) whenever its
  `v` changes, and each player their own cards as `pokerHole`; neither is ever in a snapshot or a log. Actions:
  `pokerSit` (facing a `♣` chair), `pokerAct` (`fold`/`check`/`call`/`raise` with the total to raise to; the rate
  limit is `POKER_PER_MIN`), `pokerLeave`; each returns a reason or null. Walking out of the Tavern, closing the last
  tab or leaving stands you up: a hand in play is folded first and the seat goes when it ends. Coins move only in the
  town (`town/poker.ts`, under the town's `serial`, in a transaction): sitting down debits the buy-in (`BUY_IN`) to the `poker:inn`
  ledger ref and writes a `poker_seats` row; standing up pays the stack back; `pokerSettle` writes every stack after a
  hand and refuses stacks that don't add up to what the rows held, so the table can't make or lose a coin. A loss limit of
  🪙 150 a UTC day (buy-ins counted, from the ledger) refuses a seat with a `UserError`. A `world` that wakes without
  its table asks the town to give every row back (`pokerRelease`). A seat counts as a game played: standing up with
  a different stack than the buy-in writes one `match_players` row (`game` `poker`, a negative `match_id` so it never meets an
  arcade match, stake the buy-in, won the stack), so it counts toward quests, the card, the Hall of Fame and Variety. The client: `hud.poker` / `hud.pokerHole`
  (`net.ts`), the docked `hud/Poker.tsx` (cards, pot, clock, fold/check/call, raise slider, leave), `game/input.ts`
  (E on a chair; no walking while seated), the 2D table (`art/tavern.ts pokerTable`, board, pot and stacks drawn by
  `game/poker.ts`) and the 3D one (`render3d/rooms/poker3d.ts`: felt, rail, chips and cards laid by `show`; `render3d/rooms/poker-events.ts`
  puts a name, stack and clock over each seat). Tests: `core/test/poker.test.ts` (rules, side pots, chip conservation),
  `server/test/poker.test.ts` and `poker-town.test.ts`, `web/test/poker.test.ts`.
- **The basement** (`MAPS.basement`, 22x13, room `basement`): the net cafe under the Tavern, open to everyone. `S`
  takes you down and its one exit `x` up (`roomEntry(room, ch = "x")` and the portal branches in `core/src/world.ts`).
  It's never a home room; idlers doze there like anywhere. Time in it counts for the plaques (`isTavernRoom`).
  - `C`, five cabinets, one per game in `CABINET_GAMES` order: E opens a new table for that game, or the lobby if
    you're at a table or in a match. Matches still gather in the town square.
  - `E`, the big screen: the three oldest live matches (`feed`) with game, headline, countdown, players and
    watchers; E or a click spectates. It draws only what `WorldGame` already tells everyone (headline, status,
    board, watchers), never a match's state. `sendToScreens` in `world` sends `game` and `gameOver` to the town square
    and, with `TAVERN`, the basement; callouts stay in town. A snapshot carries the live games.
  - `M`, two wall terminals: the left opens the leaderboard, the right the raid. Their glass shows today's top three
    as bars and the boss's HP from what the HUD has already.
  - Light (`lightBasement`): a constant dim with glows from the screen, PCs, cabinets, rack LEDs and the neon sign.
    On Fridays and Saturdays from 18:00 Copenhagen (`isLanParty`) the neon pulses faster and the screens go magenta.
    Lighting only: it changes nothing else.
  - `u`, the tournament board (`core/src/tournament.ts` rules, `server/src/town/tournament.ts`, table `tournaments`,
    `town.tournament*`, panel `Tournament.tsx`): anyone opens one single-elimination bracket of 4 or 8 for a
    head-to-head game (`spr`, `hype`, `dice`, `sprint`; not Tokenmaxxing), one live at a time. It starts when
    full, or 5 minutes after opening with 4+ signed up (byes fill an 8; nothing ticks, so a due bracket starts the
    next time anyone loads the board or signs up). Matches are played at normal tables in the town square: the
    arcade's `settle` tells `town.tournamentResult` the two players and the winner of every 2-player match, and a
    waiting pairing of the running bracket for that game counts (ties and void are replayed; no confirm buttons).
    An idle bracket is called off after 2 hours. While one runs the big screen shows the round's pairings instead of
    the feed; the last champion's name sits under the board and a crown by it in chat until the next one. Nothing
    is paid: no coins, no edge, no reward for burn.

- **Request pile** (`?` on the Tavern's north wall; E opens the `requests` panel `Requests.tsx`). A corkboard where
  anyone writes what they'd like in the game (`core/src/requests.ts` rules, `server/src/town/requests.ts`, tables
  `requests` and `request_votes`, `town.request*`) and everyone can 👍 it: 8 to 280 characters on one line, no
  links (`parseRequest`), 5 open ones a player, a minute between posts, no repeat of one already open. The pile
  reads planned first, then open by 👍, then the last few done or turned down. Authors take back their own open
  request. The admin page's Requests tab marks each open, planned, done or not now, or removes it (logged);
  deleting a player takes their requests and 👍 with them. Free: no coins. `@feedback <text>` in the chat pins one
  too (`Chat.tsx`). In production each new request is POSTed as JSON (`id`, `userId`, `name`, `text`,
  `createdAt`) to `NEW_REQUEST_PUSH_URL` (`request-push.ts`, retried in the background), a T3 Code webhook that
  starts an agent thread on it; unset sends nothing.

- **Keynote watch party** (`core/src/keynote.ts` rules, `server/src/town/keynotes.ts`, table `keynotes`). A big AI
  launch event (OpenAI DevDay, Google I/O, an Anthropic event) can't be detected for free, so an admin schedules it on
  the admin page's Keynotes tab: a title, a host, a start and an end (12 hours at most) and an https stream link
  (`parseKeynote` in `validate.ts`; times are entered in the admin's browser time and stored as epoch ms). Saving or
  removing one is logged and pushed to `world` (`world.setKeynotes`); `world` also asks `town.keynotes` every 5 minutes,
  keeps the ones still to come or on (`upcoming`, at most 20) in memory and sends them as `keynotes` on join and on a
  change. Live or not is the clock's (`liveKeynote`, `screenOf`), so nothing ticks for it. A week before
  (`ANNOUNCE_MS`) a poster hangs on the west wall beside the stage (`SCREEN`, map tiles x 0, y 10 to 14: wall, off the
  map, so 2D and 3D keep the same tiles) and the barkeep's `keynoteLines.soon` say what and when (`whenText`). While it's
  on, a projector screen comes down there with the event, LIVE and its stream; the projector over the crowd throws a
  beam at it. The town's wandering characters (`GOERS`: not the barkeep, the cop or the shopkeepers) walk to the Inn's
  door, go in and stand in the crowd facing the screen (`CROWD`, `partyStep`), hop (`jump`) and cheer (`CHEERS`, more
  often than they talk), and walk back out when it ends. Every 5 seconds whoever is online and awake in the Tavern gets
  the 📽️ Watch party badge (`town.keynoteWatched`: a `rewards` row `keynote:<id>`, so once per keynote; the badge counts
  them, `quiet`) and a notice. The client: `game/keynote.ts` (the 2D screen, poster, beam and sign; E from the stage
  facing the wall opens the panel), `hud/Keynote.tsx` (a banner with the stream while one is on, and the panel listing
  what's on and coming with links), `render3d/rooms/keynote3d.ts`. `?keynote=live`, `live:Google I/O`, `soon` or `off`
  forces it in the page for screenshots (only there: the bots and the badge follow the server).

## Quests

Three a day, one per tier, plus one a week (`core/src/quests.ts`, `server/src/town/quests.ts`).
- **The pool** (`POOL`, 13). Tier 1 pays 1 coin: use tokens (`warm`), send prompts, keep agents running; and four
  in-town ones: coffee at the Tavern (counted in the `inn` room only), sit on a bench, read the morning paper, toss a
  coin in the fountain. Tier 2, 2 coins: agents at once, ship PRs (only if their baseline has PRs), two models (only
  if they've used two on a day), finish an arcade game. Tier 3, 3 coins: a long run of agents, a swarm.
- **Dealing** (`dailyQuests`): seeded by the Copenhagen day (`quests:<day>`), so the same day and baseline give the
  same three. Tier 1 is an in-town quest 30% of the time (only tier 1 has any, so at most one a day), and none of
  yesterday's ids repeat unless nothing else is left. A day pays at most 6.
- **Targets** scale to the player: `baselineOf` takes medians over their active days (tokens, a prompt, or an
  agent running) in the 30 days before today, and with fewer than 3 (`MIN_BASELINE_DAYS`) the targets are the floors.
  Each has a floor and a cap (`warm` 2M to 25M tokens, prompts 10 to 150, agents at once 2 to 6, a swarm 4 to 8, PRs
  1 to 3, run lengths 6 to 24 buckets and 12 to 72), so a light player always gets three they can do and a heavy one
  isn't paid more for burning more.
- **Stored** is only the deal and the in-town counts. `quest_days (user_id, day, picks)` freezes a day's picks and
  targets (`freezeDay`, `INSERT OR IGNORE`, so a later sync can't move them) when the board is first read and when a
  report syncs it (`freezeDays`: each synced day from the later of `LEGACY_FROM` and sign-up, up to today), so a day nobody
  opened in town still pays. `quest_counts (user_id, day, kind, n, last)` has coffee, bench, paper and fountain,
  each counted once per key in a row (`last`) and at most 3 a day. `world` reports the bench and coffee
  (`town.questEvent`, validated server-side), `town.paper` the paper, and `tossCoin` the fountain.
- **Payout is derived** like the rest of the wallet: `questPay` works the coins out from the day's rollups, the frozen
  picks and the counts, on every `wallet` and `balances`. Done is only ever more true, so a late sync pays. A day
  with no frozen picks pays nothing. No ledger rows, and quest coins aren't matched into a company wallet.
- **`LEGACY_FROM`** is the first world day on these rules; every day before it pays the old two quests
  (`legacyQuestCoins`), so no balance moves at deploy. The value in `core/src/quests.ts` is a placeholder
  (`2026-10-26`): set it to the deploy day, a Monday, before shipping.
- **The weekly** (`weeklyProgress`): one of two, picked by the week's Monday: be active 5 days, or clear 8 dailies.
  It pays 15 coins (`WEEKLY_COINS`) and is worked out from the week's days like the dailies.
- **The fountain toss** is the one sink: `tossCoin` needs 1 coin and writes a ledger row (kind `fountain`, ref
  `fountain:<day>:<n>`, -1), then counts. A toss costs a coin, and pays one back only on a day it's the quest.
- **In the game:** the quests panel (E on the bar or board, `web/src/hud/Quests.tsx`), three pips by the coin counter
  (`wallet.quests`), and the toast for a finished quest opens the panel.

## Badges and the Hall of Fame

- **Badges** (`core/src/badges.ts`, 20) are still worked out on read from a player's facts (`badgeFactsOf`), never
  claimed. Each has ascending tiers; `badgeStates` gives value, the next tier and where this one began
  (`progressOf`, the bar on the card). A frame comes from the tier and how many it has (`frameOf`): one tier is gold,
  more run bronze, silver, gold, diamond by tier. Streak, Podium, Shipper, Shark and Whale have the diamond tier.
  Founder, the picnic and the watch party are `quiet`.
- **The collection log** (`core/src/collection.ts`): a static `CATALOG` of every badge, trophy and milestone title (48),
  in groups (Usage, Social, Town, Raid, Games, Seasonal) with how to earn it, so the client greys out what's missing and
  `town.collection` sends only a compact `CollectionState`. A minute at most per player, dropped when they sync or earn.
- **Awards** (`server/src/town/awards.ts`): `badge_awards (user_id, badge, tier, at, backfill)` keeps when each tier
  (and each milestone level, as badge `level`) was first seen, for the Hall and the log. `awardSweep` inserts what's
  reached and not recorded. A `report` or a credited Tavern minute marks the player dirty; the town's 10-minute
  `sweep` runs `awardStep`: at most 10 people (`AWARD_BATCH`), each at most every 5 minutes (`AWARD_EVERY`). The dirty
  set is in memory.
- **The backfill:** until the `badge_backfill` marker in `raid_meta` says done, each sweep records one chunk of 100
  players (`backfillStep`, by id) with `backfill = 1`: silent, with no date, and the dirty set waits. A player's first
  rows ever are silent too, so a new account's years of history isn't announced. Tiers pay no coins: they're derived
  retroactively, so paying would mint the whole history at once.
- **The town hears** of a gold or diamond tier (not a `quiet` badge's) and of reaching level 30 or more
  (`ANNOUNCE_LEVEL`), at most 3 per person per sweep: `told` calls `world.announceTown` with the open panel
  `collection`. Bronze and silver are silent.
- **The Hall of Fame** (`server/src/town/hall.ts`, E on `A`): `rarest` (the five gold or diamond tiers with the fewest
  holders, each with its first three), `firsts` (up to 8 this raid week: the first in the town to a tier or level),
  `winners` (this week's top raider and each game's biggest net winner), everyone by name. `ready` is false until the
  backfill is done and the panel says the wall is being polished. Kept 60 s in `town`, dropped by an award or a
  backfill chunk.

## The player card

- **Bio** (`parseBio`, `users.bio`): one line (whitespace runs become a space), zero-width, bidi and control characters
  removed, at most 120 code points (`BIO_MAX_LENGTH`), no links (a scheme, `www.` or a dotted common TLD); empty
  clears it. There's no word list: React escapes the text, anyone can `reportBio` (once per reporter per bio, not
  your own, in `bio_reports`), and the admin page shows bios and report counts and can clear one (`admin_log`).
  Editing or clearing a bio drops its reports. 5 edits and 5 reports an hour per player.
- **Showcase** (`showcase`, 3 slots, `PIN_MAX`): pins are collection ids (`badge:shipper`, `trophy:…`); milestone
  titles and items can't be pinned. `setShowcase` refuses any you haven't earned, and a pin that stops being yours is
  dropped silently when the card is read.
- **Agent types** (`core/src/agentType.ts`; no rule looks at cost or raw volume): over the last 30 days, the first of
  Apprentice (under 5 active days or 5 active hours), Swarm Commander (2.5 agents at once on average, or 35% of
  agent-time in subagents), Marathoner (5 or more active hours a day), Delegator (30+ turns per prompt), Pair
  Programmer (8 or fewer), else Sprinter. `habitsOf` also gives the hours profile (`workHours`: night owl, early bird
  or day shift), sessions, cache hit, the top sources and peak agents.
- **Rollups.** `activity_daily` has four more columns, from `player`'s rollup: `sessions`, `sub_buckets` (subagents
  summed over 5-minute buckets), `hours` (24 counts of active buckets by world hour) and `sources` (JSON, tokens by
  source). `writeActivity` inserts by column name, never position. To fill history, `player` queues every stored day
  once (`usage_report_migrations` version 5, into `pending_usage_days`) and the usual drain re-reports them 7 days at
  a time, a batch per turn of its lock so syncs aren't held up, when each player's actor next wakes. Until then old
  days read as no data.
- **Regulars' plaques.** Once a minute (600 ticks) `world` gives a minute to each connected player in the Tavern or
  basement who isn't dozing, asleep or at a desk (`counts`), and a visit when they've been out 10 minutes
  (`TavernClock`, in memory); every 5 minutes one `town.tavernMinutes` call carries it (a failed one is put back; a
  restart loses at most 5 minutes). `tavern_daily (user_id, day, minutes, visits)` credits at most 180 minutes a player
  a day (`REGULAR_DAY_CAP`) and drops rows past 8 weeks. The week's top 5 from Monday with at least 30 minutes get brass
  plates on the two plaques (ranks 1 to 3 left, 4 and 5 right; `town.regulars`, kept 60 s). They give no coins.
  The days with a visit are the Tavern regular badge, and the first is "regular since" on the card.
- **The bar tab.** The `J` run on the Tavern's north wall is a chalkboard drawn in code (`barTab`, `drawBarTab`): the same
  weekly top 5 by time as the plaques (Monday to Sunday, Copenhagen), names and hours only, never tokens or cost. It
  reads `town.regulars`, which also carries `last`, last week's winner (`lastWeekOf` and `rankRegulars` in
  `core/src/regulars.ts`, from the same `tavern_daily` rows, so no new table); they wear a small chalk crown. Clicking
  it opens the regulars panel. No coins, no rewards.

## Games

**Decided:** stakes only (every coin a winner gets came from the other players; no house prize and no town
cut). A stake is at most 500 and half your balance, a side bet at most 200, one game at a time. Every game
gathers in the town square so anyone can watch, and you play in a panel over the world.

**The games:**
- **Ship, Pivot, Raise** (1v1): rock-paper-scissors for founders, best of 5, 15 seconds a pick.
- **Hype Cycle** (2–8): the valuation climbs as e^(t/12) until it crashes; cash out in time. Three rounds.
  Each round's crash point comes from a seed whose SHA-256 is shown before it and the seed after.
- **Due Diligence** (2–6): Liar's Dice with 🦄 wild, 30 seconds a turn; the last with dice wins.
- **Sprint Race** (2–8): a typing race like Monkeytype, 15, 30 or 60 seconds after a 3-second countdown. The
  same seeded words from the 200 most common English ones for everyone, lowercase and with no punctuation.
  WPM is (letters of correct words + their spaces) ÷ 5 ÷ minutes; ties go to accuracy, then whoever got there
  first. The client sends the text as it's typed; the rules score only what arrived in the race (plus half a
  second for the network), at the server's clock, refuse text faster than 250 WPM, and nobody sees anyone
  else's text. In town the racers run laps of the square while it's on, a lap per 83 correct characters (10
  seconds at 100 WPM), from the game's `board`; only the client draws it (`web/src/game/race.ts`), so on the
  server they stand at the table as usual.
- **Tokenmaxxing** (2–12): the most real tokens in 15 minutes to 24 hours, starting on the minute after a
  minute's countdown, with 3 minutes of grace for late syncs.

- **Rules are pure** (`core/src/games/`): each game is a `GameDef` over plain JSON state: `setup`, `move`,
  `tick`, `forfeit`, a per-viewer `view` (hiding what a player mustn't see yet), `outcome` (places, or void),
  plus optional `callouts`, `status`, `board`, `headline` and `endsAt` for the world. Usage games add
  `usageWindow` and `usage`. `GAMES` lists them: Ship, Pivot, Raise; Hype Cycle; Due Diligence; Sprint Race; Tokenmaxxing.
- **`arcade["main"]`** is the social side and the money. Everything starts as a table: `open` (invite people,
  open it to anyone, or both), `invite`, `answer` (yes, no or a counter offer), `join`, `leave`, `start`. A
  full table starts a match. It also takes side bets, runs double or nothing, and `settle`s: the pot is paid by
  place (`core/src/games/payouts.ts`, integer math), side bets are a parimutuel pool, and a void game refunds
  everything. Each connection gets its own `lobby` event.
- **`match[id]`** runs one game: its tick loop, frames per viewer (`frame` events), forfeits after 20 seconds
  away for games that hold their players, and a 20-minute safety net. It tells `world` the live status, and
  `arcade` that it moved on and how it ended.
- **Coins** move only through the `ledger` in `town`: `hold` is all or nothing (a stake is at most 500 and half
  your balance), `pay` never pays out more than a ref holds, and `refund` returns what's left. Every ref sums to
  zero when it's settled; there's no house cut and no house prize.
- **In the world** (`world.gather`/`release`): players walk to a table in the town square and stand there as
  `playing` until it ends; `back` returns them to where they were. Tokenmaxxing gets an **arena** instead: its
  players stay free, and it's their rest spot until the battle ends. Banners, signs over open tables and the
  arena's scoreboard are drawn in `web/src/game/games.ts`.
- **Tokenmaxxing** pulls, it doesn't add up: after each sync, the match asks `player.tokensBetween(start, end)`
  (each minute capped at 50M and flagged), so re-sent or late events can't double count. After each sync the
  app asks `arcade.battle` (which pulls its score too) and syncs every 10 seconds until the battle is over.
- **When something fails:** a match retries reporting its outcome, settling can run again without paying
  twice, and the arcade calls off a match that got stuck, refunding everyone: a held game that hasn't moved on
  in 3 minutes (an engine hiccup can leave its match dead; the rules move it on within a minute), or any match
  still running after 30 minutes (25 hours for Tokenmaxxing). A match that ends after a restart lost it from
  the arcade's state is refunded too. The arcade retries letting the players go, and destroys match actors a
  minute after they end.

### Adding a game

1. Write `core/src/games/<id>.ts` exporting a `GameDef`, add its id to `GameId` and it to `GAMES`.
2. Write `web/src/games/<id>.tsx` (it gets `{ view, info, you, now, move }`), add it to `COMPONENTS`, and
   optionally give it a table in `web/src/art/tables.ts`.
3. Write `core/test/games/<id>.test.ts`; `registry.test.ts` already checks every game's basics.

No server changes, actions or tables are needed.

### Later

- The rest of the physical arcade. The basement's cabinets open the lobby, but matches still gather in the town
  square. Left: a daily high-score board, a trophy shelf of winners, and playing games in the basement itself.
- Inviting a whole company at once; company tournaments built from tables.
- Left out of the Tavern update on purpose: an office guestbook, a tip jar, rotating or flipping furniture, company
  quests, and item pins in the showcase (only badges and trophies can be pinned).
- Easing Tokenmaxxing's counters between updates, and "✓ syncing" next to seated players.
- More games: Term Sheet (Split or Steal; needs a rule for when both steal), Runway (Farkle), Burn Rate
  (blackjack), Unicorn (highest unique number), a coin flip at the fountain, and
  fighting "Rate Limit" in the tall grass.

## The raid

Every week a ladder of bosses waits in the Raid Dungeon, down the gate in the square, and the whole town
climbs it together (`core/src/raid.ts`).
- **The ladder:** The Rate Limit, The Context Window, Merge Conflict, The Hallucination, The Invoice, and that's the ladder (`BOSSES`).
  Each week has its `level` (1, then one more after every week that cleared it), shown as "II", "III"… on the names
  (`bossAt(rung, level)`: same sprite ids, plus `rung` and `level`). When a boss falls, the next appears
  at once and the overflow carries over. A day that does enough brings down several, all on that day, in order.
  When the fifth falls the ladder is `cleared`: the Invoice stays down, later damage still counts for the week's
  totals and raiders but hits nothing, and the dungeon rests until next Monday's 08:00.
- **Launch:** the first raid opens at 08:00 on the Monday after the town first had the raid
  (`launchWeek`). `raidStart` stores that Monday once in `raid_meta` (key `start`) when `town` wakes, so
  restarts and deploys don't move it; `RAID_START_WEEK` (a Monday, checked at boot) overrides it for dev and
  testing. The pure rules take it as `start`. Until it opens the view is `prelaunch` (with `launchAt`): rung 1
  behind a closed gate, its `hp` so far, and no kills, raiders or coins.
- **The teaser:** before the launch the gate is boarded up and taped off under a ⚠️ sign, a violet glow leaking
  through, rumbling every few seconds, with the odd line from inside ("Your rate limit is coming.") and
  "⚠️ Something is coming… 3d 04:12:55" over it, to the second. The corner box and the panel count down too;
  the panel shows rung 1 as a shadow ("???"), its HP so far and how the raid works. The dungeon can be walked
  into, but it's dark and empty: no raiders, just the first boss's shadow. The client asks again the moment
  a shut gate opens (`gateTimer` in `net.ts`, past the 5 s throttle), and `raidsOf` drops its cache when the
  raid week changes, so 08:00 is on time. When `prelaunch` flips the boards burst off the gate, rung 1 drops
  onto its dais and a toast says "⚔️ The Raid Dungeon is open: The Rate Limit awaits."
- **HP:** the first raid's rung 1 (`start`) is 10% of the week before's damage, at least 2B (`hpFor`);
  every week after is the same ladder again (same level, same rung 1) unless the week before cleared it
  (`RaidWeek.cleared`, all `BOSSES.length` = 5 fell), when it's one level up and rung 1 is ×1.1 (`WEEKLY_GROWTH`,
  `nextWeekHp`). Levels never go down: a town stuck on level 2 meets The Rate Limit II again, not level 1. Each rung is ×1.5. Clearing n rungs costs `2 × rung 1 × (1.5ⁿ − 1)`,
  so 4 rungs are 81% of the week that set the first ladder: a week like it clears four and stands at the fifth.
- **Damage** is every token you sync that week, no cap, and 25M for every PR you open. (Ingest still counts
  at most 200M a minute, `USAGE_MINUTE_CAP`, to stop made-up numbers.)
  Only days from your sign-up day count, as with coins.
- **Rewards per kill:** rung n pays each of its raiders 10, 25, 50, 75 or 100 (`RAID_REWARDS`), and 10% more for each level
  the ladder is up (`REWARD_GROWTH`, to the nearest coin: rung 5 pays 100, 110, 121…), so a level 1 week that clears all five is 260. A kill's raiders are everyone with 10M+ that week up to and including its day, so
  joining on Sunday doesn't pay for Wednesday's kills.
- **The week** is Monday to Sunday in world days, but the gate opens at 08:00 on Monday: until then
  `raidWeekAt` is still last week, as it ended, and the new ladder appears at 08:00 with Monday's early tokens
  in it. Usage is stored per world day, so the damage can't start at 08:00; the night off only moves what's
  shown, and the history (and with it wallets) follows it, so nobody is paid for a kill before it's shown.
  The view has `opensAt` and `endsAt` (the next Monday 08:00), and `closed` before the gate opens.
- **Nothing is stored.** Like balances, the raid is worked out from `usage_daily` and `activity_daily`
  (`server/src/town/raid.ts`), so a late sync still lands its hits. `town` keeps the result for 15 seconds
  (`raidsOf`), however many people are polling. `wallet` and the admin page's `balances` add raid coins.
  The week before the first raid (`start`) only sets its HP, so nobody is paid for bosses that weren't there.
- **In the game:** `town.raid` is polled with the stats (every 30 s). `hp` and `damage` are the current rung's;
  `kills`, `totalDamage` and `last` tell the rest. The corner box and the panel (the ladder: kills, the
  current rung, the next three greyed) are `web/src/hud/Raid.tsx`; a toast says each kill and its coins
  (in the dungeon the toasts go to the bottom, clear of the boss's name and HP).
- **The dungeon** (`MAPS.dungeon`, room `dungeon`): the gate `G` in the square (its sign: boss, rung, HP; a
  portcullis and "opens 08:00" while `closed`), or the panel's "Go to the dungeon" (`world.enterDungeon`).
  The boss stands on a dais (`Z`, not walkable) facing 40 war desks (`l`, with a seat `r` below each: props,
  not seats anyone sits in). Whoever walks in is a spectator; everything else is drawn in
  `web/src/game/raid.ts`, and only in that room.
  - **Raiders:** everyone whose agents ran in the last 10 minutes (`WORKING_MS`), wherever they are, asleep
    or offline included. `world.raiders` sends the busiest 40 (`RAIDERS_SHOWN`) as {id, name, look, agents,
    burn} and how many more, in the dungeon's snapshot and then as `raiders`, only to the dungeon and at most
    once a second when it changes. The client keeps each one's seat while they stay; a newcomer gets the
    seat their id hashes to, or the next free one (`seatFor`), among the front seats (in bands of 10 for
    the crowd), so the same person has the same desk after a reload.
  - **Your own seat:** walk up to your clone (or its laptop) and press E (or click it): you sit at your own desk, your
    real body typing there and the clone not drawn, and E or any step stands you up (`game/raidseat.ts`, rules in
    `core/src/raidseat.ts`). It is only what you see, nothing is sent: others' seats and a seat you don't have are never
    offered. Your pet fires little missiles of its own (peach, a quarter of your rate, `petRate`) only while you sit in your seat.
  - **Burn:** after each ingest `player.report` sends `world.activity` the live agents and the tokens a
    minute over the last 10 minutes of events (minute-capped like the games). `world` fades it linearly to 0
    as that last event gets 10 minutes old, so someone who stopped slows down before they leave their desk.
  - **Missiles:** each laptop fires `√(burn ÷ 100k)` a second (1 at 100k a minute, at most 6), or the odd
    sputter when idle; each agent past the first is a robot minion by the desk (8 drawn, then "+N") firing a
    third as fast. At most 150 missiles and 160 sparks at once. They only show the burn: the real hits are
    every synced token, floated off the boss as the `totalDamage` each poll adds.
  - **Kills:** the boss slumps by a trophy, then the next rung's drops in under a "Rung N" banner; this week's
    kills hang as plaques on the back wall. While `closed`, nobody fires and the one that got away dozes.
- **Loot** (`core/src/loot.ts`): each boss has its own table of four items, one per rarity: common 40%, rare
  20%, epic 10%, legendary 2%. Each level of the ladder ("II", "III"…) multiplies the odds by 1.05, at most
  ×10 (`lapBonus`: a 2% legendary is never above 20%, and a common is certain from level 20). Weeks before
  `LOOT_ODDS_FROM` keep the old 10%, 2.5%, 0.5% and 0.1% (`OLD_ODDS`): drops are fixed rolls worked out again
  from the kills, so raising the odds for every week would hand out an item for every old roll that now comes
  in under them. The weekly +10% difficulty of the ladder is separate and never raises odds.
  - The Rate Limit: Hourglass hat, 429 shades, Sand golem (pet), Golden Hourglass (trophy).
  - The Context Window: Pane glasses, Compacting… scarf, Goldfish (pet), Infinite Context Crown.
  - Merge Conflict: Two-tone suit, `<<<<<<< HEAD` band, Forked cat (pet), Golden Rebase (trophy).
  - The Hallucination: Third eye, Shimmering cape, Ghost (pet), Citation Needed crown.
  - The Invoice: Fine-print specs, Pinstripe suit, Piggy bank (pet), Paid in Full crown.

  They're shop items in the existing slots (`ITEMS`, with `loot: { boss, rarity }`), each slot's after
  everything sold in it (`LOOT_FIRST`: after the head pack and the wardrobe), so they're worn, placed,
  dropped and traded like any other, but never sold. Trophies are furniture: `Y` and `V` on the map legend,
  after the shop's pieces in `PIECES`.
  - **Rolls:** every raider a kill pays (`Kill.raiders`) rolls every item in that boss's table on its own, so
    one kill can drop several things for one person. A roll is the first 52 bits of
    `sha256("loot:<week>:<rung>:<userId>:<item>")` over 2⁵², and it drops when it's under the odds
    (`killDrops`). It's the same every time it's worked out, so nobody can reroll, a restart changes nothing,
    and anyone can check it.
  - **Granting** (`server/src/town/loot.ts`): like the raid itself, drops are worked out rather than
    stored, but an item has to be a row, so each drop is handed out once. Every time `town` works the raid
    out (`raidsOf`: a poll at most every 15 s, and the sweeper's alarm every 10 minutes, so nobody has to be
    watching), `grantLoot` finds the drops not yet in `loot` (primary key week, rung, user, item) and inserts
    each one's `loot` row and `items` row in one transaction, under `serial`. A late sync that makes someone
    a raider gets them that kill's rolls then. A drop is handed out before the poll that shows its kill
    returns. Loot stays when usage is wiped, and the rows stay when an account goes, like the ledger.
  - **News:** each winner gets one `notice` (the rarest first, opening the Bag). `world.announceLoot` sends
    this week's drops (at most 40) to everyone as `loot`. In the dungeon each item pops out of the boss in a
    beam of its rarity's colour and flies to its winner's desk (`web/src/game/loot.ts`). A legendary floods
    the screen gold with a banner wherever you are, and an epic does the same in violet. Outside the dungeon
    a toast says who got what. Whoever wears a legendary sparkles in the world.
  - **The panel:** `town.raid` adds `loot` (`raidLoot`): the current boss's table with its odds on this
    rung, ticked if you hold one, and this week's drops with who got them. The Bag and the Shop frame loot in
    its rarity's colour (common green, rare blue, epic violet, legendary gold, glowing), and the tooltip names
    the boss and the odds.
  - `RAID_LOOT_BOOST` (dev and testing only, 1 to 1000, checked at boot) multiplies every drop's odds so
    rare ones can be seen without luck. The panel says when it's on.

## The common room

The company house has a second floor: `MAPS.common`, 24x14, room `common:<companyId>` ("Acme's common room"). It is a cosy
lounge, additive and cosmetic: nothing in it pays, buffs or counts burn. One fixed size (house tiers only change the
building's outside art, not its map).

- **Stairs.** `u` (stairs up) is in the house's bottom wall at (3, 13); the common room's one exit `x` (stairs down, drawn like the
  basement's) is at (11, 13). `portal` sends `hq:N` + `u` to `roomEntry("common:N")` for members only (anyone else gets
  "The common room is for members only"), and the exit back to `roomEntry("hq:N", "u")`, just in front of the stairs, facing in.
- **Room ids.** `commonOfRoom` reads `common:<id>`; `memberRoomOf` is the company of a house or a common room. `companyOfRoom` stays
  houses only (it feeds the doors, the `houses` peek from town and the desk fleets). Presence and chat are the room's own
  (`chat.room = 'common:<id>'`), so they stay inside the company; ids are never reused. Changing company or closing one moves you out
  (`setPlayer`, `canReturn`), and `removeCompany` lifts the common room's pieces too.
- **Layout.** Windows (`Ψ`) and the wall of wins (`Θ`, one letter of WINS per tile) hang in the top wall; a kitchenette (`ψ` fridge, `π`
  counters, `α` espresso bar and `o` coffee machine, both pour, stools `v`); a stand-up stage (`e`, with a `ξ` whiteboard); the TV lounge
  (rug, `tt`, `μ` armchairs, `Ω` coffee table, a six-tile `s` sofa); `ε` beanbags; `θ` ping-pong and `φ` foosball; a `Q` pet bed corner.
  Seats are ordinary `seat` legend tiles, so E sits you right: sofas, armchairs and beanbags face down, stools face up.
- **Furniture.** Company pieces bought from the wallet go down in the common room as in the house (`placeDrop` accepts
  `hq:<co>` and `common:<co>`; drops are keyed by room string, each room with its own `OFFICE_PIECES` cap). Posters need the house's
  wall (`canHang`), so they stay downstairs.
- **For other renderers.** `core/src/common.ts`: `commonRoom(id)`, `COMMON_ZONES`, `commonSeats()` (position, tile, kind, facing),
  `commonWindows()`, `wallOfWins()`, `commonStairs()`, `houseStairs()`. The 2D art is `web/src/art/common.ts`.
- Left out on purpose: a mood board showing the company's posters and merch (the room's snapshot has no house drops), and a night sky
  in the windows (they are a fixed daytime sky).

## Offices v2

- **Sizes** go by the owner's level (`OFFICE_SIZES`): 12x9 from level 10, 14x10 at 25, 16x12 at 40
  (`officeTier`, `officeMap`). An office only grows right and down, so every tile and placed piece keeps its
  coordinates; the tier is in `owner` in the snapshot and the open-offices rows.
- **Personal furniture** (`core/src/home.ts`, art in `web/src/art/furniture-home.ts`): 14 cosmetic pieces for
  personal offices only, 40 to 260 coins from the shop (plants, a keyboard in a glass case, a whiteboard, a floor
  lamp, bookcase, duck shelf, mini fridge, wool rug, bean bag, neon sign, framed certificate). They are `Piece`s
  flagged `home`, ordinary tradeable bag items (`furn.<ch>`), but `canDropIn` lets them down only in your own
  office, never the company house. Nothing earns or buffs anything. The wall ones (`wall`: whiteboard, certificate,
  hanging plant, neon sign) hang on the office's single wall row (`OFFICE_WALL_ROW`, `canHang`/`wallSpot` with
  `home`), over bare wall (not the corners or the trophy shelf) with free floor in front, so they never block a step;
  their art is one tile (16 px) tall. A floor piece is refused (`cutsOff`, core/src/world.ts, checked in
  `placeDrop`) if it would leave the door, the desk, a seat, the pet bed or itself unreachable from the exit.
- **Decor** (`core/src/decor.ts`): 10 wallpapers and 10 floors per owner, not bag items. A paid one (40 to 300 coins)
  is bought once (`buyDecor`, a `purchases` row `decor.<kind>.<id>`); Tivoli (level 25) and the Bornholm cobble
  (level 40) come with the level and are never sold. `setDecor` switches between what you own for free, kept in
  `offices.wall` and `offices.floor` (NULL is the plain one), and `world` rebuilds the office map.
- **Open offices** (the Open offices entry in the Menu, or E on a `w` board tile): `town.openOffices` joins
  `world.openOffices` (open offices with their level, company, size and how many are inside now) with distinct
  visitors in the last 7 days (`office_visits (owner_id, visitor_id, day)`, written once a day per pair when
  `world` sees someone step in: `countVisit`, `town.officeVisit`; older days are pruned on write). Busiest first,
  at most 30, one read shared by everyone for 5 s. The `offices` table gains `wall` and `floor`; the code is in
  `server/src/town/offices.ts`.

## Desk setups and posters

- **Desk setups** (`core/src/desks.ts`): five cosmetic tiers, Laptop (free), Dual monitors, Triple monitors, Ultrawide
  and Battlestation, at 40, 120, 300 and 600 coins; Ultrawide and Battlestation also come free at levels 25 and 40.
  A bought one is a `purchases` row `desk.<id>`; the one in use is `users.desk` (NULL is the laptop), set for free
  with `setDesk` and carried to everyone as `PlayerInfo.desk`. Nothing about it is a gameplay edge.
- **The company's desk fleet:** any member can buy the house's next tier from the wallet (300, 700, 1,400 and
  2,500 coins; `companies.desk_fleet`, a `company_ledger` row of kind `desk`). At a desk in the house the client
  draws the better of the sitter's own setup and the fleet (`effectiveDesk`); empty desks show the fleet tier with
  dark screens. The art is `web/src/art/desks.ts`, and the Desk panel is `web/src/hud/OfficeDesks.tsx`.
- **Posters** (`core/src/posters.ts`, art in `web/src/art/furniture-posters.ts`): ten parodies of well-known game genres,
  60 to 250 coins from the company wallet, in the company furniture catalog (a "Posters" group). They are
  `COMPANY_FURNITURE` entries flagged `wall`: they hang only on row 1 of the company building (`canHang`,
  `wallSpot`), over a bare wall tile with a free floor tile in front, so walking is never affected. G takes one
  down, and `liftMisplaced` returns one to the storeroom if the map changes under it. The stock house has room for
  seven at a time.

## The physical shops (ShopBackend)

The four 3D shops (furniture, clothes, barber, pets; `web/src/render3d/shops/`) share one buy panel (`shopPanel.ts`) and one
set of item actions (`shopActions.ts`). Everything that costs, saves or asks "do I have it" goes through a
`ShopBackend` (`backend.ts`); there are two:

- **`DemoBackend`** (`demoBackend.ts`): the standalone demo's localStorage purse (`wallet.ts`) and the demo's `ShopHooks`.
- **`GameBackend`** (`web/src/render3d/shops/gameBackend.ts`): the real game. Coins, the bag (`wallet.owned`), the look, the
  company wallet and stored pieces are read from the HUD store; it sends what the Shop page sends: `town.buy` (outfit,
  hat, glasses, held, back, pet, petwear, personal furniture, company merch), `buyDecor` + `setDecor`, `buyDesk` + `setDesk`,
  `buyPiece` (company wallet: company furniture and posters), `setLook` (wear, restyle, adopt a pet or one of its looks,
  pet gear), `placePiece`, `drop`. Its connection, store and renderer come in as `GameDeps` (`GameNet`, `GameStore`,
  `ShopWorld`), so `web/test/shops-game-backend.test.ts` runs it on fakes; `render3d/shops/wiring.ts` is the real wiring.

Every write returns an `Outcome` (`{ ok } | { ok: false, reason, message }`) and never throws; the panel toasts it. The UI is
optimistic: coins, ownership and the look move first and are put back with the server's own words if it refuses
(`too_poor` -> `coins`, `owned`, `not_owned` -> `unowned`, `not_member` -> `company`, `rate_limited` -> `slow`; locked
levels are caught before the call, `level`). Client checks only save a round trip: the server still decides.

`purchase.ts` is the pure mapping from shelf ids to the real server ids and calls (`purchaseOf`, `equipOf`, `lookWith`,
`wornIn`, `failOf`, tested in `web/test/shops-purchase.test.ts`): `pet.<n>.<variant>` is not an item, it is `Look.petVariant`
and is free to anyone holding `pet.<n>` (`setLook` enforces it); `merch.<company slug>.<kind>` becomes
`merch.<companyId>.<kind>` by company name or is unavailable; `furn.<ch>` is personal furniture unless core marks it
`company` (then `buyPiece`); `decor.<kind>.<id>` and `desk.<id>` have their own calls. The shelf rows' names, prices and
levels are overwritten from core (`data/core.ts`), so a price changed in core reaches the shelves; the test asserts it.

Try on / Try it call `ShopWorld.previewLook(look)` with the look the item would give, which the renderer shows on the local
player's avatar without saving; closing the card (or a failed write) calls `previewLook(null)`. Nothing is saved until Buy,
Wear or Apply. "Place in my Office" calls `ShopWorld.startPlacement(itemId)`, the renderer's Office placement mode (it ends
in `town.drop`, the same call as the Bag); without one the backend drops where the player stands. `ShopWorld.applyDecor`
shows a wallpaper or floor at once. `installShops(world)` (`render3d/shops/index.ts`) mounts the panel on a `GameBackend`
for the renderer; in 2D mode, or on Low, a shop counter opens the old pages instead: `pageForShop(shop)` /
`pageForItem(id)` give the Shop page tab (`{ kind: "shop", tab }`), Decorate, Desk, the company shop or a company's merch.

## The client

- Plain Canvas 2D with `imageSmoothingEnabled = false`, integer zoom, and grid movement: your own steps are
  predicted and corrected by the server; other players replay a short step queue.
- The game draws through a `Renderer` (`web/src/game/renderer.ts`): `Renderer2D` wraps `render.ts` (the Low tier),
  and the 3D renderer is `render3d/index.ts`'s `create3D()`, imported on demand so Three.js is never fetched on
  Low. `game/stage.ts` runs the loop, swaps renderers when the graphics settings change, caps fps (idle, battery),
  and falls back to 2D with a toast if 3D can't start or dies. Clicks become tiles through the renderer's `pick`.
  Graphics settings (`settings/graphics.ts`: tiers Low/Medium/High/Ultra/Auto plus overrides, saved under
  `tokenmaxxing.graphics`), hardware detection (`settings/detect.ts`, pure scoring in `score.ts`) and the
  Auto-mode FPS governor (`settings/governor.ts`) are all pure and tested in `web/test/`.
- **The 3D renderer** (`web/src/render3d/`, loaded on demand) draws the same `world` state as `render.ts`; it adds no
  game state of its own. `index.ts` is the `Renderer`: each frame it makes the stage match `world.room`
  (`RoomView` from `rooms.ts`, a registry: `registerRoom(id, build)`; `room-town.ts` draws the town from the demo's
  `buildTown3d`, `room-generic.ts` draws any core map from its legend as labelled blocks, so every room is walkable
  and legible), lays `entities.ts` over it (a voxel body, pet, name tag, bubble and emoji burst per player id, walking
  between the tiles the server gives, with `motion.ts` holding the pose and turning rules), follows the player with
  `rig.ts` (the demo's isometric orthographic camera: follow, per-room framing, zoom steps, quarter turns on
  Q and R or `[` and `]`, middle-drag pan), and draws through the demo's `Pipeline` with the graphics settings
  (`renderScale`, `dprCap`, shadows, AO, haze, tilt-shift, grade). The town's sky, sun, moon, clouds, rain and snow are
  the demo's `Fx` driven by the game's clock (`game/sky.ts skyNow`) and the server's weather (`weatherNow`), and so is
  the windmill (`windmill3d.ts`, set by `Town3d.setWeather`; its cap and sails are rigid batches that turn as one);
  indoors the light is fixed, as in 2D. Names, bubbles, signs and the `💤` marks are DOM in a `#labels3d` layer
  (`overlay.ts`, `signs.ts`), over the canvas and under the HUD. Clicks go through `pick`: a person is their own
  tile, a prop on a tile you can't walk on is that tile, otherwise the floor point, so `game/input.ts` runs the same
  code as in 2D. The arrow keys follow the view when it is turned (`viewHooks` in `game/camera.ts`). The door fade
  starts when the server is moving you (`world.portalPending`) and opens in the new room.
  Performance: the parts of a room that never move are merged into a few meshes per material (`batch.ts`; the room's
  own animation is run through several hours and views to find what moves), so the town is a few hundred draw
  calls rather than three thousand; trees and roofs between the camera and you are dithered away round you
  (`seethrough.ts`). `dispose.ts` frees a room's geometries, materials and textures (kit-shared ones are marked
  `userData.shared` and left alone). `window.__r3d` has `gpu()`, `stats` and `cycle(n)`; opening the game with
  `?r3dcheck` builds and frees every room four times and logs whether `renderer.info` moved. The game tables, the raid
  gate and the dungeon are live too (see their notes below).
  **World events** are drawn from the same state the 2D game reads, never simulated: a room's `RoomView.frame(f)` runs
  once a frame after the people (`LiveFrame`: clock, camera, overlay, where you stand, reduce motion, the tier's particle
  density) and `RoomView.extras` is a group added to the scene beside the room, outside its batching. The town's
  `TownEvents` (`town-events.ts`) draws the merchant's cart and signpost on `cartOpen(serverNow())` (it rolls in and out
  when you watch the hour change; the goods are this week's `lineup`), the outage picnic (blankets, basket, bunting from
  `outageNow()`; the "Touched grass" notice sprouts a patch where you sit), the pølsevogn's sign, the snail's status and
  trail and the paperboy's tag (all from `skyNow()`), the Sprint Race's start line, and the fountain's coin (`viewHooks.toss`,
  fired when the server's answer to `toss` is "Plink"). `room-town.ts` repaints the star counter's face when the
  count changes and runs `Fireworks3d`. `Entities` puts Officer 429's light bar, pad and siren glow on
  his body from his lines (`CopWatch`, as `game/cop.ts`), runs racers round the square from `game/race.ts`, caps emoji
  bursts by tier and keeps the jitter off with reduce motion, and adds other players' showcase pins (badge and trophy
  chips) to their name tags (`ShowcaseCache`: one `profile` request at a time, only for people near you, never bots).
  The Tavern's `TavernEvents` puts a sign over the jukebox (track, who put it on, skip votes; the sound is still
  `game/jukebox.ts`), hangs the keynote watch party's screen, projector and poster (`keynote3d.ts`), throws the tip jar's coin, and dims the room with the game's sky (lamps and candles by `lightsNow`,
  no real lights). An Office's trophy shelf is built from the owner's real trophies (`trophies3d.ts`); a new trophy
  builds the room again. The pure rules are in `world-logic.ts` (tests: `web/test/render3d-world.test.ts`). Events that
  are many small meshes are merged once when built (`merge3d.ts`, `bunting3d.ts`).
  The demo's hand-built rooms are the game's: `room-skin.ts` builds the Tavern, dorm, basement, the four shops and the
  company house from the core map of the room you are in (`buildRoomSkin`, the demo's `world-rooms.ts` skins; the
  slices register at load with `loadSlices`), `room-furnished.ts` builds an Office or a company's common room as a
  `Room` with every dropped piece placed from its map character and the owner's wallpaper and floor, and `room-town.ts`
  draws the town from the core `townMap` (`render3d/data/town.ts` wraps it, so the storefronts `Ħ` and their door tiles
  are where the game has them). A room's `keepers` are bots whose bodies it draws itself (Bent, the four shopkeepers:
  `entities.ts` leaves theirs out). `live.ts` puts the game's data on the boards: the bar tab, plaques, easel and jukebox
  (`game/regulars.ts askRegulars`), the basement's livestream screen, tournament board and terminals.
  **The raid and the games** (`room-dungeon.ts`, `dungeon-live.ts`, `gate3d.ts`, `games3d.ts`; the rules are pure and tested in
  `raidfx.ts` and `gamefx.ts`): the dungeon is the demo's stone room built from the core map, plus a `DungeonLive` layer driven by
  `hud.raid` and the raiders the server sends (`game/raid.ts` seats them: `seatTile`): the boss on its dais (`BossActor`: HP plate,
  taunts, a hit flashes it and floats `-N` off it, the fall with its trophy, the next rung dropping in after, the dim of a week
  that is over, a silhouette in the dark before the first raid), each raider at a war desk with the laptop open (one instanced lid
  and screen for all) and their robot minions (`minions.ts`: the voxel robot merged once into two poses and instanced), missiles
  from every laptop at its burn rate (`fireRate`) and sparks (`swarm.ts`: instanced boxes), loot beams flying to their winners'
  desks (`onLoot` in `game/loot.ts`), the HP terminal and the week's kill plaques on the wall. Medium draws `CAPS.lean`: fewer
  people (the rest are two instanced blocks of torso and head), minions and shots. In town `gate3d.ts` puts boards, tape and a
  danger sign on the gate before the first raid (they burst off at the launch), a portcullis while the week is shut, and the
  gate's sign (click: the raid panel). `GamesLayer` builds a table with stools (or arena desks and a live scoreboard) wherever
  `world.games` has a game and frees it when it ends; players sit or type there (`seatPose` in `entities.ts`), a sprint race's
  racers run their laps (`game/race.ts racing`), and the banner, the table's callouts, the watchers' count and the open
  tables' "Join" are DOM labels (`RoomView.liveSigns`). Anything that moves in a room is `userData.live` and its group
  `userData.nobatch`, which `batch.ts` honours up the tree.
  Shops: `installShops(world)` mounts the buy panel; the renderer is its `ShopWorld` (a try-on is `Entities.previewLook`,
  a shelf is picked by the pointer or E on its tile via `viewHooks.shop`, a bought piece for the Office is placed with
  `placer.ts`: a ghost follows the pointer, a click walks you up to the tile, faces it and drops it with the Bag's
  `town.drop`, and the wallpaper and floor rebuild the Office from its map). Graphics go through perf's
  `applyGraphics(pipe, settings)`; Medium builds with `setGeometryDetail(0)` (a tier change rebuilds the rooms).
- Every sprite is a palette-string grid baked into a canvas at runtime (`web/src/art/`), so there are no image
  assets.
- Chat has quick replies above it: emoji and startup one-liners, sent with one click. A line made only of
  emoji (up to 8) bursts around its author instead of showing a bubble (`game/emoji.ts`).
- React draws only the HUD and reads a small `useSyncExternalStore` store (`store.ts`). Game state never passes
  through React.

## 3D performance

The 3D engine is measured, not guessed: a headless harness, hardware-independent counts, budgets that a test enforces.

**What makes it cheap** (`web/src/render3d/perf/`, `web/src/render3d/engine/pipeline.ts`):
- *Static batching* (`bake.ts`). A room is thousands of tiny meshes. Roots flagged `userData.bake` (every `WorldRoom`, every
  `Avatar`) are watched for ~24 frames and the tick functions are sampled; whatever never moves is merged per cell
  (8 units) into meshes sharing one vertex-coloured toon material (textured ones per texture, small painted ones through an
  atlas, see below; see-through ones too, one batch per opacity), and the originals are hidden and put to sleep (no matrix
  updates, and `updateMatrixWorld` does not even walk them). Two variants are kept per room (smooth, and the Voxel style's
  blocks) and flipped on style change. Opt out with `userData.live = true` (night swaps, anything a caller keeps a handle
  to). `userData.rigid` marks things that move as a whole but are fixed inside (a wall that lowers, an avatar's limbs): batched
  in their own space and riding along. Lamps, windows and light cones with `nightGlow` get a day and a night copy flipped by
  `setPropsNight`/`setRoomNight` (sampling the hours records a glow by its day material, so the swap is not "moving"). Things
  that really move in place are drawn as few meshes as they can be: the fountain's drops are one `InstancedMesh`, the pond's
  drifting sparkle one merged mesh. Code that changes a room's shape after it was batched calls `invalidateBaked(obj)`
  (`Room.build` does). `?nobake` turns it off to compare pictures.
- *Atlas* (`atlas.ts`). Small nearest-filtered painted textures (signs, price tags, posters) of one material setup are packed in
  one padded atlas. Slots align to all four mip levels, each tile is downsampled independently, and nearest magnification
  preserves close-up pixels. A skyline packer and cropped height limit empty space. Repainting updates every mip; pictures
  that repaint all the time are taken out. A room's textured props merge from one draw call per picture to one per setup.
- *Freezing* (`freeze.ts`, `Freezer`). A person or pet who stands, sits or sleeps (`userData.actor`) is merged in that pose into
  a couple of meshes and its limbs stop being posed; moving gives the limbs back (`bake.ts` `freezeLayer`, `suspend`, `resume`).
  Models nobody animates (display pets) freeze after half a second. Past `crowd` people nearest the middle of the picture (8 / 16
  / 32 on Medium / High / Ultra) the rest are drawn frozen even while they walk, as are people and pets under 20 px tall (the
  pet shop's window pets, seen from the street, even asleep). Animation of
  anyone outside the camera's frustum is skipped (`view.sees`).
- *Shadows*. Medium has none, a soft disc under each person and pet instead (`blob`, one instanced draw; the raid's minions have their own instanced discs in `minions.ts`). High and Ultra draw
  the room's static casters **once** into a big map (2K/4K) and again only when a room is re-batched, a caster stops or starts
  travelling, or the sun has moved (`last.staticBakes` counts it); people, pets and walls that lower go into a small second map
  (1K on High, 2K on Ultra) every frame or two. Both maps snap to their own texel grids as the camera moves;
  zooming changes coverage without changing the sun's direction. Two shadow-casting directional lights, the second at intensity 0, and a patched
  `lights_fragment_begin` that multiplies both lookups for the first light. Static batches sit on layer 2 (`STATIC_LAYER`), everything
  else on 0; `shadowcast.ts` tracks full world transforms, moving resting props onto the baked layer and returning them to
  live shadows on translation, rotation, scaling or visibility changes. Actors and deforming meshes always stay live.
  Removing a cached caster also invalidates the baked map. Deterministic tent filters soften edges over nine static
  texels or five live texels, pairing comparisons into 25 or 9 bilinear reads. The smaller live map's larger texels
  give moving objects similar softness to static geometry without screen-space noise.
- *AO* (`pipeline.ts`). Depth-only, its own pass at half size (`aoScale`), upsampled in the composite by
  a four-tap depth-aware blend. A fixed spiral kernel avoids crawling screen-space jitter; a seven-tap bilateral blur
  runs horizontally then vertically, and slope-aware upsampling keeps roofs smooth. Samples use view-space distance
  and the surface normal within a 0.35-unit radius, keeping raised furniture from darkening distant floor pixels.
  With AO enabled, the pipeline draws five passes: the scene, AO, two blurs and the composite.
  The composite is the only full-size post pass (AO, haze, grade, tilt-shift, dither in one).
- *Geometry and textures*: kit boxes with small bevels are 44-triangle chamfers, round things get segments by radius,
  `setGeometryDetail(0)` gives plain boxes for Medium; painted smooth textures are capped (`setTextureCap`, 1024 px on Medium,
  2048 elsewhere); tiled planks, wallpaper and checkers use trilinear mipmaps and 4x anisotropy. Their material blends
  across texel edges over one screen pixel, retaining sharp pixel interiors and the original UV derivatives for mip selection;
  `applyGraphics` sets geometry detail and texture limits before rooms are built. Window bars, roof courses and fence rails
  carry `detailSize`: batching sorts them after the main geometry, and `details.ts` trims draw ranges below one pixel with
  hysteresis (hide below 0.8 px, restore above 1.2 px). This reduces triangles without adding draws or changing the sources.
- *Pipeline*: lights are cached per scene, geometry swaps for the Voxel style only run when something was added (`sceneEpoch`),
  classic styles skip the normals pass without creases and the depth texture without outlines, canvas size is only touched when it
  changes, ticks registered while a room builds only run while that room is on screen (`kit.ts`), see-through double-sided materials
  render in one pass (three flips `needsUpdate` twice a frame for them), `#rrggbb` colour strings are looked up, not parsed.
- *Rooms* (`world.ts`, `world-rooms.ts`, `registry.ts`). Each hand-built room's code is its own dynamic import
  (`await world.load(id)`; `world.room(id)` is the synchronous accessor and throws for a room whose code is not in, rather than
  drawing a blank one; the demo and the tests `await loadRoomSkins()`). Tile-drawn rooms build a few ms at a time, a frame
  boundary between the pieces, so a loading veil paints. Built rooms are kept in an LRU (`maxBuilt`, `pinned`): `evict` drops the
  least recently used one, stops its ticks, frees its batches and painted textures (shared geometry and materials upload again on
  demand). `preload(id)` / `preloadNeighbours(id)` build a door's room when the browser is idle. `loadSlices(rooms)` imports only
  the slices a set of rooms needs. The town's shop storefronts share a module with their interiors, so the shops ride with the town.
- *Tiers* (`tiers.ts`, `applyGraphics(pipe, settings)`): Medium is the classic look at 0.75 scale with silhouette lines, blob shadows,
  no AO, plain geometry, 1024 px textures; High has AO (16 taps, half size), haze, grade, 2x MSAA and a 2K baked shadow map; Ultra (opt-in, never chosen by Auto) adds
  tilt-shift, 4x MSAA, a 4K map, 24 AO taps. Device pixel ratio times scale is capped at 2. Fps caps, idle and battery
  throttling and the governor live in `game/stage.ts` / `settings/governor.ts`.

**Measure**:
- `bun scripts/perf/counts.ts medium|high` prints the per-room counts the budgets check, built headlessly.
- `bun scripts/perf/game.mjs [--tiers medium,high,ultra] [--walkers 40] [--throttle 4] [--profile|--alloc|--nodes|--heap]` measures
  the real game: it starts its own production server (`bun run site:build` once), signs up `walkers` players
  who walk out into the town and wander it over the wire, and opens an observer per tier with no fps cap: the renderer's own CPU
  time per frame, frame gaps, long tasks, draws, heap, and on request a CPU profile, garbage per function, the nodes the scene
  walks visit, or a heap snapshot. `--throttle` slows the CPU (a stand-in for a weak laptop).
- `web/test/perf-budget.test.ts` builds every room headlessly (the real skins, not tile stand-ins), batches it, freezes its
  people and fails above `render3d/perf/budgets.ts`; `perf-freeze.test.ts` and `world-lazy.test.ts` cover freezing and the room cache.
  The budgets count the static room alone; `web/test/dungeon-live.test.ts` budgets the dungeon's live layer on top and `games3d.test.ts` that a game's props come and go.

## One clock

"Today" is `Europe/Copenhagen` for everyone (`core/src/range.ts`); the Tavern's special is picked by that day too
(`copenhagenDay`, `core/src/tavern.ts`).

## Holidays

`core/src/holidays.ts` is the town's calendar, pure and on the one clock like the street and the merchant: each
holiday's date in a year (`HOLIDAYS`: Fastelavn from Easter, Sankt Hans, Halloween, J-dag on the first Friday of
November, Juleaften, Nytårsaften) and `near(id, ms, before, after)`, whether the Copenhagen day `ms` is in is within a
window round it (both ends included, across New Year too). Each feature keeps its own window; none needs server state.

- **Halloween** (`core/src/halloween.ts`): from 7 days before to the day after (`PUMPKINS`), a pumpkin on the grass beside
  the path below every door in town (the Tavern's `I`, each company's `D`, each shop's; to the left, since the paper lands
  on the right) and three in a patch by the pond (`pumpkinSpots(map)`). They are scenery: nothing blocks on them. 2D:
  `game/halloween.ts` draws them (`drawPumpkins`) and their candles' glow after the night tint (`lightPumpkins`); 3D:
  `render3d/town/pumpkins3d.ts` (`Pumpkins`, in `room-town.ts`) builds them once per town, the bodies batched and every
  face one mesh whose colour turns candlelit. Both ask `pumpkinsOutNow()` and `candlesLit()` (the street lamps'
  `lightsNow`), on `skyNow()`, so `?sky=2026-10-31T21:00` shows them. `web/test/halloween.test.ts` checks that both
  renderers put them on the same tiles.
- **Costumes** (`core/src/costumes.ts`): hats sold only round their holiday (`ON_SALE`: 14 days before to 2 after), worn and
  traded all year. Their look indices start at `COSTUME_BASE` (200), past the editions, and `parseLook` takes them like
  editions; `Item.holiday` marks them. `buy` (`town/coins.ts`) refuses one out of season with `offSeason`; the Shop page
  hides it then and tags it in season, and the 3D Clothes shop leaves it off the shelves (built once a page; `purchaseOf`
  says `season` if a shelf outlived the window). 2D art is in `art/editions.ts` by id, the 3D hat in `HAT_BUILDERS` by name.

## Known limits

These are deliberate, and marked `ponytail:` in the code:
- one `world` actor for everyone (split it per room when hundreds are online at once; the protocol is already
  per room, but in one process the rooms would share the message limit above);
- rate limits are in memory, so a deploy resets them;
- usage is reported by each user's machine: capped and flagged, but it can't be proven;
- leaderboards are kept until something on them changes (`boardsChanged`, called on every push to `world`),
  and wallets are recomputed on every request, against podiums kept per day and the raid kept for 15 s; the Hall of
  Fame, the weekly regulars and each player's collection are kept for 60 s;
- the badge sweep's dirty set and the Tavern's minutes since the last flush are in memory, so a restart delays the
  first and loses up to 5 minutes of the second;
- a late sync can knock someone off a past podium after they spent the bonus;
- the logo download checks DNS before fetching, so DNS rebinding in between isn't caught.

## Tests

`bun run check` runs typecheck, lint and every test. `bun run test` runs the files in parallel; plain `bun test`
runs them in one process. Actor tests start a real server in a subprocess per test process, with its own engine,
free ports and data directory (`server/test/rivet.ts`), so they use the production code paths. CI runs two
workers, since more stall the engines on its runner, and turns on quick ACKs for loopback, which takes most of the
remaining wait out of each actor call (see `RIVET__GUARD__TCP_NODELAY`). Map, step, rest-spot and coin rules are
pure and tested in `core/test/`.

## The shops

The four physical shops are public rooms like the Tavern: `shop-furniture` (Møbelhuset, Freja), `shop-clothes`
(Thread & Token, Bree), `shop-barber` (Figaro's, Figaro) and `shop-pets` (the pet shop, Wren). `core/src/shoprooms.ts`
is their single source of truth: the plans (the 3D shops' interiors tile for tile, at the world-grid inset
`SHOP_INSET` of two wall rows and one column), the door, counter, shopkeeper spot and `displays` (a tile and the Shop
tab E opens), and `SHOP_DOOR_CHAR` for the storefronts in town. `maps.ts` builds the `GameMap`s and `layoutOf(map)`
reads a room's size, doors, seats and displays for a 3D builder.

- **In town** each shop has a 5x4 front (`Ħ`, door `ƒ Ç Ð ð`) on its own block in the corners round the core
  (`SHOP_BLOCKS`; `frontier` never offers them to a company). A block a company already holds stays the company's.
- **Tiles**: `¢` the counter, `¤ § ¶ ¥` a shop's display (shelf, rack, styling station, pen; on a wall, sample boards),
  `‡` fixtures. E on the counter or a display opens the Shop page on the matching tab (`shopInteract`; the barber opens
  the look picker). Dropping anything on a shop floor is refused. The shopkeepers are `still` bots (`SHOPKEEPERS`, ids -5
  to -8) with idle chatter only. Art: `web/src/art/shops.ts`.
- **Core is the source of truth for every map**: `web/src/render3d/data/maps.ts` just re-exports `core/src/maps.ts`.
