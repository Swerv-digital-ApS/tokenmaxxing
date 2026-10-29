/**
 * Snapshot of 2D colour tables the 3D gear needs, so `gear3d.ts` doesn't pull in the pixel-art modules.
 * Sources: `web/src/art/wardrobe.ts` (OUTFITS 13-25: main, shade, trousers), `web/src/art/loot.ts`
 * (LOOT_OUTFITS), `web/src/art/merch.ts` (PAIRS) and `core/src/milestones.ts` (LEGENDARY_LEVEL).
 */

/** Wardrobe and loot outfits above the shop's: [main, shade, trousers]. Index is the outfit id. */
export const EXTRA_OUTFITS: Record<number, [string, string, string]> = {
  13: ["#3b2f6b", "#2a2150", "#22223a"],
  14: ["#f2c230", "#c99a1a", "#2f3444"],
  15: ["#f4f4f0", "#cfd3d6", "#3d4a6b"],
  16: ["#c43b3b", "#8a2424", "#3d4a6b"],
  17: ["#8a8f99", "#5f646d", "#c9b48a"],
  18: ["#2f8f4e", "#1f6a38", "#2f3444"],
  19: ["#24242c", "#15151b", "#15151b"],
  20: ["#eef0f4", "#b8bec8", "#d9dde3"],
  21: ["#2fa39a", "#1f7a73", "#2fa39a"],
  22: ["#f2f0ea", "#cfcac0", "#3f6fb0"],
  23: ["#3a4fb8", "#28388a", "#3a4fb8"],
  24: ["#f28a1e", "#c96a10", "#3d4a6b"],
  25: ["#ffd54a", "#d99a16", "#7a4fb8"],
  // Raid loot: compacting scarf, two-tone suit, shimmering cape, pinstripe suit.
  26: ["#e7e1d3", "#c9c0ad", "#3d4a6b"],
  27: ["#4f8fe0", "#3a6fb8", "#2f3444"],
  28: ["#2a2150", "#5b3fbf", "#22223a"],
  29: ["#2f3a55", "#1f2740", "#1f2740"],
  // The Night Market case (`core/src/case.ts`, from CASE_BASE = 300): noodle apron, happi coat, cargo bomber,
  // techwear coat, dragon satin jacket, festival parade.
  300: ["#3a3f4b", "#2a2e38", "#2f3444"],
  301: ["#2f4a8a", "#1f3366", "#2a2f45"],
  302: ["#6b7a3f", "#4d5a2a", "#4a4a3a"],
  303: ["#23252f", "#15161c", "#15161c"],
  304: ["#18353f", "#0f232b", "#222a35"],
  305: ["#d6343a", "#9a2128", "#f2eadb"],
  // The Nusantara case (`core/src/case-nusantara.ts`, from NUSANTARA_BASE = 400): batik shirt, deckhand stripes,
  // kebaya, silat pangsi, songket gala, ondel-ondel.
  400: ["#6b4226", "#4d2f1a", "#2f3444"],
  401: ["#243a73", "#1a2a58", "#c9b88c"],
  402: ["#1f8a8a", "#16696b", "#6b4226"],
  403: ["#1c1c22", "#101014", "#1c1c22"],
  404: ["#a81f35", "#7a1426", "#8e1a2e"],
  405: ["#d6343a", "#a6242a", "#6c8f2f"],
  // The Ragnarok Eve case (`core/src/case-ragnarok.ts`, from RAGNAROK_BASE = 500): wool tunic, brewer's apron, yoke
  // sweater, byrnie, berserker bearskin, valkyrie plate.
  500: ["#7a6a58", "#5a4d3f", "#4a4038"],
  501: ["#8a6a46", "#6b4e32", "#4a4038"],
  502: ["#e8dfc8", "#c9bfa5", "#2b3a5a"],
  503: ["#7e8794", "#5d6676", "#3f3a36"],
  504: ["#6b4a2e", "#4a3320", "#3a2a1e"],
  505: ["#aab4c2", "#7a8394", "#26324a"],
};

/** Companies without a brand get one of these by id: [main, accent]. */
export const MERCH_PAIRS: [string, string][] = [
  ["#3a6fb8", "#f5d14a"],
  ["#c4544b", "#fbf7ef"],
  ["#3f8c50", "#f4efe4"],
  ["#5b3fbf", "#3ddc84"],
  ["#2c3142", "#f08a3c"],
  ["#e0a15a", "#2b2433"],
  ["#cf6690", "#fbf7ef"],
  ["#1f2a24", "#3ddc84"],
];

/** The level that lights the golden aura (MAX_LEVEL). */
export const LEGENDARY_LEVEL = 50;
