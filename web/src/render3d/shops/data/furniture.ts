/**
 * A snapshot of everything the 2D furniture shop sells, so the 3D showroom stocks the same shelves.
 * Sources (tokenmaxxing; pr2 for the newer files): `core/src/office.ts` (FURNITURE, COMPANY_FURNITURE),
 * `core/src/posters.ts` (POSTERS, appended to COMPANY_FURNITURE), `core/src/home.ts` (HOME_PIECES, pr2),
 * `core/src/decor.ts` (WALLPAPERS, FLOORS, pr2's longer lists) and `core/src/desks.ts` (DESKS).
 * Ids are the 2D purchase names: `furn.<ch>`, `decor.<kind>.<id>`, `desk.<id>`. `asset` names the 3D model
 * (an `Asset` id in furniture.ts / furniture3d.ts / posters3d.ts, a look id in decor3d.ts, or a `DESK_TIERS`
 * index for desks). Keep in step by hand.
 */
import { fromCore } from "./core.ts";

export type FurnGroup = "Furniture" | "Company" | "Home" | "Posters" | "Desks" | "Wallpaper" | "Floors";

export interface FurnRow {
  id: string;
  name: string;
  price: number;
  group: FurnGroup;
  /** 3D asset (or decor look) id. */
  asset: string;
  /** Tiles wide in the 2D map. */
  w: number;
  /** Earned at this level, never sold. */
  level?: number;
  /** Earned some other way, never sold. */
  earned?: string;
  /** One line of 2D flavour text. */
  blurb?: string;
}

const row = (
  group: FurnGroup,
  id: string,
  name: string,
  price: number,
  asset: string,
  w = 1,
  extra: Partial<Pick<FurnRow, "level" | "earned" | "blurb">> = {},
): FurnRow => ({ id, name, price, group, asset, w, ...extra });

/** `FURNITURE` in office.ts: the shop's basics, sold as `furn.<ch>`. */
export const FURNITURE_ROWS: readonly FurnRow[] = [
  row("Furniture", "furn.=", "Rug", 15, "rug", 3),
  row("Furniture", "furn.p", "Plant", 30, "plant"),
  row("Furniture", "furn.L", "Lamp", 40, "lamp"),
  row("Furniture", "furn.c", "Chair", 45, "chair"),
  row("Furniture", "furn.k", "Shelf", 60, "shelf"),
  row("Furniture", "furn.B", "Bench", 60, "bench"),
  row("Furniture", "furn.d", "Desk", 75, "desk", 2),
  row("Furniture", "furn.o", "Coffee machine", 90, "coffee"),
  row("Furniture", "furn.b", "Bed", 120, "bed"),
  row("Furniture", "furn.s", "Sofa", 150, "sofa", 2),
  row("Furniture", "furn.t", "TV", 180, "tv", 2),
  row("Furniture", "furn.g", "Touched grass", 0, "touched-grass", 2, {
    earned: "Sat on a blanket at an outage picnic",
  }),
];

/** `COMPANY_FURNITURE` in office.ts (without the posters): the fancier pieces, bought from the company wallet. */
export const COMPANY_ROWS: readonly FurnRow[] = [
  row("Company", "furn.ε", "Beanbag", 35, "beanbag"),
  row("Company", "furn.ρ", "Bonsai", 45, "bonsai"),
  row("Company", "furn.Φ", "Water cooler", 55, "water-cooler"),
  row("Company", "furn.Δ", "Persian rug", 60, "rug-persian", 3),
  row("Company", "furn.ψ", "Retro mini fridge", 70, "mini-fridge"),
  row("Company", "furn.Ω", "Walnut coffee table", 80, "coffee-table", 2),
  row("Company", "furn.χ", "Big monstera", 90, "monstera"),
  row("Company", "furn.τ", "Desk globe", 90, "globe"),
  row("Company", "furn.σ", "Lava lamp", 100, "lava-lamp"),
  row("Company", "furn.ξ", "Whiteboard", 110, "whiteboard", 2),
  row("Company", "furn.Λ", "Arc floor lamp", 120, "arc-lamp"),
  row("Company", "furn.Ξ", "Library bookshelf", 140, "bookshelf-library", 2),
  row("Company", "furn.μ", "Danish lounge chair", 180, "lounge-chair"),
  row("Company", "furn.ν", "Vinyl record player", 200, "record-player"),
  row("Company", "furn.δ", "Neon sign", 220, "neon-sign", 2),
  row("Company", "furn.Σ", "Chesterfield sofa", 240, "sofa-chesterfield", 3),
  row("Company", "furn.Π", "Vending machine", 240, "vending-machine"),
  row("Company", "furn.ζ", "Standing desk, two screens", 260, "standing-desk", 2),
  row("Company", "furn.ι", "Plant wall", 300, "plant-wall", 2),
  row("Company", "furn.φ", "Foosball table", 350, "foosball", 2),
  row("Company", "furn.α", "Espresso bar", 400, "espresso-bar", 2),
  row("Company", "furn.η", "Server rack", 420, "server-rack"),
  row("Company", "furn.β", "Arcade cabinet", 450, "arcade-cabinet"),
  row("Company", "furn.κ", "Trophy case", 500, "trophy-case", 2),
  row("Company", "furn.γ", "Aquarium", 550, "aquarium", 2),
  row("Company", "furn.θ", "Ping-pong table", 600, "ping-pong", 3),
  row("Company", "furn.ω", "Ship-it gong", 750, "gong", 2),
  row("Company", "furn.λ", "Crystal chandelier", 900, "chandelier", 2),
  row("Company", "furn.Γ", "Rubber-duck statue", 1000, "rubber-duck-statue"),
];

/** `HOME_PIECES` in home.ts: personal-office furniture. */
export const HOME_ROWS: readonly FurnRow[] = [
  row("Home", "furn.ø", "Cactus", 60, "cactus", 1, { blurb: "It has survived every sprint review so far." }),
  row("Home", "furn.ê", "Framed certificate", 70, "certificate", 1, {
    blurb: "Certified Prompt Engineer, with honours.",
  }),
  row("Home", "furn.é", "Bean bag", 90, "bean-bag", 1, { blurb: "Getting up is a two-step process." }),
  row("Home", "furn.Æ", "Hanging plant", 105, "hanging-plant", 1, { blurb: "A pothos on a macrame hanger." }),
  row("Home", "furn.ç", "Wool rug", 105, "wool-rug", 2),
  row("Home", "furn.ß", "Floor lamp", 120, "floor-lamp", 1, { blurb: "A warm bulb. Hygge, on a dimmer." }),
  row("Home", "furn.æ", "Fiddle-leaf fig", 135, "fiddle-fig", 1, { blurb: "Dramatic about draughts." }),
  row("Home", "furn.ö", "Rubber-duck shelf", 150, "duck-shelf", 1, {
    blurb: "Three ducks, ready to hear the bug.",
  }),
  row("Home", "furn.Å", "Office whiteboard", 165, "wall-whiteboard", 2, {
    blurb: "Seven boxes, eleven arrows, a cloud.",
  }),
  row("Home", "furn.ä", "Mini fridge", 180, "home-fridge", 1, {
    blurb: "Oat milk and a birthday cake slice.",
  }),
  row("Home", "furn.å", "Bonsai on a stand", 195, "bonsai-stand", 1, {
    blurb: "Trimmed one commit at a time.",
  }),
  row("Home", "furn.ü", "Bookcase", 225, "bookcase", 2, { blurb: "Type systems, and one about sourdough." }),
  row("Home", "furn.ñ", "Pink neon sign", 300, "wall-neon", 2, { blurb: "SHIP IT, in pink." }),
  row("Home", "furn.Ø", "Mechanical keyboard display", 390, "keyboard-case", 2, {
    blurb: "Look, don't touch.",
  }),
];

/** `POSTERS` in posters.ts, cheapest first. Art ids match posters3d.ts. */
export const POSTER_ROWS: readonly FurnRow[] = [
  row("Posters", "furn.7", "Super Merge Bros", 60, "super-merge"),
  row("Posters", "furn.6", "Dark Deploys", 70, "dark-deploys"),
  row("Posters", "furn.8", "Slay the Backlog", 90, "slay-backlog"),
  row("Posters", "furn.9", "Last Dev Standing", 110, "last-dev"),
  row("Posters", "furn.5", "Pipeline Valley", 120, "pipeline-valley", 2),
  row("Posters", "furn.1", "Deploy League", 140, "deploy-league", 2),
  row("Posters", "furn.0", "Counter-CI: Global Flake", 160, "counter-ci", 2),
  row("Posters", "furn.2", "League of Linters", 180, "league-linters", 2),
  row("Posters", "furn.3", "Defense of the Dependencies", 210, "defense-deps", 2),
  row("Posters", "furn.4", "Lootborn", 250, "lootborn", 2),
];

/** `DESKS` in desks.ts: sold as `desk.<id>`; `asset` is the tier index. */
export const DESK_ROWS: readonly FurnRow[] = [
  row("Desks", "desk.laptop", "Laptop", 0, "0", 2, { blurb: "One screen, covered in stickers." }),
  row("Desks", "desk.dual", "Dual monitors", 60, "1", 2, { blurb: "Code on one, docs on the other." }),
  row("Desks", "desk.triple", "Triple monitors", 180, "2", 2, { blurb: "Agents, logs and a dashboard." }),
  row("Desks", "desk.ultrawide", "Ultrawide", 450, "3", 2, {
    level: 25,
    blurb: "One long curved screen, edge to edge.",
  }),
  row("Desks", "desk.battlestation", "Battlestation", 900, "4", 2, {
    level: 40,
    blurb: "Three screens, a glowing tower and RGB everywhere.",
  }),
];

/** `WALLPAPERS` in decor.ts. */
export const WALLPAPER_ROWS: readonly FurnRow[] = [
  row("Wallpaper", "decor.wall.plain", "Cream panels", 0, "plain", 1, {
    blurb: "What every office starts with.",
  }),
  row("Wallpaper", "decor.wall.hygge", "Hygge", 60, "hygge", 1, { blurb: "Warm cream and a candle's glow." }),
  row("Wallpaper", "decor.wall.skagen", "Skagen yellow", 90, "skagen", 1, { blurb: "The painters' light." }),
  row("Wallpaper", "decor.wall.nyhavn", "Nyhavn", 120, "nyhavn", 1, {
    blurb: "Stripes in the harbour's colours.",
  }),
  row("Wallpaper", "decor.wall.hammershoi", "Hammershøi", 150, "hammershoi", 1, {
    blurb: "Hushed grey-blue.",
  }),
  row("Wallpaper", "decor.wall.rundetaarn", "Rundetårn", 180, "rundetaarn", 1, {
    blurb: "Red brick, like the Round Tower.",
  }),
  row("Wallpaper", "decor.wall.terminal", "Terminal", 210, "terminal", 1, {
    blurb: "Green text that never stops scrolling.",
  }),
  row("Wallpaper", "decor.wall.jacobsen", "Arne Jacobsen", 240, "jacobsen", 1, {
    blurb: "Flat sage green, nothing more.",
  }),
  row("Wallpaper", "decor.wall.kanban", "Kanban", 330, "kanban", 1, { blurb: "Nothing is in Done." }),
  row("Wallpaper", "decor.wall.tivoli", "Tivoli", 0, "tivoli", 1, {
    level: 25,
    blurb: "Dark blue with little gold lights.",
  }),
];

/** `FLOORS` in decor.ts. */
export const FLOOR_ROWS: readonly FurnRow[] = [
  row("Floors", "decor.floor.boards", "Boards", 0, "boards", 1, { blurb: "What every office starts with." }),
  row("Floors", "decor.floor.linoleum", "Linoleum", 60, "linoleum", 1, {
    blurb: "Danish mid-century green.",
  }),
  row("Floors", "decor.floor.terrazzo", "Terrazzo", 90, "terrazzo", 1, { blurb: "Speckled stone chips." }),
  row("Floors", "decor.floor.klinker", "Klinker", 135, "klinker", 1, { blurb: "Red-brown clay tiles." }),
  row("Floors", "decor.floor.parquet", "Parquet", 150, "parquet", 1, {
    blurb: "Herringbone, dark and glossy.",
  }),
  row("Floors", "decor.floor.datacentre", "Server room", 210, "datacentre", 1, {
    blurb: "Mind the cold aisle.",
  }),
  row("Floors", "decor.floor.fiskebenet", "Fiskebenet", 270, "fiskebenet", 1, {
    blurb: "Pale oak herringbone.",
  }),
  row("Floors", "decor.floor.douglas", "Douglas planks", 360, "douglas", 1, { blurb: "Wide, pale planks." }),
  row("Floors", "decor.floor.checker", "Checker", 450, "checker", 1, {
    blurb: "Black and white, like a cafe.",
  }),
  row("Floors", "decor.floor.bornholm", "Bornholm cobble", 0, "bornholm", 1, {
    level: 40,
    blurb: "Stones from the island.",
  }),
];

export const FURNITURE_SHOP_ROWS: readonly FurnRow[] = fromCore([
  ...FURNITURE_ROWS,
  ...COMPANY_ROWS,
  ...HOME_ROWS,
  ...POSTER_ROWS,
  ...DESK_ROWS,
  ...WALLPAPER_ROWS,
  ...FLOOR_ROWS,
]);
