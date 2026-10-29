/**
 * The shopkeepers: one bot behind each shop's counter (`shoprooms.ts`), like Bent the barkeep. They never
 * leave their spot (`still`) and mutter harmless shop talk now and then to whoever is browsing.
 */

import type { BotDef } from "./bots.ts";
import { BOT_LEVEL } from "./format.ts";
import { SHOP_ROOM, SHOPS, type ShopId } from "./shoprooms.ts";
import { type Facing, lookWith } from "./world.ts";

const keeper = (
  id: ShopId,
  botId: number,
  facing: Facing,
  def: Pick<BotDef, "look" | "bio" | "lines" | "every">,
): BotDef => ({
  id: botId,
  name: SHOPS[id].keeperName,
  level: BOT_LEVEL,
  home: { room: SHOP_ROOM[id], x: SHOPS[id].keeper[0], y: SHOPS[id].keeper[1], facing },
  still: true,
  followChance: 0,
  ...def,
});

export const SHOPKEEPERS: BotDef[] = [
  keeper("furniture", -5, "up", {
    look: lookWith({ style: 3, skin: 1, hair: 2, outfit: 6, glasses: 1 }),
    bio: "Runs Møbelhuset, the furniture showroom. Measures everything twice and sells you the rug anyway.",
    lines: [
      "Everything is flat-packed. Except the opinions.",
      "That sofa is more comfortable than it looks. And it looks very comfortable.",
      "Wallpaper samples are on the west wall. Touch with your eyes, please.",
      "A good desk is a long-term investment. Like a good rubber duck.",
      "Take your time. The chairs are for testing.",
      "Yes, the rug ties the room together. No, it is not negotiable.",
      "Hygge is a lamp, a blanket and no notifications.",
      "Do you need a bookshelf? Everyone needs a bookshelf.",
    ],
    every: [40_000, 120_000],
  }),
  keeper("clothes", -6, "down", {
    look: lookWith({ style: 2, skin: 2, hair: 5, outfit: 12, glasses: 2 }),
    bio: "Runs Thread & Token, the clothes shop. Can tell your size, your sprint and your build status at a glance.",
    lines: [
      "Hats are by the north wall. Try them all, they are not contagious.",
      "That outfit? It says 'I merged on a Friday'. Bold.",
      "Everything here is machine washable. Except the merge-conflict drop.",
      "A good hat is worth ten tokens. Ask me which ones.",
      "Mirror's by the door, if you want to know the truth.",
      "No returns on drops. The rate limit applies to refunds too.",
      "Layers are a lifestyle. Also a fine way to hide a hoodie.",
      "Fits perfectly? Then it's the wrong size. Go one up.",
    ],
    every: [40_000, 120_000],
  }),
  keeper("barber", -7, "down", {
    look: lookWith({ style: 0, skin: 1, hair: 5, outfit: 3, held: 1 }),
    bio: "Figaro keeps the chairs at Figaro's, the barber shop. Has never once run out of small talk.",
    lines: [
      "A little off the sides? Or are we feeling brave today?",
      "Hair grows back. Commits do not.",
      "The mirror never lies. It just flatters you slightly less on Mondays.",
      "You sit, I snip, we both pretend the weather is interesting.",
      "A new colour is the cheapest refactor there is.",
      "Fresh cut, fresh start. No git history required.",
      "Mind the chair. It spins. Everybody spins it.",
      "Beards are a work in progress. Like every codebase.",
    ],
    every: [40_000, 120_000],
  }),
  keeper("pets", -8, "down", {
    look: lookWith({ style: 3, skin: 3, hair: 4, outfit: 9 }),
    bio: "Wren looks after the pet shop. Knows every animal by name, and what each of them thinks of you.",
    lines: [
      "No, the dragon does not bite. Much.",
      "Pets don't judge your token count. They just want snacks.",
      "That one has been looking at you since you came in. It has decided.",
      "Collars and bows are by the north wall. Every pet likes a bow.",
      "The cats run the shop. I just do the paperwork.",
      "A pet follows you everywhere. Even into stand-up.",
      "If one of them naps on your keyboard, that is a promotion.",
      "Fresh water in every pen. Good habits start early.",
    ],
    every: [40_000, 120_000],
  }),
  keeper("natmarked", -9, "down", {
    look: lookWith({ style: 1, skin: 2, hair: 3, outfit: 14, glasses: 0 }),
    bio: "Runs Natmarked, the night market hall. Closes the stalls at dawn and never says what is in the next case.",
    lines: [
      "The lanterns are lit at dusk. They have never once been turned off.",
      "Every case is sealed at the stall. I only hold the key.",
      "Noodles from the corner stall, steam from the other. Mind your sleeves.",
      "Those shelves in the back are for cases that are not here yet. Come back after dark.",
      "A case is a small adventure. Whatever is inside, it is yours the moment it opens.",
      "Doubles? Bring them to the counter. The vendors always want a spare.",
      "Hats, pets, lanterns. The market never tells you in advance.",
      "Take your time. The night is long, and the stalls are not going anywhere.",
    ],
    every: [40_000, 120_000],
  }),
  keeper("market", -10, "down", {
    look: lookWith({ style: 2, skin: 1, hair: 5, outfit: 9, glasses: 0 }),
    bio: "Minds Torvehallen, the market hall. Never sells a thing himself; every case holds somebody else's.",
    lines: [
      "Everything under the glass is somebody's. The price is theirs too.",
      "Put something of yours in a case. It sells while you sleep.",
      "A week, then it comes down and goes home to its owner.",
      "No haggling. The tag says what it says.",
      "Numbered copies show their number. Low ones go quickly.",
      "Mind the glass. It is cleaner than it looks.",
      "Cases are first come, first served. A sold one is free again at once.",
      "I only keep the keys. The hall belongs to whoever has something to show.",
    ],
    every: [40_000, 120_000],
  }),
];

/** What the keeper says when you step in or come up to the counter. */
export const GREETINGS: Record<ShopId, readonly string[]> = {
  furniture: [
    "Welcome to Møbelhuset. Sit on anything. Buy anything.",
    "Hej! Looking for something for the office, or for the company?",
  ],
  clothes: [
    "Welcome to Thread & Token. Try anything on, the mirror is by the door.",
    "Hi! Hats north, outfits in the middle, everything else wherever I left it.",
  ],
  barber: [
    "Take a seat. A little off the top?",
    "Welcome to Figaro's. The mirror is free, the small talk is too.",
  ],
  market: [
    "Welcome to Torvehallen. Everything here belongs to someone else, and all of it is for sale.",
    "Hej! Browse the cases, or put something of your own on one.",
  ],
  natmarked: [
    "Welcome to Natmarked. Mind the lanterns, they are older than they look.",
    "Hej! The stalls are open. Today's case is on the counter.",
  ],
  pets: [
    "Welcome! Mind the dragon, it only looks hungry.",
    "Hello! Take your time, they are choosing you as much as you are choosing them.",
  ],
};

/** The keeper's greeting as a line, `n` picks which of them (any number). */
export const greeting = (shop: ShopId, n = 0): string =>
  `${SHOPS[shop].keeperName}: "${GREETINGS[shop][n % GREETINGS[shop].length]}"`;
