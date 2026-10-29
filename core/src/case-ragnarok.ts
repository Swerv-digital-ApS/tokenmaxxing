/**
 * The Ragnarok Eve case: the gods' last feast before the end of the world, in cosmetics only a case opening
 * gives (never sold in a shop, never dropped by a raid). Like the Night Market case (`case.ts`) they are worn
 * through `Look` and tradeable the moment they're opened, but their indices start at `RAGNAROK_BASE`, so the
 * three ranges (shop and loot below 300, Night Market 300 to 399, Nusantara 400 to 499, this 500 to 599) never
 * meet. The art is keyed by the same indices. Design brief: `docs/cases/ragnarok-eve.md`.
 */
import type { CaseItem, CaseSlot } from "./case.ts";
import type { Rarity } from "./rarity.ts";

/** Look indices from here up to `RAGNAROK_BASE + 99`, in a case slot, are Ragnarok Eve items. */
export const RAGNAROK_BASE = 500;

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${RAGNAROK_BASE + n}`,
  slot,
  index: RAGNAROK_BASE + n,
  name,
  price: 0,
  tradeable: true,
  rarity,
  blurb,
  case: true,
});

/** Never reorder or reuse: the ids are in bags. Add new ones at the end of their slot. */
// A catalog reads best one item a line.
// prettier-ignore
export const RAGNAROK_ITEMS: readonly CaseItem[] = [
  // Common
  entry("hat", 0, "Fur hood", "common", "Wolf-grey fur, and the snow slides right off."),
  entry("hat", 1, "Nasal helm", "common", "Plain iron and a nose guard. Not one horn, which is how they actually looked."),
  entry("hat", 2, "Beaded braids", "common", "Three braids, a bead on each, one dipped in the soup."),
  entry("held", 0, "Drinking horn", "common", "Passed round the hall, starting with Odin. It gets to you eventually."),
  entry("held", 1, "Round shield", "common", "Painted in quarters. Good for blocking, better for sledding."),
  entry("held", 2, "Tafl board", "common", "The king in the middle, and a lot of opinions around him."),
  entry("held", 3, "Bearded axe", "common", "Chops firewood. Mostly firewood."),
  entry("glasses", 0, "Warpaint stripes", "common", "Two blue stripes across the eyes. Washes off. Mostly."),
  entry("glasses", 1, "Frosted specs", "common", "Rimed with ice because you left them on the porch."),
  entry("outfit", 0, "Wool tunic", "common", "Itchy, sturdy, belted, and smells of wood smoke."),
  entry("outfit", 1, "Brewer's apron", "common", "Splashed with the third batch. It was supposed to be the first."),
  // Uncommon
  entry("hat", 3, "Opera horns", "uncommon", "Never worn by a Viking. Worn by every Viking in the opera."),
  entry("back", 0, "Fur mantle", "uncommon", "A shaggy shoulder cape that sheds a bit every time you sneeze."),
  entry("glasses", 2, "Mimir's lens", "uncommon", "Drawn from the well of wisdom. The price was one eye, and you kept both."),
  entry("held", 4, "Squeaky Mjölnir", "uncommon", "Foam, squeaks on impact, and returns to your hand roughly never."),
  entry("outfit", 2, "Yoke sweater", "uncommon", "A Nordic knit with a snowflake yoke. Warm enough for the end of the world."),
  entry("outfit", 3, "Byrnie", "uncommon", "Ten thousand little rings, and at least one of them is yours."),
  // Rare
  entry("pet", 0, "Huginn and Muninn", "rare", "Thought and Memory, back from the day's flight with news you didn't want."),
  entry("pet", 1, "Ratatoskr", "rare", "Runs up the tree and down again carrying gossip, all of it unkind."),
  entry("pet", 2, "Tanngrisnir", "rare", "One of Thor's goats, gnashing its teeth. Gets eaten for dinner and is back by morning."),
  entry("pet", 3, "Hildisvíni", "rare", "Freyja's boar. Its bristles gleam gold and it is very proud of them."),
  entry("outfit", 4, "Berserker bearskin", "rare", "Growls on its own. Do not feed it after midnight."),
  // Epic
  entry("pet", 4, "Sleipnir foal", "epic", "Eight legs, all of them in a hurry."),
  entry("pet", 5, "Fenrir pup", "epic", "A wolf pup on a ribbon too thin to hold anything. It will hold, for now."),
  entry("outfit", 5, "Valkyrie plate", "epic", "Silver plate that throws light across the whole sky and pours a decent horn of mead."),
  entry("back", 1, "Skíðblaðnir", "epic", "The best of ships, folded like a handkerchief on your back and ready to unfold."),
  // Legendary
  entry("aura", 0, "Bifröst", "legendary", "The burning bridge between worlds, curled round your shoulders."),
  entry("aura", 1, "Valkyrie Lights", "legendary", "They say the flicker is valkyrie armour catching the light."),
  entry("aura", 2, "Rune Gale", "legendary", "Odin hung nine nights to learn them. They've been following you since."),
  entry("aura", 3, "Ginnungagap", "legendary", "Where the ice met the embers and the world began."),
];
