/**
 * The physical shops as rooms: Møbelhuset (furniture), Thread & Token (clothes), Figaro's (barber), the pet shop,
 * Natmarked (the night market hall where cases are sold) and Torvehallen (the market hall where players sell to each other). Their plans are the 3D shops' interiors tile for tile (web/src/render3d/shops): each map is the
 * interior at the world-grid inset `SHOP_INSET` (two wall rows on top, one wall column on the left), so a 3D
 * builder can generate the room from this file alone: sizes, the door, the counter, the shopkeeper's spot,
 * the seats (`c` chairs, `b` beds) and the displays (`DISPLAYS`: a tile and what E on it opens).
 *
 * The tiles: `¢` the counter, `¤ § ¶ ¥` a shop's display (a shelf, rack, mirror or pen; on a wall, the sample
 * boards hung there), `‡` a fixture that is only to look at. Pure data: `maps.ts` builds the `GameMap`s.
 */
export type ShopId = "furniture" | "clothes" | "barber" | "pets" | "natmarked" | "market";
export const SHOP_IDS: readonly ShopId[] = ["furniture", "clothes", "barber", "pets", "natmarked", "market"];

/**
 * What E on a display opens in the Shop page: an item slot's tab, or one of Møbelhuset's own: `furniture`,
 * `decor` (wallpaper and floors), `desk` (monitor setups) and `company` (the company's supplies), or the
 * barber's look picker.
 */
export type ShopTab =
  | "outfit"
  | "glasses"
  | "hat"
  | "held"
  | "back"
  | "pet"
  | "petwear"
  | "dance"
  | "furniture"
  | "decor"
  | "desk"
  | "company"
  | "look"
  | "case"
  | "market";

/** The room's own size (what the 3D room is built at), without the walls the map adds. */
export interface ShopLayout {
  id: ShopId;
  map: ShopRoomId;
  name: string;
  /** The sign over the storefront. */
  sign: string;
  /** Floor tiles across and deep; the map is `w + 2` by `d + 3`. */
  w: number;
  d: number;
  /** The exit tile (`x`): in the last floor row, the player steps down into it. */
  door: [number, number];
  /** The counter tile you face to talk to the keeper (a tile of the `¢` run). */
  counter: [number, number];
  /** Where the shopkeeper stands. */
  keeper: [number, number];
  keeperName: string;
  rows: readonly string[];
  /** Tiles that sell something, with the tab E opens. Tiles of the map's own coordinates; wall samples sit on the wall row/column. */
  displays: readonly (readonly [number, number, ShopTab])[];
}

/** Where the room sits in the world grid: two wall rows on top, one column on the left. */
export const SHOP_INSET: [number, number] = [1, 2];

/** The tile of each storefront's door in the town. */
export const SHOP_DOOR_CHAR: Record<ShopId, string> = {
  furniture: "ƒ",
  clothes: "Ç",
  barber: "Ð",
  pets: "ð",
  natmarked: "Ñ",
  market: "Ƭ",
};
/** The tile of each shop's displays inside. */
export const SHOP_DISPLAY_CHAR: Record<ShopId, string> = {
  furniture: "¤",
  clothes: "§",
  barber: "¶",
  pets: "¥",
  natmarked: "Ŧ",
  market: "Ƙ",
};
/** The storefront's body in the town: 5 wide, 4 deep, the door in the middle of its bottom row. */
export const SHOP_BODY_CHAR = "Ħ";

export type ShopRoomId =
  "shop-furniture" | "shop-clothes" | "shop-barber" | "shop-pets" | "shop-natmarked" | "shop-market";
export const SHOP_ROOM: Record<ShopId, ShopRoomId> = {
  furniture: "shop-furniture",
  clothes: "shop-clothes",
  barber: "shop-barber",
  pets: "shop-pets",
  natmarked: "shop-natmarked",
  market: "shop-market",
};

export const shopOfRoom = (room: string): ShopId | null =>
  SHOP_IDS.find((s) => SHOP_ROOM[s] === room) ?? null;

/** Møbelhuset's company-supplies catalogue desk: two tiles wide, its left tile (a desk with a ledger and poster tubes). */
export const SUPPLIES_DESK: readonly [number, number] = [18, 17];

/** The tiles of `rows` that are `ch`, row by row and left to right, as displays for `tab`. */
const displaysOf = (rows: readonly string[], ch: string, tab: ShopTab): [number, number, ShopTab][] =>
  rows.flatMap((row, y) =>
    [...row].flatMap((c, x): [number, number, ShopTab][] => (c === ch ? [[x, y, tab]] : [])),
  );

/**
 * Torvehallen's floor: sixteen slots along the back wall (`Ƙ` between its fixtures) and two rows of three
 * glass cases of four, in the middle, with an aisle between and round them. Slot numbers follow the tiles
 * row by row, so the back wall is 0 to 15 and the cases 16 to 39.
 */
const MARKET_ROWS: readonly string[] = [
  "WWWWWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWWWWWWWWWW",
  "W‡ƘƘƘƘ‡ƘƘƘƘ‡‡ƘƘƘƘ‡ƘƘƘƘ‡W",
  "W______________________W",
  "W__ƘƘƘƘ___ƘƘƘƘ___ƘƘƘƘ__W",
  "W______________________W",
  "W__ƘƘƘƘ___ƘƘƘƘ___ƘƘƘƘ__W",
  "W______________________W",
  "W______________________W",
  "W‡____________________‡W",
  "W_______¢¢¢¢¢¢_________W",
  "W______________________W",
  "W______________________W",
  "W‡____________________‡W",
  "W______________________W",
  "W__________x___________W",
  "WWWWWWWWWWWWWWWWWWWWWWWW",
];

export const SHOPS: Record<ShopId, ShopLayout> = {
  furniture: {
    id: "furniture",
    map: SHOP_ROOM.furniture,
    name: "Møbelhuset",
    sign: "MØBELHUSET",
    w: 29,
    d: 18,
    door: [11, 19],
    counter: [25, 16],
    keeper: [22, 16],
    keeperName: "Freja",
    rows: [
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WW¤¤¤¤W¤W¤W¤WW¤W¤W¤¤¤¤W¤W¤W¤WWW",
      "W_____________________________W",
      "¤__¤‡_¤‡_¤‡_¤‡_¤‡_____________W",
      "W___________________¤¤_¤‡_¤‡__W",
      "¤____________________c________W",
      "¤___¤_¤ccc____¤‡‡_¤¤__________W",
      "W_________c___‡‡‡___¤‡_¤‡_¤___W",
      "¤___¤_c¤‡_____________________W",
      "¤__________c________¤‡¤¤______W",
      "W___¤___c__c__¤‡_¤‡___________W",
      "W___‡___c_____________________W",
      "¤_____________¤‡_¤‡__¤¤‡¤¤¤¤__W",
      "¤_____________________________W",
      "W___b¤_c_¤¤‡__¤‡_¤‡___________W",
      "¤___b________________‡________W",
      "W______________________¢¢¢¢¢¢_W",
      "¤_________________¤¤__________W",
      "¤_____________________________W",
      "W__________x__________________W",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    ],
    displays: [
      [3, 3, "desk"],
      [6, 3, "desk"],
      [9, 3, "desk"],
      [12, 3, "desk"],
      [15, 3, "desk"],
      [7, 8, "company"],
      [6, 6, "company"],
      [4, 6, "company"],
      [4, 8, "company"],
      [4, 10, "furniture"],
      [5, 14, "furniture"],
      [9, 14, "furniture"],
      [10, 14, "furniture"],
      [14, 6, "company"],
      [18, 6, "company"],
      [19, 6, "company"],
      [14, 10, "company"],
      [17, 10, "company"],
      [14, 12, "company"],
      [17, 12, "company"],
      [14, 14, "furniture"],
      [17, 14, "company"],
      [20, 4, "furniture"],
      [21, 4, "furniture"],
      [23, 4, "company"],
      [26, 4, "company"],
      [20, 7, "company"],
      [23, 7, "furniture"],
      [26, 7, "furniture"],
      [21, 12, "furniture"],
      [22, 12, "company"],
      [24, 12, "company"],
      [25, 12, "company"],
      [26, 12, "furniture"],
      [27, 12, "company"],
      [20, 9, "furniture"],
      [22, 9, "furniture"],
      [23, 9, "furniture"],
      [2, 1, "company"],
      [3, 1, "company"],
      [4, 1, "company"],
      [5, 1, "company"],
      [7, 1, "company"],
      [9, 1, "company"],
      [11, 1, "company"],
      [14, 1, "company"],
      [16, 1, "company"],
      [18, 1, "company"],
      [19, 1, "furniture"],
      [20, 1, "furniture"],
      [21, 1, "furniture"],
      [23, 1, "furniture"],
      [25, 1, "company"],
      [27, 1, "company"],
      [0, 3, "decor"],
      [0, 5, "decor"],
      [0, 6, "decor"],
      [0, 8, "decor"],
      [0, 9, "decor"],
      [0, 12, "decor"],
      [0, 13, "decor"],
      [0, 15, "decor"],
      [0, 17, "decor"],
      [0, 18, "decor"],
      [SUPPLIES_DESK[0], SUPPLIES_DESK[1], "company"],
      [SUPPLIES_DESK[0] + 1, SUPPLIES_DESK[1], "company"],
    ],
  },
  clothes: {
    id: "clothes",
    map: SHOP_ROOM.clothes,
    name: "Thread & Token",
    sign: "THREAD & TOKEN",
    w: 22,
    d: 15,
    door: [6, 16],
    counter: [12, 14],
    keeper: [15, 14],
    keeperName: "Bree",
    rows: [
      "WWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWW",
      "W‡§§§§§§§§§§§§§____‡‡‡‡W",
      "W§_________________‡‡‡‡W",
      "W§_________________‡‡‡‡W",
      "W§_____________________W",
      "W§_§_§_§_§_§_§_§_§_§_§_W",
      "W§_____________________W",
      "W§_§_§_§_§_§_§_§_§_§_§_W",
      "W§_____________________W",
      "W§_§_§_§_§_§_§_§_§_§_§_W",
      "W‡____________________‡W",
      "W§_§_§_§_§_§_§_§_§§‡§§_W",
      "W§_______________‡‡‡‡‡_W",
      "W§_______¢¢¢¢¢¢________W",
      "W‡_____________________W",
      "W‡‡___x_______________‡W",
      "WWWWWWWWWWWWWWWWWWWWWWWW",
    ],
    displays: [
      [2, 2, "hat"],
      [3, 2, "hat"],
      [4, 2, "hat"],
      [5, 2, "hat"],
      [6, 2, "hat"],
      [7, 2, "hat"],
      [8, 2, "hat"],
      [9, 2, "hat"],
      [10, 2, "hat"],
      [11, 2, "hat"],
      [12, 2, "hat"],
      [13, 2, "hat"],
      [14, 2, "hat"],
      [1, 9, "glasses"],
      [1, 8, "glasses"],
      [1, 7, "glasses"],
      [1, 6, "glasses"],
      [1, 5, "glasses"],
      [1, 4, "glasses"],
      [1, 3, "glasses"],
      [1, 14, "held"],
      [1, 13, "held"],
      [1, 12, "held"],
      [1, 10, "held"],
      [3, 6, "outfit"],
      [5, 6, "outfit"],
      [7, 6, "outfit"],
      [9, 6, "outfit"],
      [11, 6, "outfit"],
      [13, 6, "outfit"],
      [15, 6, "outfit"],
      [17, 6, "outfit"],
      [19, 6, "outfit"],
      [21, 6, "outfit"],
      [3, 8, "outfit"],
      [5, 8, "outfit"],
      [7, 8, "outfit"],
      [9, 8, "outfit"],
      [11, 8, "outfit"],
      [13, 8, "outfit"],
      [15, 8, "outfit"],
      [17, 8, "outfit"],
      [19, 8, "outfit"],
      [21, 8, "outfit"],
      [3, 10, "outfit"],
      [5, 10, "outfit"],
      [7, 10, "outfit"],
      [9, 10, "outfit"],
      [11, 10, "outfit"],
      [13, 10, "outfit"],
      [15, 10, "outfit"],
      [17, 10, "outfit"],
      [19, 10, "outfit"],
      [21, 10, "outfit"],
      [3, 12, "back"],
      [5, 12, "back"],
      [7, 12, "back"],
      [9, 12, "back"],
      [11, 12, "back"],
      [13, 12, "back"],
      [15, 12, "back"],
      [17, 12, "outfit"],
      [18, 12, "outfit"],
      [20, 12, "outfit"],
      [21, 12, "outfit"],
    ],
  },
  barber: {
    id: "barber",
    map: SHOP_ROOM.barber,
    name: "Figaro's",
    sign: "BARBER & SALON",
    w: 20,
    d: 11,
    door: [11, 12],
    counter: [16, 10],
    keeper: [17, 9],
    keeperName: "Figaro",
    rows: [
      "WWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWW",
      "W‡‡¶¶¶‡¶¶¶¶¶¶¶¶¶¶¶¶¶‡W",
      "W‡c_________________¶W",
      "W‡c__________________W",
      "W‡c________________c_W",
      "W‡c______________‡_c_W",
      "W‡c__________________W",
      "W‡c__________________W",
      "W‡___________________W",
      "W‡_____________¢¢¢¢¢_W",
      "W‡__________________‡W",
      "W‡_________x_‡_______W",
      "WWWWWWWWWWWWWWWWWWWWWW",
    ],
    displays: [
      [3, 2, "look"],
      [4, 2, "look"],
      [5, 2, "look"],
      [7, 2, "look"],
      [8, 2, "look"],
      [9, 2, "look"],
      [10, 2, "look"],
      [11, 2, "look"],
      [12, 2, "look"],
      [13, 2, "look"],
      [14, 2, "look"],
      [15, 2, "look"],
      [16, 2, "look"],
      [17, 2, "look"],
      [18, 2, "look"],
      [19, 2, "look"],
      [20, 3, "look"],
    ],
  },
  pets: {
    id: "pets",
    map: SHOP_ROOM.pets,
    name: "Pet shop",
    sign: "PET SHOP",
    w: 18,
    d: 12,
    door: [16, 13],
    counter: [10, 10],
    keeper: [10, 9],
    keeperName: "Wren",
    rows: [
      "WWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWW",
      "W‡¥‡¥‡¥¥¥¥¥¥¥¥¥¥¥¥¥W",
      "W__________________W",
      "W‡_¥¥‡¥¥¥¥‡¥¥_‡‡‡¥‡W",
      "W‡_‡‡‡‡‡‡‡‡‡‡_¥‡‡‡‡W",
      "W‡_‡¥¥¥‡‡¥¥¥‡_‡‡‡‡‡W",
      "W‡____________¥‡‡‡‡W",
      "W_____________‡‡‡‡‡W",
      "W‡_‡‡_________‡¥‡¥‡W",
      "W‡_____¢¢¢¢¢¢¢_____W",
      "W‡_QQQ_____________W",
      "W__________________W",
      "W_______________x__W",
      "WWWWWWWWWWWWWWWWWWWW",
    ],
    displays: [
      [2, 2, "pet"],
      [4, 2, "pet"],
      [6, 2, "pet"],
      [7, 2, "pet"],
      [8, 2, "pet"],
      [9, 2, "pet"],
      [10, 2, "pet"],
      [11, 2, "pet"],
      [12, 2, "pet"],
      [13, 2, "pet"],
      [14, 2, "petwear"],
      [15, 2, "petwear"],
      [17, 2, "petwear"],
      [18, 2, "petwear"],
      [16, 2, "petwear"],
      [3, 4, "pet"],
      [4, 4, "pet"],
      [6, 4, "pet"],
      [7, 4, "pet"],
      [4, 6, "pet"],
      [5, 6, "pet"],
      [6, 6, "pet"],
      [8, 4, "pet"],
      [9, 4, "pet"],
      [11, 4, "pet"],
      [12, 4, "pet"],
      [9, 6, "pet"],
      [10, 6, "pet"],
      [11, 6, "pet"],
      [14, 5, "pet"],
      [17, 4, "pet"],
      [14, 7, "pet"],
      [15, 9, "pet"],
      [17, 9, "pet"],
    ],
  },
  natmarked: {
    id: "natmarked",
    map: SHOP_ROOM.natmarked,
    name: "Natmarked",
    sign: "NATMARKED",
    w: 18,
    d: 12,
    door: [9, 13],
    counter: [9, 10],
    keeper: [9, 9],
    keeperName: "Mei",
    rows: [
      "WWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWW",
      "W‡ŦŦ‡ŦŦ‡ŦŦ‡ŦŦ‡ŦŦ‡ŦŦW",
      "W__________________W",
      "W‡‡‡c__________c‡‡‡W",
      "W‡‡‡c__________c‡‡‡W",
      "W__________________W",
      "W____c‡c______c‡c__W",
      "W__________________W",
      "W‡________________‡W",
      "W______¢¢¢¢¢¢______W",
      "W__________________W",
      "W‡________________‡W",
      "W________x_________W",
      "WWWWWWWWWWWWWWWWWWWW",
    ],
    displays: [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18].map((x) => [x, 2, "case"] as const),
  },
  market: {
    id: "market",
    map: SHOP_ROOM.market,
    name: "Torvehallen",
    sign: "TORVEHALLEN",
    w: 22,
    d: 14,
    door: [11, 15],
    counter: [11, 10],
    keeper: [11, 9],
    keeperName: "Torvald",
    rows: MARKET_ROWS,
    // A display is a slot: its number is its place in this list, row by row (`marketSlots`).
    displays: displaysOf(MARKET_ROWS, SHOP_DISPLAY_CHAR.market, "market"),
  },
};

/** What E on tile (x, y) of a shop room opens, if it is one of the shop's displays. */
export function displayTab(shop: ShopId, x: number, y: number): ShopTab | null {
  return SHOPS[shop].displays.find(([dx, dy]) => dx === x && dy === y)?.[2] ?? null;
}

/**
 * Which of Natmarked's shelves, left to right from 0, the display tile (x, y) belongs to, or null if it isn't one.
 * A shelf is two display tiles wide, and shelf `n` shows the case in slot `n` of `CASES`.
 */
export function shelfAt(x: number, y: number): number | null {
  const i = SHOPS.natmarked.displays.findIndex(([dx, dy]) => dx === x && dy === y);
  return i < 0 ? null : Math.floor(i / 2);
}

/** What each shop sells, for the directory and for hints ("Buy hats at Thread & Token"). */
export const SHOP_SELLS: Record<ShopId, string> = {
  furniture:
    "Furniture, wallpaper and floors, monitors and desk setups, and company supplies (furniture, posters, house desks)",
  clothes: "Outfits, hats, glasses, things to hold, back items, company merch and dances",
  barber: "Haircuts and colours (free), at the mirror",
  pets: "Pets and pet gear",
  natmarked: "Cases: a key opens one, and every case has its own hats, pets, outfits and furniture inside",
  market: "Whatever other players have put on display, at the price they set",
};

/** The shop that sells an item of this slot: where `buy` must be called from. */
export function shopForSlot(slot: string): ShopId | null {
  switch (slot) {
    case "furniture":
      return "furniture";
    case "outfit":
    case "glasses":
    case "hat":
    case "held":
    case "back":
    case "merch":
    case "dance":
      return "clothes";
    case "pet":
    case "petwear":
      return "pets";
    default:
      return null;
  }
}

/** The shop for a ShopTab (E on a display), so the Shop page can be filtered to it. */
export const SHOP_TABS: Record<ShopId, readonly ShopTab[]> = {
  furniture: ["furniture", "decor", "desk", "company"],
  clothes: ["outfit", "hat", "glasses", "held", "back", "dance"],
  barber: ["look"],
  pets: ["pet", "petwear"],
  natmarked: ["case"],
  market: ["market"],
};

/** "Go to Møbelhuset to buy that." */
export const goToShop = (shop: ShopId): string => `Go to ${SHOPS[shop].name} to buy that.`;
