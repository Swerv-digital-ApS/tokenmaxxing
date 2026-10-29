/** What the name-tag pass reads and writes on a person's label (all numbers in screen pixels). */
export interface TagSlot {
  /** Where the label's foot is on screen. */
  tx: number;
  ty: number;
  /** How far the person is from the player, in tiles. */
  tdist: number;
  /** Out: lift the label by this many pixels so it clears the nearer ones. */
  tshift: number;
  /** Out: 0 to 1, fainter the farther away. */
  talpha: number;
  /** Out: no room for this one (a crowd, or past the tier's cap). */
  thide: boolean;
}

export const TAG_W = 116;
export const TAG_H = 22;
const LIFTS = 3;
const NEAR = 5;
const FAR = 14;

/** Insertion sort by distance, in place (a crowd's order barely changes between frames, so it is nearly free). */
function sortNearFirst(items: TagSlot[], n: number): void {
  for (let i = 1; i < n; i++) {
    const x = items[i]!;
    let j = i - 1;
    while (j >= 0 && items[j]!.tdist > x.tdist) {
      items[j + 1] = items[j]!;
      j--;
    }
    items[j + 1] = x;
  }
}

/**
 * Keeps name tags readable in a crowd: the nearest keep their place, the next ones stack above what they would
 * cover (up to three lifts), the rest are hidden, and no more than `cap` show. Farther tags fade. Works in
 * place on the first `n` entries of `items` (reordering them); nothing is allocated.
 */
export function declutterTags(items: TagSlot[], n: number, cap: number): void {
  sortNearFirst(items, n);
  let shown = 0;
  for (let i = 0; i < n; i++) {
    const s = items[i]!;
    s.tshift = 0;
    s.thide = true;
    s.talpha = Math.max(0.4, Math.min(1, 1 - (s.tdist - NEAR) / (FAR - NEAR)));
    if (shown >= cap) continue;
    for (let k = 0; k <= LIFTS; k++) {
      const y = s.ty - k * TAG_H;
      let clear = true;
      for (let j = 0; j < i; j++) {
        const o = items[j]!;
        if (o.thide) continue;
        const oy = o.ty - o.tshift;
        if (Math.abs(o.tx - s.tx) < TAG_W && Math.abs(oy - y) < TAG_H) {
          clear = false;
          break;
        }
      }
      if (clear) {
        s.tshift = k * TAG_H;
        s.thide = false;
        shown++;
        break;
      }
    }
  }
}

/** Most name tags at once, by tier. */
export const tagCap = (tier: "low" | "medium" | "high" | "ultra"): number =>
  tier === "ultra" ? 40 : tier === "high" ? 24 : 12;
