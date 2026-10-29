/**
 * The world's maps as character grids. The client draws them and the server
 * checks steps against them, so every tile is defined exactly once, here.
 * One character per tile; `LEGEND` says what it is.
 */
import { sortBy } from "hanzio";
import { ALL_CASE_PIECES } from "./case-furniture.ts";
import { HOME_PIECES } from "./home.ts";
import { POSTERS } from "./posters.ts";

import { SHOP_BODY_CHAR, SHOP_DOOR_CHAR, SHOP_IDS, SHOPS, type ShopId } from "./shoprooms.ts";
import { TAVERN } from "./tavern.ts";
import { WINDMILL } from "./windmill.ts";

export type MapId =
  | "town"
  | "hq"
  | "common"
  | "inn"
  | "upstairs"
  | "basement"
  | "office"
  | "dungeon"
  | "shop-furniture"
  | "shop-clothes"
  | "shop-barber"
  | "shop-pets"
  | "shop-natmarked"
  | "shop-market";
export type SeatKind = "bench" | "sofa" | "bed" | "chair";

interface TileKind {
  name: string;
  walk?: true;
  /** E while facing it sits you down (beds lie you down). */
  seat?: SeatKind;
  /** Stepping into it changes room. */
  portal?: true;
  /** Shown when you press E facing it. */
  text?: string;
  /** E while facing the seat sits you down at the poker table in the net cafe (`pokerSit`), not just on the chair. */
  poker?: true;
  /** E while facing the spot opens the roulette panel (the net cafe's roulette table). */
  roulette?: true;
  /** E while facing it pours you a coffee (`drink`). */
  pours?: true;
  /** E while facing it serves the day's special (`tavern`, the Tavern's tap). */
  serves?: true;
  /** The barkeep takes your order across it (the Tavern's bar): a coffee (`drink`) or the special (`tavern`). */
  orders?: true;
  /** E while facing it tosses a coin in (`toss`): the square's fountain, the Tavern's tip jar. */
  tosses?: true;
  /** A shop's display: E while facing it opens the Shop page on the matching tab (`displayTab`). */
  shop?: ShopId;
  /** A shop's counter: E while facing it opens the Shop page. */
  counter?: true;
}

export const LEGEND: Record<string, TileKind> = {
  ".": { name: "grass", walk: true },
  ",": { name: "path", walk: true },
  ":": { name: "plaza", walk: true },
  '"': { name: "flowers", walk: true },
  _: { name: "floor", walk: true },
  "=": { name: "rug", walk: true },
  T: { name: "tree", text: "A tree. It has seen a lot of deploys." },
  "~": { name: "water", text: "The water is calm. Someone dropped a USB stick in there." },
  "^": { name: "bush", text: "Just a bush. It rustles." },
  L: { name: "lamp", text: "The lamp hums quietly. It's always on, like a good server." },
  F: { name: "fountain", tosses: true, text: "A fountain. People toss spare tokens in for luck." },
  // Its sails turn with the real wind (`windmill.ts`); E says how hard it blows.
  [WINDMILL]: { name: "windmill", text: "A windmill. Its sails turn with the wind over Aarhus." },
  N: { name: "board", text: "The leaderboard." },
  // The star counter (`stars.ts`): the project's GitHub stars; E opens it, with a button to star it.
  "★": { name: "star counter", text: "The star counter." },
  // The statue of the #1 model (`statue.ts`): the client reads its plaque out.
  "♛": { name: "statue" },
  // The chalkboards (outside the Tavern, and inside it): the client writes today's special on them.
  K: { name: "chalkboard" },
  B: { name: "bench", seat: "bench", text: "A bench with a view of the square." },
  H: { name: "building" },
  W: { name: "wall" },
  b: { name: "bed", seat: "bed", text: "A bed. Unmade. Someone shipped late last night." },
  d: { name: "desk", text: "A laptop covered in stickers. Four agents are still running." },
  c: { name: "chair", seat: "chair", text: "An ergonomic chair. Your back says thanks." },
  s: { name: "sofa", seat: "sofa", text: "A comfy sofa. Perfect for a quick nap." },
  t: { name: "tv", text: "It's a show about context windows. Season 7." },
  k: { name: "shelf", text: "Books about prompting, caching and cold starts." },
  p: { name: "plant", text: "A healthy plant. Someone remembers to water it." },
  // Earned at an outage picnic, never sold (`office.ts`).
  g: {
    name: "touched grass",
    text: "🌱 Touched grass. A patch from an outage picnic: the agents stopped, and you went outside.",
  },
  o: { name: "coffee", pours: true },
  // The Tavern (`inn`): E on the bar orders from the barkeep, on the quest board opens the quests, on the wall
  // the Hall of Fame, on a plaque the regulars; the tap serves the day's special.
  a: { name: "bar", orders: true, text: "A long oak bar, polished by years of elbows." },
  y: { name: "beer tap", serves: true },
  v: { name: "stool", seat: "chair", text: "A bar stool. Round, red and a little wobbly." },
  n: { name: "table", text: 'A sturdy table. Someone carved "TODO" into it.' },
  f: { name: "hearth", text: "A crackling fire. The logs are all deprecated APIs." },
  e: { name: "stage", walk: true },
  h: { name: "barrel", text: "A barrel. Cold brew, they say." },
  m: { name: "quest board", text: "The quest board." },
  A: { name: "hall of fame", text: "The Hall of Fame." },
  P: { name: "plaque", text: "The regulars' plaque." },
  // The bar tab: a run of wall tiles; the client chalks the week's top five by time on it (`regulars.ts`).
  J: { name: "bar tab", text: "The bar tab. Who has spent the most time here this week." },
  // The tip jar on the bar (the indoor stand-in for the fountain): E tosses a coin in.
  $: { name: "tip jar", tosses: true, text: "A tip jar on the bar. A spare coin clinks nicely." },
  z: { name: "jukebox", text: "A jukebox. It hums, waiting for a coin it never asks for." },
  // The poker table (`poker.ts`, in the basement net cafe): a 4×2 table of felt, and the six chairs round it; E on
  // a chair buys you in. Beside it the roulette table: a 3×2 block and eight spots, four on each long side, where players stand.
  ...(TAVERN
    ? {
        "♠": {
          name: "poker table",
          text: "A poker table. Texas Hold'em, blinds of 1 and 2. Sit in a chair to buy in.",
        },
        "♣": {
          name: "poker chair",
          seat: "chair",
          poker: true,
          text: "A card-room chair. E buys you in at the poker table.",
        },
        "♦": {
          name: "roulette table",
          text: "A roulette table. The wheel is honest. That is the problem.",
        },
        "♥": {
          name: "roulette spot",
          walk: true,
          roulette: true,
          text: "A spot at the roulette table. E to place your bets.",
        },
      }
    : {}),
  Q: { name: "pet bed", text: "A round cushion basket. Your pet curls up here when you're in your office." },
  I: { name: "inn door", portal: true },
  // The basement net cafe under the Tavern: stairs down in the Tavern's bottom wall, five cabinets (one per
  // game), the livestream screen, and two wall terminals (the leaderboard, the raid).
  S: { name: "stairs down", portal: true },
  // The Tavern's way up to the rooms, where everyone without a company sleeps.
  u: { name: "stairs up", portal: true },
  // The Tavern's coat and umbrella stands by the door.
  O: { name: "coat stand", text: "Coats, scarves and one very damp umbrella." },
  C: { name: "cabinet", text: "INSERT TOKEN." },
  E: { name: "big screen", text: "The livestream. Every match in town, live." },
  M: { name: "wall terminal", text: "A wall terminal." },
  // The tournament board (`tournament.ts`); E opens it. The basement is the Tavern's, so `TAVERN` gates it.
  ...(TAVERN ? { i: { name: "tournament board", text: "The tournament board." } } : {}),
  // The world clocks (`clocks.ts`), on the Tavern's north wall by the hearth: the client sets their hands and says the time.
  ...(TAVERN ? { "◷": { name: "world clocks" } } : {}),
  // The request pile (`requests.ts`), on the Tavern's north wall; E opens it.
  ...(TAVERN
    ? { "?": { name: "request pile", text: "The request pile. What people would like in the game." } }
    : {}),
  // The four shops on the town's streets: a 5×4 front (`Ħ`) with its door in the middle (`shoprooms.ts`).
  ƒ: { name: "furniture shop door", portal: true },
  Ç: { name: "clothes shop door", portal: true },
  Ð: { name: "barber shop door", portal: true },
  ð: { name: "pet shop door", portal: true },
  Ñ: { name: "night market door", portal: true },
  Ƭ: { name: "market hall door", portal: true },
  Ħ: { name: "shop front", text: "A shop front. The door is open: come on in." },
  // Inside them: the counter, each shop's displays and the fixtures that are only to look at.
  "¢": { name: "shop counter", counter: true, text: "The counter. Press E to browse the shop." },
  "¤": { name: "furniture display", shop: "furniture", text: "A showroom piece with a price tag." },
  "§": {
    name: "clothes rack",
    shop: "clothes",
    text: "A rack of clothes and accessories, price tags swinging.",
  },
  "¶": {
    name: "styling station",
    shop: "barber",
    text: "A styling station: mirror, combs and a rack of colours.",
  },
  "¥": { name: "pet pen", shop: "pets", text: "A pen. Somebody inside is already looking at you." },
  Ŧ: {
    name: "lantern shelf",
    shop: "natmarked",
    text: "A glowing shelf of lacquer and paper. Press E to see the cases.",
  },
  Ƙ: {
    name: "display",
    shop: "market",
    text: "A glass case. Press E to see what's on it, or to put something of yours there.",
  },
  "‡": { name: "fixture", text: "Part of the shop's fittings." },
  x: { name: "exit", portal: true },
  D: { name: "door", portal: true },
  R: { name: "office door", portal: true },
  // Its trophies are its owner's (`trophies.ts`); E shows what each is for.
  U: { name: "trophy shelf" },
  G: { name: "dungeon gate", portal: true },
  q: { name: "stone floor", walk: true },
  Z: { name: "dais", text: "The boss's dais. It hums with stolen compute." },
  l: { name: "war desk", text: "A raider's laptop. Run an agent and you're at one, wherever you are." },
  r: { name: "raider's seat", seat: "chair" },
  j: { name: "torch", text: "A torch. It flickers like a flaky test." },
  // The raid's trophies (`TROPHIES` in loot.ts), placed like furniture.
  Y: { name: "golden hourglass", text: "The Golden Hourglass. Its sand never runs out." },
  V: { name: "golden rebase", text: "The Golden Rebase. History, rewritten in gold." },
  // The company building's furniture (`COMPANY_FURNITURE` in office.ts).
  ε: { name: "beanbag", seat: "sofa", text: "A beanbag. Getting up is a two-step process." },
  ρ: { name: "bonsai", text: "A bonsai. Forty years old, older than the codebase." },
  Φ: { name: "water cooler", text: "Glug. The best gossip in the building starts here." },
  Δ: { name: "persian rug", walk: true },
  ψ: { name: "mini fridge", text: "Club-Mate, oat milk and three kinds of sparkling water." },
  Ω: { name: "coffee table", text: "Walnut. Coasters, please." },
  χ: { name: "monstera", text: "A monstera. Dramatic, but thriving." },
  τ: { name: "globe", text: "Every office on it has a pin. Yours is the biggest." },
  σ: { name: "lava lamp", text: "Blobs rise and fall, like your token budget." },
  ξ: { name: "whiteboard", text: "A diagram with 14 arrows and the word AGENTS circled three times." },
  Λ: { name: "arc lamp", text: "An arc lamp. Very Milan, 1962." },
  Ξ: { name: "bookshelf", text: "Books about prompting, caching and cold starts, alphabetised." },
  μ: { name: "lounge chair", seat: "sofa", text: "A Danish lounge chair: teak, wool and opinions." },
  ν: { name: "record player", text: "Lo-fi beats to tokenmax to. Side B." },
  δ: { name: "neon sign", text: "Your name in lights. It hums a little." },
  Σ: { name: "chesterfield", seat: "sofa", text: "A buttoned leather Chesterfield. Investors sit here." },
  Π: { name: "vending machine", text: "Snacks for 🪙 0. The company pays." },
  ζ: { name: "standing desk", text: "A standing desk, set to sitting height. Nobody tells." },
  ι: { name: "plant wall", text: "A wall of moss and ferns. The air is noticeably better here." },
  φ: { name: "foosball table", text: "Foosball. The keeper rod is suspiciously worn." },
  α: { name: "espresso bar", pours: true },
  η: { name: "server rack", text: "Blinking lights. It's running the staging environment." },
  β: { name: "arcade cabinet", text: "INSERT TOKEN. High score: 9,999,999, by the CTO." },
  κ: { name: "trophy case", text: "Trophies for most tokens, longest streak and best demo day." },
  γ: { name: "aquarium", text: "Neon tetras. One is named Claude." },
  θ: { name: "ping-pong table", text: "Ping-pong. First to 11, loser writes the tests." },
  ω: { name: "gong", text: "Strike it when you ship to prod. Everyone will know." },
  λ: { name: "chandelier", walk: true, text: "Crystal chandelier. Series A money." },
  Γ: { name: "duck statue", text: "A golden rubber duck. It has heard every bug explained to it." },
  w: { name: "open offices", text: "Offices that are open for visitors." },
  // The company house's directory (`MAPS.hq`): E lists the building's offices, and walks you to a door.
  ς: { name: "office directory", text: "The office directory." },
  // The company's common room upstairs (`MAPS.common`, `common.ts`): its own pieces, so nothing clashes.
  Ψ: { name: "window", text: "A big window. The sky out there is somebody else's problem." },
  Θ: {
    name: "wall of wins",
    text: "The wall of wins. Shipped, merged, launched: every win is up here, big or small.",
  },
  π: { name: "kitchen counter", text: "A kitchen counter. The oat milk has someone's name on it." },
  // Posters (`POSTERS`): on the building's top wall, so they never block a step.
  ...Object.fromEntries(
    POSTERS.map((p) => [p.ch, { name: `${p.name} poster`, text: `🖼 ${p.name}. ${p.text}` }]),
  ),
  // Personal offices' own furniture (`HOME_PIECES`): a seat, a rug to walk over, or just something to look at.
  ...Object.fromEntries(
    [...HOME_PIECES, ...ALL_CASE_PIECES].map((p): [string, TileKind] => [
      p.ch,
      {
        name: p.name.toLowerCase(),
        ...(p.text && { text: p.text }),
        ...(p.seat && { seat: p.seat }),
        ...(p.flat && { walk: true as const }),
      },
    ]),
  ),
};

/** `GameMap.find`'s answers, kept outside the map so two maps with the same tiles still compare equal. */
const found = new WeakMap<GameMap, Map<string, readonly [number, number][]>>();

/**
 * A map's tiles. `rows[0][0]` is tile (x0, y0): the town grows in every direction, so its tiles keep
 * their coordinates as it does (they can be negative); rooms start at (0, 0).
 */
export class GameMap {
  readonly width: number;
  readonly height: number;

  constructor(
    readonly id: MapId,
    readonly name: string,
    readonly rows: readonly string[],
    readonly x0 = 0,
    readonly y0 = 0,
    /** An office's wallpaper and floor (`decor.ts`), which the client draws; unset is the plain room. */
    readonly decor?: { wall?: string; floor?: string },
  ) {
    this.width = rows[0]!.length;
    this.height = rows.length;
  }

  /** Tile character; outside the map reads as a wall. */
  at(x: number, y: number): string {
    return this.rows[y - this.y0]?.[x - this.x0] ?? "W";
  }

  contains(x: number, y: number): boolean {
    return x >= this.x0 && y >= this.y0 && x < this.x0 + this.width && y < this.y0 + this.height;
  }

  /** A tile's slot in a flat array of `width × height`. */
  index(x: number, y: number): number {
    return (y - this.y0) * this.width + (x - this.x0);
  }

  kind(x: number, y: number): TileKind {
    return LEGEND[this.at(x, y)] ?? LEGEND.W!;
  }

  walkable(x: number, y: number): boolean {
    return this.kind(x, y).walk === true;
  }

  /** Every tile with character `ch`, in reading order. Kept per character: the rows never change. */
  find(ch: string): readonly [number, number][] {
    let byCh = found.get(this);
    if (!byCh) {
      byCh = new Map();
      found.set(this, byCh);
    }
    const hit = byCh.get(ch);
    if (hit) return hit;
    const out: [number, number][] = [];
    this.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x + this.x0, y + this.y0]);
    });
    byCh.set(ch, out);
    return out;
  }
}

/**
 * What a 3D builder needs of a room, read off its tiles: the size, every portal (a door or stairs), every
 * seat and every tile that says something when you press E (a board, a display, the counter).
 */
export interface RoomLayout {
  id: MapId;
  width: number;
  height: number;
  doors: { ch: string; x: number; y: number }[];
  seats: { ch: string; kind: SeatKind; x: number; y: number }[];
  /** Shops' displays and counters. */
  displays: { ch: string; shop: ShopId | "counter"; x: number; y: number }[];
}

export function layoutOf(map: GameMap): RoomLayout {
  const layout: RoomLayout = {
    id: map.id,
    width: map.width,
    height: map.height,
    doors: [],
    seats: [],
    displays: [],
  };
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx]!;
      const kind = LEGEND[ch];
      const [x, y] = [rx + map.x0, ry + map.y0];
      if (kind?.portal) layout.doors.push({ ch, x, y });
      if (kind?.seat) layout.seats.push({ ch, kind: kind.seat, x, y });
      if (kind?.shop) layout.displays.push({ ch, shop: kind.shop, x, y });
      else if (kind?.counter) layout.displays.push({ ch, shop: "counter", x, y });
    }
  });
  return layout;
}

// MARK: The town

/**
 * The town is a grid of blocks. The square, the Inn and the pond are the core (2×2 blocks around
 * block (0, 0)); every company is one block, its plot, which it picks when it starts (any empty block
 * next to the town). The map is exactly the blocks in use, wrapped in trees: it grows as companies
 * start, and gaps left by companies that close become small parks. Each block brings the road along
 * its top and left, so the roads join up; the town's last row and column of road close it off.
 */
export const BLOCK_W = 10;
export const BLOCK_H = 9;

/** Each company house is 7×5 tiles, with its door in the middle of the bottom row. */
export const PLOT_W = 7;
export const PLOT_H = 5;

/**
 * Blocks (0, 0) to (1, 1): the square with the fountain, leaderboard, star counter, coffee, the #1 model's
 * statue and the raid dungeon's gate filling the top two, then the picnic lawn, the pond, the Inn and the
 * windmill (`Ŵ`) beside it.
 */
const CORE = [
  ",,,,,,,,,,,,,,,,,,,,",
  ",L:::::::::::::::::L",
  ",:::G::::::::★:N::::",
  ",::::::B:FF:B:::::o:",
  ",::::::B:FF:B:::::::",
  ",::::♛::::::::::::::",
  ",:::::::::::::::::::",
  ",:::::::::::::::::::",
  ",L:::::::::::::::::L",
  ",,,,,,,,,,,,,,,,,,,,",
  ",......,............",
  ",^.....,..........^.",
  ",..~~~~,..HHHHHHH...",
  ",.~~~~~,..HHHHHHH...",
  ",.~~~~~,..HHHHHHH...",
  ",..~~~.,..HHHIHHH.ŴŴ",
  ',.."...,,,,,,,.K..ŴŴ',
  ',..T........".....^.',
];
/** The square's paving in CORE, lamp to lamp: Sprint Race runs laps round its edge. */
export const PLAZA = { left: 1, top: 1, right: 19, bottom: 8 };
export const CORE_BLOCKS: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** A company's block: its house, and a path from the door down to the next road. */
const LOT = [
  ",,,,,,,,,,",
  ",.........",
  ",.HHHHHHH.",
  ",.HHHHHHH.",
  ",.HHHHHHH.",
  ",.HHHHHHH.",
  ",.HHHDHHH.",
  ",....,....",
  ",....,....",
];
/** Where the door is in a LOT. */
const DOOR: [number, number] = [5, 6];

/**
 * The shops' blocks, in the corners round the core and the companies' ring: a company never builds
 * here (`frontier`). A block a company already holds (it started before the shops) stays the company's.
 */
export const SHOP_BLOCKS: Record<ShopId, [number, number]> = {
  furniture: [-1, -1],
  clothes: [2, -1],
  barber: [-1, 2],
  pets: [2, 2],
  natmarked: [2, 0],
  // East of the square beside Natmarked. A company can hold it from before the hall: it then takes the
  // nearest free block (`shopBlocks`), at the edge of the town if the town is full.
  market: [2, 1],
};

/** A shop's block: a lawn, its 5×4 front with the door in the middle of the bottom row, and the path down to the road. */
const shopLot = (id: ShopId): string[] => {
  const body = SHOP_BODY_CHAR.repeat(5);
  const front = `${SHOP_BODY_CHAR.repeat(2)}${SHOP_DOOR_CHAR[id]}${SHOP_BODY_CHAR.repeat(2)}`;
  return [
    ",,,,,,,,,,",
    ",.........",
    ",.........",
    `,..${body}..`,
    `,..${body}..`,
    `,..${body}..`,
    `,..${front}..`,
    ",....,....",
    ",....,....",
  ];
};
/** Where the door is in a shop's block. */
export const SHOP_DOOR: [number, number] = [5, 6];

/**
 * How far block (bx, by) is from the middle of the core, the corner where its four blocks meet: what
 * "nearest the square" means for a new company (`frontier`) and for a shop that has been moved.
 */
const fromSquare = (bx: number, by: number): number => Math.hypot(bx + 0.5 - 1, by + 0.5 - 1);

/**
 * Every block of the grid, nearest the square first (ties by plot number) and without end: the town grows
 * as far as it has companies to fill it, so nothing that looks for a free block stops at a fixed range.
 * Blocks go out in passes. A pass reaching `m` blocks out holds every block within `m`, and any block it
 * left out is at least `m + 1` away, so a pass hands on only those nearer than that, in order.
 * ponytail: plot numbers (`plotId`) stop 500 blocks out, which is some 250,000 companies.
 */
export function* blocksOutward(): Generator<[number, number]> {
  const done = new Set<number>();
  for (let m = 0.5; ; m++) {
    const found: [number, number][] = [];
    for (let by = Math.ceil(0.5 - m); by <= Math.floor(0.5 + m); by++)
      for (let bx = Math.ceil(0.5 - m); bx <= Math.floor(0.5 + m); bx++)
        if (!done.has(plotId(bx, by)) && fromSquare(bx, by) < m + 1) found.push([bx, by]);
    for (const block of sortBy(
      found,
      ([bx, by]) => fromSquare(bx, by),
      ([bx, by]) => plotId(bx, by),
    )) {
      done.add(plotId(...block));
      yield block;
    }
  }
}

/**
 * Where each shop stands for these company plots: its `SHOP_BLOCKS` block, unless a company already holds
 * it (it started before the shop did). That shop moves to the free block nearest the square instead, so no
 * building is drawn over someone's house; in a town full all the way out, that is a block past its edge,
 * which the map grows to take in. Companies never build on a shop's block (`frontier`), so it stays put.
 */
export function shopBlocks(plots: readonly number[]): Record<ShopId, [number, number]> {
  const taken = new Set(plots);
  const out = {} as Record<ShopId, [number, number]>;
  const reserved = new Set<number>(CORE_BLOCKS.map(([x, y]) => plotId(x, y)));
  for (const id of SHOP_IDS) reserved.add(plotId(...SHOP_BLOCKS[id]));
  const displaced: ShopId[] = [];
  for (const id of SHOP_IDS) {
    if (taken.has(plotId(...SHOP_BLOCKS[id]))) displaced.push(id);
    else out[id] = SHOP_BLOCKS[id];
  }
  for (const block of blocksOutward()) {
    if (displaced.length === 0) break;
    const id = plotId(...block);
    if (!taken.has(id) && !reserved.has(id)) out[displaced.shift()!] = block;
  }
  return out;
}

/** Empty blocks inside the town: small parks. */
const PARKS = [
  [
    ",,,,,,,,,,",
    ",.........",
    ',..T....".',
    ",....^....",
    ',.".....T.',
    ",.........",
    ',..T..."..',
    ",.........",
    ",.....^...",
  ],
  [
    ",,,,,,,,,,",
    ',...."....',
    ",.T.....T.",
    ",.........",
    ',...".^...',
    ",.........",
    ",.T.....T.",
    ',......"..',
    ",.........",
  ],
];

/** A plot's number stands for its block: (by + 500) · 1000 + (bx + 500). */
export const plotId = (bx: number, by: number): number => (by + 500) * 1000 + (bx + 500);
export const plotBlock = (plot: number): [number, number] => [
  (plot % 1000) - 500,
  Math.floor(plot / 1000) - 500,
];
export const blockOf = (x: number, y: number): [number, number] => [
  Math.floor(x / BLOCK_W),
  Math.floor(y / BLOCK_H),
];

const isCore = (bx: number, by: number) => CORE_BLOCKS.some(([cx, cy]) => cx === bx && cy === by);

/** A company's front door, in town tiles. */
export function doorOf(plot: number): [number, number] {
  const [bx, by] = plotBlock(plot);
  return [bx * BLOCK_W + DOOR[0], by * BLOCK_H + DOOR[1]];
}

/**
 * Where a new company can build: every empty block next to the town (sharing an edge with the core
 * or a company), nearest the square first.
 */
export function frontier(plots: readonly number[]): number[] {
  const used = new Set([...plots, ...CORE_BLOCKS.map(([x, y]) => plotId(x, y))]);
  const shops = new Set(Object.values(shopBlocks(plots)).map(([x, y]) => plotId(x, y)));
  const out = new Set<number>();
  for (const id of used) {
    const [bx, by] = plotBlock(id);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = plotId(bx + dx, by + dy);
      if (!used.has(next) && !shops.has(next)) out.add(next);
    }
  }
  return sortBy(
    [...out],
    (id) => fromSquare(...plotBlock(id)),
    (id) => id,
  );
}

/** The town for these company plots. */
export function townMap(plots: readonly number[]): GameMap {
  const shopPlaces = shopBlocks(plots);
  const shopAt = new Map(SHOP_IDS.map((id) => [plotId(...shopPlaces[id]), id]));
  const blocks = [...CORE_BLOCKS, ...Object.values(shopPlaces), ...plots.map(plotBlock)];
  const minBx = Math.min(...blocks.map(([x]) => x));
  const maxBx = Math.max(...blocks.map(([x]) => x));
  const minBy = Math.min(...blocks.map(([, y]) => y));
  const maxBy = Math.max(...blocks.map(([, y]) => y));
  // One tree ring around it all, and the closing road along the right and bottom.
  const x0 = minBx * BLOCK_W - 1;
  const y0 = minBy * BLOCK_H - 1;
  const width = (maxBx - minBx + 1) * BLOCK_W + 3;
  const height = (maxBy - minBy + 1) * BLOCK_H + 3;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill("."));
  const put = (x: number, y: number, ch: string) => {
    grid[y - y0]![x - x0] = ch;
  };
  const taken = new Set(plots);
  for (let by = minBy; by <= maxBy; by++)
    for (let bx = minBx; bx <= maxBx; bx++) {
      const rows = isCore(bx, by)
        ? CORE.slice((by - 0) * BLOCK_H, (by + 1) * BLOCK_H).map((r) =>
            r.slice(bx * BLOCK_W, (bx + 1) * BLOCK_W),
          )
        : taken.has(plotId(bx, by))
          ? LOT
          : shopAt.has(plotId(bx, by))
            ? shopLot(shopAt.get(plotId(bx, by))!)
            : PARKS[Math.abs(bx * 7 + by * 13) % PARKS.length]!;
      rows.forEach((row, dy) => {
        for (let dx = 0; dx < BLOCK_W; dx++) put(bx * BLOCK_W + dx, by * BLOCK_H + dy, row[dx]!);
      });
    }
  const right = (maxBx + 1) * BLOCK_W;
  const bottom = (maxBy + 1) * BLOCK_H;
  for (let y = minBy * BLOCK_H; y <= bottom; y++) put(right, y, ",");
  for (let x = minBx * BLOCK_W; x <= right; x++) put(x, bottom, ",");
  for (let x = x0; x < x0 + width; x++) {
    put(x, y0, "T");
    put(x, y0 + height - 1, "T");
  }
  for (let y = y0; y < y0 + height; y++) {
    put(x0, y, "T");
    put(x0 + width - 1, y, "T");
  }
  return new GameMap(
    "town",
    "Town square",
    grid.map((r) => r.join("")),
    x0,
    y0,
  );
}

/**
 * Rebuilds the town for these company plots. ponytail: one town per process (the world actor on the
 * server, the page in a browser), so it's kept in MAPS like the fixed rooms.
 */
export function setTown(plots: readonly number[]): GameMap {
  MAPS.town = townMap(plots);
  return MAPS.town;
}

/** Where you arrive in town: the middle of the square. */
export const TOWN_SPAWN: [number, number] = [9, 5];

/** The door's column, in every office size: the room only grows right and down. */
export const OFFICE_DOOR_X = 5;

/**
 * An office `w` × `h`: walls round the floor, the trophy shelf at the top from x = 5, the pet bed in the
 * bottom right corner and the door in the bottom wall at `OFFICE_DOOR_X`. (14, 11) is the first office.
 */
export function officeRows(w: number, h: number): string[] {
  const floor = `W${"_".repeat(w - 2)}W`;
  const rows = Array.from({ length: h }, () => floor);
  rows[0] = "W".repeat(w);
  rows[1] = `W${"_".repeat(OFFICE_DOOR_X - 1)}UUUU${"_".repeat(w - OFFICE_DOOR_X - 5)}W`;
  rows[h - 2] = `W${"_".repeat(w - 3)}QW`;
  rows[h - 1] = `${"W".repeat(OFFICE_DOOR_X)}x${"W".repeat(w - OFFICE_DOOR_X - 1)}`;
  return rows;
}

export const MAPS: Record<MapId, GameMap> = {
  // Rebuilt from the companies in it (setTown); until then, just the square.
  town: townMap([]),
  // The floor; each company's building adds its hallways of office doors above it (hqMap).
  hq: new GameMap("hq", "Company house", [
    "WWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWW",
    "Wkk_b_b_b_b_p__dddd_oW",
    "W___b_b_b_b____cccc__W",
    "W____________________W",
    "W___b_b_b_b__________W",
    "W___b_b_b_b____dddd__W",
    "W______________cccc__W",
    "W____________________W",
    "W__==tt==____________W",
    "W__======____________W",
    "W__=ssss=____________W",
    "Wp____________ς_____pW",
    "WWWuWWWWWWWxWWWWWWWWWW",
  ]),
  // The company's common room, up the stairs `u` from its house: a lounge round a rug and a TV, a kitchenette
  // (fridge, counter, espresso bar, coffee machine, stools), a stage for stand-ups, a ping-pong and a foosball
  // table, a pet corner, a wall of wins, and windows. One exit, the stairs down. Members only (`portal`).
  common: new GameMap("common", "Common room", [
    "WWWWWWWWWWWWWWWWWWWWWWWW",
    "WΨΨWΨΨWΘΘΘΘWΨΨWΨΨWΨΨWWWW",
    "Wkk_p__________ψπππααopW",
    "W_______________v_v____W",
    "Weeξξee________________W",
    "Weeeeee________________W",
    "W______________________W",
    "W_ε_ε_ε_===tt===_θθθ___W",
    "W_______========_______W",
    "W_______=μ=ΩΩ=μ=___φφ__W",
    "W_______========_______W",
    "W_Q_____=ssssss=_______W",
    "Wp_____Λ________Λ_____pW",
    "WWWWWWWWWWWxWWWWWWWWWWWW",
  ]),
  // The Inn is the Tavern (26 by 16 inside; the 3D room is built from this plan): the bar along the north wall's west
  // end with a sealed cell for the barkeep (its floor is a rug, not `_`, so `restSpot` never beds anyone behind it),
  // the boards on the clear wall stretches (m, A, P and the bar tab J sit in wall tiles, so the floor in front of
  // them is free), the hearth in a nook of the north wall with its sofas, the stage and jukebox on the west wall,
  // four-sided dining tables and booths round a two-wide aisle from the door, a coat stand by it, and the stairs
  // in the corners (S down in the south-east, u up in the south-west). The tip jar stands on the bar; the
  // chalkboard on the floor by the barrels; the world clocks (◷) hang on the north wall by the hearth. One exit,
  // so `roomEntry` still finds it.
  inn: TAVERN
    ? new GameMap("inn", "The Tavern", [
        "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
        "WWWWWWWWWWWWmmWAAAA?◷◷WWWWWW",
        "Wkkkkkkk=hho__K______PffPkkW",
        "W=========h_________======pW",
        "Waaayaaa$aa_________s====s_W",
        "J__v_v_v_v____cc____==nn==_W",
        "J____________cnnc___==ss==_W",
        "J_____________cc___________W",
        "J______cc___cc_______cc____W",
        "Wz____cnnc_cnnc_____cnnc___W",
        "Wee____cc___cc_______cc____W",
        "Wee________________________W",
        "Wee________________________W",
        "Wve________________________W",
        "Wee_______________________hW",
        "Wp__BB__BB____________BB___W",
        "W___nn__nn____________nn__SW",
        "Wu__BB__BB_OO_________BB_p_W",
        "WWWWWWWWWWWWWxWWWWWWWWWWWWWW",
      ])
    : new GameMap("inn", "The Inn", [
        "WWWWWWWWWWWWWWWW",
        "WWWWWWWWWWWWWWWW",
        "W_b_b_b_b__okkpW",
        "W______________W",
        "W______________W",
        "W_b_b_b_b_dddd_W",
        "W_________cccc_W",
        "W______________W",
        "Wp____________pW",
        "WWWWWWWxWWWWWWWW",
      ]),
  // Upstairs at the Tavern: the beds of everyone without a company (`homeRoom`), who show as a head count
  // asleep. One exit, the stairs down.
  upstairs: new GameMap("upstairs", "Upstairs", [
    "WWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWW",
    "Wb_b_b_b_b_b_b_b_bpW",
    "Wb_b_b_b_b_b_b_b_b_W",
    "W__==============__W",
    "W__________________W",
    "Wb_b_b_b_b_b_b_b_b_W",
    "Wb_b_b_b_b_b_b_b_b_W",
    "Wp_______________p_W",
    "WWWWWWWWWWxWWWWWWWWW",
  ]),
  // The net cafe under the Tavern: racks, the livestream screen and two wall terminals on the back wall,
  // five cabinets (one per game, in `CABINET_GAMES` order), a row of PC pairs, a foosball table and a sofa, the
  // poker table (`♠`, six `♣` chairs) and the roulette table (`♦`, four `♥` spots above it and four below). Its one exit is the stairs up.
  basement: new GameMap("basement", "The Basement", [
    "WWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWW",
    "WηηηηηηEEEEEEMMiδδ__pW",
    "W____________________W",
    "W_CCCCC____________Π_W",
    "W____________________W",
    "W_φφ____ζζ_ζζ_ζζ_ζζ__W",
    "W_______cc_cc_cc_cc__W",
    "W___♣♣_______________W",
    "W__♠♠♠♠♣____♥♥♥♥_____W",
    "W_♣♠♠♠♠_____♦♦♦______W",
    "W___♣♣______♦♦♦______W",
    "W_ssss______♥♥♥♥___p_W",
    "WWWWWWWWWWxWWWWWWWWWWW",
  ]),
  // Everyone's office, before what they dropped in it (`mapOf`): the first size (`OFFICE_SIZES`[0], office.ts:
  // keep them in step). Bigger ones are bought, per owner (`officeMap`, office.ts). A pet bed (`Q`, a prop: nothing can be dropped on it)
  // sits in the bottom right corner.
  office: new GameMap("office", "Office", officeRows(14, 11)),
  // The four shops (`shoprooms.ts`): the 3D shops' interiors, tile for tile.
  "shop-furniture": new GameMap("shop-furniture", SHOPS.furniture.name, SHOPS.furniture.rows),
  "shop-clothes": new GameMap("shop-clothes", SHOPS.clothes.name, SHOPS.clothes.rows),
  "shop-barber": new GameMap("shop-barber", SHOPS.barber.name, SHOPS.barber.rows),
  "shop-pets": new GameMap("shop-pets", SHOPS.pets.name, SHOPS.pets.rows),
  "shop-natmarked": new GameMap("shop-natmarked", SHOPS.natmarked.name, SHOPS.natmarked.rows, 0, 0, {
    wall: "natmarked",
    floor: "natmarked",
  }),
  "shop-market": new GameMap("shop-market", SHOPS.market.name, SHOPS.market.rows),
  // The raid: the boss on its dais, and arcs of war desks facing it. Whoever has agents running is drawn
  // at one (web/src/game/raid.ts); the desks and seats are props, so visitors walk the aisles.
  dungeon: new GameMap("dungeon", "Raid Dungeon", [
    "WWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WqqjqqqqjqqqqqqqqqjqqqqjqqW",
    "WqqqqqqqqqqZZZZZqqqqqqqqqqW",
    "WqqqqqqqqqqZZZZZqqqqqqqqqqW",
    "WqqqqqqqqqqZZZZZqqqqqqqqqqW",
    "WqqqqqqqqqqqqqqqqqqqqqqqqqW",
    "WqqqqqqlqqqqqqqqqqqlqqqqqqW",
    "WqqqqqqrqlqlqlqlqlqrqqqqqqW",
    "WqqqqqqqqrqrqrqrqrqqqqqqqqW",
    "WqqqqlqlqqqqqqqqqqqlqlqqqqW",
    "WqqqqrqrqlqlqlqlqlqrqrqqqqW",
    "WqqlqqqqqrqrqrqrqrqqqqqlqqW",
    "WqqrqlqlqqqqqqqqqqqlqlqrqqW",
    "WqqqqrqrqlqlqlqlqlqrqrqqqqW",
    "WlqlqqqqqrqrqrqrqrqqqqqlqlW",
    "WrqrqlqlqqqqqqqqqqqlqlqrqrW",
    "WqqqqrqrqlqlqlqlqlqrqrqqqqW",
    "WqqqqqqqqrqrqrqrqrqqqqqqqqW",
    "WqqqqqqqqqqqqqqqqqqqqqqqqqW",
    "WWWWWWWWWWWWWxWWWWWWWWWWWWW",
  ]),
};
