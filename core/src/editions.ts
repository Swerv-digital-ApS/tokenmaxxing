/**
 * Merchant editions: the cosmetics only the traveling merchant sells (`merchant.ts`), a few each
 * week, each a numbered print run ("#3 of 20"). They are hats and glasses like the shop's, worn
 * through `Look`, but their indices start at `EDITION_BASE`, so the shop can grow without the two
 * ever meeting. The art is in `web/src/art/editions.ts`, keyed by the same ids.
 */
import type { Item } from "./shop.ts";

/** Look indices from here up, in the hat and glasses slots, are merchant editions. */
export const EDITION_BASE = 100;

export interface Edition extends Item {
  slot: "hat" | "glasses";
  /** One line of flavour on the cart. */
  blurb: string;
  /** Copies in one week's print run. */
  supply: number;
}

const edition = (
  slot: Edition["slot"],
  n: number,
  name: string,
  price: number,
  supply: number,
  blurb: string,
): Edition => ({
  id: `${slot}.${EDITION_BASE + n}`,
  slot,
  index: EDITION_BASE + n,
  name,
  price,
  tradeable: true,
  // A short print run is what makes an edition rare, whatever it costs.
  rarity: supply <= 10 ? "legendary" : supply <= 15 ? "epic" : "rare",
  blurb,
  supply,
});

/** Never reorder or reuse: the ids are in bags. Add new ones at the end of their slot. */
// A catalog reads best one edition a line.
// prettier-ignore
export const EDITIONS: readonly Edition[] = [
  edition("hat", 0, "Prompt wizard hat", 220, 20, "Every star stitched on is a system prompt that worked first try."),
  edition("hat", 1, "Green-CI halo", 400, 12, "Glows for as long as the build stays green. So, briefly."),
  edition("hat", 2, "Release party hat", 120, 25, "Worn for v1.0.0. And v1.0.1, an hour later."),
  edition("hat", 3, "Propeller beanie", 160, 20, "Spins a little faster with every token per second."),
  edition("hat", 4, "Spaghetti chef's toque", 180, 20, "Cooks legacy code al dente."),
  edition("hat", 5, "Friday deploy stetson", 260, 15, "Yeehaw, straight to prod. No staging on the open range."),
  edition("hat", 6, "Force-push helm", 300, 15, "Horns for pushing. No reviews were taken."),
  edition("hat", 7, "Cat-5 ears", 200, 20, "Twisted-pair whiskers, rated for gigabit purrs."),
  edition("hat", 8, "Antenna headband", 140, 25, "Picks up new models before the changelog does."),
  edition("hat", 9, "Cache-hit mushroom", 240, 15, "Grows best in warm, dark caches. Hit rate: delicious."),
  edition("hat", 10, "Borrowed-token tricorn", 320, 12, "Arr. All yer tokens be on someone else's plan."),
  edition("hat", 11, "429 bucket hat", 150, 20, "Holds exactly one leaky bucket of requests. Try again later."),
  edition("hat", 12, "Benchmark laurels", 500, 8, "Crowned state of the art. Valid until Tuesday."),
  edition("hat", 13, "Copenhagen ushanka", 280, 15, "For waiting on the bike lane in February."),
  edition("glasses", 0, "VR visor", 350, 12, "Renders the whole town in 8K. It's still pixels."),
  edition("glasses", 1, "Pricing-page monocle", 260, 15, "For reading the fine print on 'unlimited'."),
  edition("glasses", 2, "3D diff specs", 140, 25, "Red for removed, cyan for added. Headache included."),
  edition("glasses", 3, "Deal-with-it pixels", 300, 15, "They slide down slowly, after the tests pass."),
  edition("glasses", 4, "Five-star shades", 180, 20, "Five points for every five-star review."),
  edition("glasses", 5, "Code-review laser visor", 420, 10, "Scans a whole PR in one red sweep. Finds a nit."),
];

/** The edition a look index stands for in a slot, if it is one. */
export const editionAt = (slot: string, index: number): Edition | undefined =>
  index >= EDITION_BASE ? EDITIONS.find((e) => e.slot === slot && e.index === index) : undefined;

export const editionById = (id: unknown): Edition | undefined => EDITIONS.find((e) => e.id === id);
