# 3D performance work

The original audit reviewed `8d44e58`. This implementation started from `17f5ea3`, with fresh CPU measurements against that revision, then incorporated the windmill, holiday calendar and star-counter and Tavern keynote updates from main. Conflict resolution later incorporated main through `62b0bdd`, including seasons, weather and street-lamp dimming. The goal is to reduce steady rendering work and retained room data while preserving the models, palette and cutaways.

## Implemented

- **Room lifetime:** remove the global arrays retaining every batch; dispose batch subscriptions, generated materials and frozen layers through normal object cleanup; release pending batch probes and night-glow registrations. The pipeline keeps one fill scene, releases its active-scene handle, and unregisters its debug renderer when destroyed. World eviction uses the same cleanup path.
- **Cutaways:** reuse a verdict until the player, camera, mesh transforms or geometry change. Keep easing the ring every frame. Large meshes use bounded triangle ranges sharing the original buffers, rejecting rays before triangle intersection. Lowered walls and hidden scenery still change the verdict.
- **Frame cadence:** 60 fps by default, with the existing uncapped override. After ten seconds without input or player activity, quiet scenes run at 30 fps. Input, movement, portals, games and the dungeon keep active cadence. Hidden documents skip both simulation and drawing. Scheduling retains 60 fps on 144 Hz displays without bursts after a stall; idle frames do not trigger governor downgrades.
- **Pet buffers:** index four corners per exposed voxel face, retaining triangle winding, colors and corner AO. Identical surfaces share buffers by grid content, origin, seed and shading options. Reference counts release them when the final mesh leaves. No global cache of unused pet geometry remains.
- **Daytime lighting:** hide zero-intensity furniture and outdoor point lights. Outdoor lights rejoin the light list as their nighttime intensity rises; fixtures and painted pools remain visible.
- **Rendering defaults:** High retains voxel geometry, AO, shadows, haze and grade, with a default density cap of 1.5 and 12 AO samples instead of 16. The density override and Ultra remain available. Medium retains its cheaper pixel style; its description now says so. Its internal scale changes continuously rather than rounding multiple governor steps to the same target.
- **Preparation:** skip detection for explicit tier choices and yield between synthetic benchmark draws. Prepare the nearest unfinished shop, one pet sculpture per slice; bound texture-upload slices by three milliseconds. Entering a partially prepared shop finishes and reuses it. Slice animation callbacks belong to the prepared room, and cancellation or leaving 3D releases unused work.
- **Tools:** apply texture caps before constructing rooms; expose `--live` actors and `--block` variants alongside the existing frozen/smooth budgets. Report logical geometry bytes, active lights and construction time. The game recorder separates drawn FPS from rAF cadence, reports actual target dimensions and GPU identity, waits for preparation, accepts a warmup duration and optionally reads GPU timer queries with disjoint samples discarded.

## Evidence

`bun scripts/perf/occlusion.ts` runs the real cutaway probes on 40 deterministic positions per room, with batching, frozen actors and the renderer's scene tracking enabled. It discards a journey before measuring settled probes, and measures stationary probes separately. These are local CPU measurements, not predicted device FPS. Other workloads on this machine affect timings.

| Room | Before moving median / p95, ms | After moving median / p95, ms | After stationary median / p95, ms |
| --- | ---: | ---: | ---: |
| Town | 2.37 / 4.74 | 2.09 / 2.92 | 0.28 / 0.37 |
| Clothes | 6.50 / 11.65 | 1.50 / 2.88 | 0.55 / 0.85 |
| Pets | 25.46 / 37.49 | 1.79 / 2.46 | 0.39 / 0.44 |
| Tavern | 10.71 / 21.00 | 0.38 / 0.71 | 0.08 / 0.11 |

The first probe builds acceleration bounds and remains more expensive than settled probes. This implementation does not meet the original under-two-millisecond target at every town position.

The eight-scene browser retention experiment previously retained eight room roots after normal disposal and forced collection. The updated experiment retains zero room roots and zero scenes while the pipeline is still alive, without manually clearing internal caches. This isolates the reported retention paths; it does not prove an entire long game session has no other retaining paths.

The original High pet-shop audit counted roughly 91 MiB of unique geometry buffers. The updated content tool counts about 60 MiB with the same 351,876 triangles and 279 drawables. Buffer sizes include hidden sources and generated copies; they exclude cache keys, materials, driver overhead and the rest of the JS heap. The six new lifecycle, buffer, stationary-probe and default-cap regressions failed against the original source and pass with the changes.

Medium and High content budgets pass after incorporating main's fixed-noon sampling. The earlier seven-draw variability came from the street snail advancing with the live clock between batching samples. Pinning the measurement clock preserves deterministic sampling; the merged town records 318 draws on both tiers against the unchanged 320-draw limit. Seasonal budget tests also pass. The production game recorder completed both tiers without reported page errors. The tour now waits for the stage and fade to finish before sampling pixels. A settled High smoke journey through the Tavern, town and pet shop rendered all three scenes with no reported page errors. Chromium here uses **ANGLE SwiftShader**, and its short sample windows still include software shader/driver stalls despite warmup. Its FPS and GPU timings do not establish laptop, WebView or Android performance.

The full local run completed with 1,214 passes and 14 Rivet actor-response timeouts in unchanged server tests. A serial retry of those 14 cases passed 11, with three still failing in Rivet. After conflict resolution, the focused renderer/content, lighting, weather and seasonal run passed 106 tests, including the repeated live/frozen measurement regression. Typecheck, lint and the production build pass. These local timeouts are reported separately from the renderer results; CI remains the gate for the complete suite.

## Reproduce

```sh
bun run typecheck
bun run lint
bun test --timeout 60000 --parallel=2
bun run site:build
bun scripts/perf/counts.ts medium --check
bun scripts/perf/counts.ts high --check
bun scripts/perf/counts.ts high --live --block
bun scripts/perf/occlusion.ts
PLAYWRIGHT=/path/to/playwright/index.mjs bun scripts/perf/game.mjs --tiers medium,high --walkers 0 --warmup 8000 --ms 6000 --gpu --out /tmp/game-perf.json
```

The existing budgets count a whole room's smooth geometry with frozen actors, one pass, without camera culling or stage lighting. `--live` leaves actor geometry unmerged; it does not simulate a network crowd or a running raid. `--block` measures the voxel variant. Neither alternate mode is compared against the frozen/smooth budget. Each room measurement rebuilds the room so live/frozen modes remain independent. Build timings still benefit from process-wide kit and module caches. The runtime recorder's CPU throttle affects CPU execution, not GPU speed.

## Remaining recommendations

| Work | Why it remains separate | Acceptance before adopting it |
| --- | --- | --- |
| Screen-size pet LODs and greedy voxel merging | Both can alter silhouettes, eyes, per-cell jitter and corner AO. This change preserves the exact sculptures and triangles. | Compare close, middle and distant views, shadows and animated transitions on target devices; record triangle and memory savings including retained LODs. |
| Stable nighttime point-light budget | Dropping useful lights changes indoor and nighttime art. Daytime zero-intensity slots are removed here. | Measure nighttime GPU time and compare counters, entrances and fixtures before choosing the fixed set. |
| Atlas-backed instanced billboards and mannequin instancing | The pet keeper's name and animated bubble are only two of its shop's draws. Major remaining shop costs include hundreds of materials and articulated display parts; transparent sorting, text repaints and shelf picking need a dedicated pass. | Group live remaining draws by material and display type; preserve bubble timing, camera facing, transparency and picking. |
| Fully sliced room/stage construction and batching | A time check between tasks cannot interrupt a whole town builder or one large batching call. Those still run synchronously; this PR limits the smaller slices and fixes ownership. | Split builders at useful boundaries and record cold/warm door long tasks, shader readiness and retained prefetched bytes. |
| Worker-based detection | Yielding between samples cannot interrupt one slow draw/readback. | Worker support and fallback in the macOS WebView and Android; no long main-thread benchmark task. |
| Startup import graph and company/crowd/live-raid budgets | Room skin imports still join nominally lazy code into shared chunks; the headless sample town is not a representative large company fleet. | Measure startup transfers and first room readiness; add representative content and settled live journeys before tightening budgets. |

Keep the current GPU power preference until dual-GPU measurements justify changing it. Validate the High density/AO defaults visually at native density, widest and closest zoom, and at night on an integrated-GPU laptop, Apple Silicon desktop WebView and a lower-end Android device. No real-device image-quality or battery-life claim is made by the software-rendered smoke run.
