import type { Trophy } from "@tokenmaxxing/core/trophies.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { SHELF_H, trophyShelf } from "../art/trophies.ts";
import { town } from "../net.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { world } from "./world.ts";

/** While you're in an office, its shelf is asked for again this often (new syncs, new trophies). */
const REFRESH_MS = 60_000;

/** The shelf of the office we're in (or were last in): whose, what's on it, and when we last asked. */
const shelf = { owner: 0, earned: new Set<string>(), at: 0 };

/** Asks for someone's trophies again; the shelf and its panel both show the answer. */
export async function loadTrophies(owner: number): Promise<Trophy[]> {
  const trophies = await town.trophies(owner);
  if (owner === shelf.owner) shelf.earned = new Set(trophies.map((t) => t.id));
  return trophies;
}

/** In an office: its owner's shelf, on its row (the first `U` from the top left) against the back wall. */
export function drawTrophies({ g, items }: Frame) {
  const owner = world.owner?.id;
  const at = owner === undefined ? null : world.map.find("U")[0];
  if (owner === undefined || !at) return;
  const now = Date.now();
  if (shelf.owner !== owner || now - shelf.at > REFRESH_MS) {
    if (shelf.owner !== owner) shelf.earned = new Set();
    Object.assign(shelf, { owner, at: now });
    void loadTrophies(owner).catch(() => {});
  }
  const [x, y] = at;
  const sprite = trophyShelf(shelf.earned);
  items.push({ y: y * TILE + TILE - 1, draw: () => g.drawImage(sprite, x * TILE, (y + 1) * TILE - SHELF_H) });
}

/** E at the shelf: the list of what's on it and when each came. */
export function openTrophies(): void {
  const owner = world.owner;
  if (owner) hud.set({ panel: { kind: "trophies", userId: owner.id, name: owner.name } });
}
