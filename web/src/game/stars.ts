/**
 * The star counter on the square (`core/src/stars.ts`): the project's GitHub stars as `world` last read
 * them (the `stars` event), on a sign over the counter. E in front of it opens the panel with the button
 * to star the repo. A milestone's fireworks are a show in `fireworks.ts`, so both renderers draw them.
 */
import { STAR_COUNTER, STAR_SHOW_MS, type Stars, starFireworks } from "@tokenmaxxing/core/stars.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { hud } from "../store.ts";
import { addFireworks } from "./fireworks.ts";
import { type Frame, inView } from "./frame.ts";
import { pill } from "./labels.ts";
import { serverNow, world } from "./world.ts";

addFireworks(() => {
  const { show } = hud.get().stars;
  return show && starFireworks(show);
});

export function setStars(next: Stars): void {
  const before = hud.get().stars.show;
  hud.set({ stars: next });
  const { show } = next;
  // A milestone just passed (or you came in while its fireworks are still going): the town tells you.
  if (show && show.at !== before?.at && serverNow() - show.at < STAR_SHOW_MS)
    hud.set({
      notice: {
        text: `🎆 ${show.milestone.toLocaleString("en-US")} stars on GitHub! Fireworks over the square.`,
        at: Date.now(),
      },
    });
}

/** The count as the counter shows it: grouped, or a dash before the first read. */
export const starCount = (count: number | null): string =>
  count === null ? "–" : count.toLocaleString("en-US");

/** The 2D counter's sign: the count, over the board. */
export function drawStars(f: Frame): void {
  if (world.room !== "town") return;
  const { g, labels, toScreen, dpr } = f;
  for (const [x, y] of world.map.find(STAR_COUNTER)) {
    if (!inView(f, x * TILE, y * TILE - TILE, TILE, 2 * TILE, TILE)) continue;
    const [sx, sy] = toScreen(x * TILE + TILE / 2, y * TILE - 12);
    const text = `⭐ ${starCount(hud.get().stars.count)}`;
    labels.push(() => pill(g, sx, sy, text, dpr, "rgba(31, 36, 51, 0.92)", "#ffd23f"));
  }
}
