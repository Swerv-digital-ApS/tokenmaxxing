/**
 * Company merch: a tee, a hoodie, a cap and a mug in a company's colours (its brand's roof and plaque,
 * or a pair picked by its id) with its initials. Worn over a character (`characters.ts`) and shown
 * on its own in the bag and the merch shop.
 */
import { type Brand, MERCH_PRINT_H, MERCH_PRINT_W, type MerchDesign } from "@tokenmaxxing/core/world.ts";
import { typedSwitch } from "hanzio";
import { C, shade } from "./palette.ts";
import { bake, cached, initialsOf, type Palette, type Pen } from "./pixels.ts";

interface MerchColours {
  main: string;
  shade: string;
  /** The logo, the cap's badge and the mug's print. */
  accent: string;
  /** For neon: a bright take on the main colour. */
  glow: string;
  initials: string;
  /** What its people drew; the print is this where there is one, the initials where there isn't. */
  design: MerchDesign | null;
}

/** Companies without a brand get one of these, by id: [main, accent]. */
const PAIRS: [string, string][] = [
  ["#3a6fb8", "#f5d14a"],
  ["#c4544b", "#fbf7ef"],
  ["#3f8c50", "#f4efe4"],
  ["#5b3fbf", "#3ddc84"],
  ["#2c3142", "#f08a3c"],
  ["#e0a15a", "#2b2433"],
  ["#cf6690", "#fbf7ef"],
  ["#1f2a24", "#3ddc84"],
];

/** A company's merch colours. */
export function merchColours(c: MerchCompany): MerchColours {
  if (c.merch)
    return {
      main: c.merch.main,
      shade: shade(c.merch.main, -0.25),
      accent: c.merch.accent,
      glow: shade(c.merch.main, 0.6),
      initials: initialsOf(c.name),
      design: c.merch,
    };
  const [main, accent] = c.brand ? [c.brand.roof, c.brand.plaque] : PAIRS[c.id % PAIRS.length]!;
  // A plaque the colour of the roof would leave the logo invisible.
  const logo = accent.toLowerCase() === main.toLowerCase() ? C.white : accent;
  return {
    main,
    shade: shade(main, -0.25),
    accent: logo,
    glow: shade(main, 0.6),
    initials: initialsOf(c.name),
    design: null,
  };
}

export type MerchCompany = { id: number; name: string; brand: Brand | null; merch?: MerchDesign | null };

/**
 * A company the world doesn't have (it closed, or its list hasn't come yet): the pair its id picks, with
 * "TM". Both renderers and the shop dress its merch the same way (`merchFor` in `gear3d.ts` takes the
 * same pair), so a closed company's merch doesn't change colour with the view.
 */
export const goneCompany = (id: number): MerchCompany => ({ id, name: "TM", brand: null });
const GONE = new Map<number, MerchColours>();
function goneColours(id: number): MerchColours {
  const known = GONE.get(id);
  if (known) return known;
  const m = merchColours(goneCompany(id));
  GONE.set(id, m);
  return m;
}

/** A key for caches: what merch in `m` looks like. */
const keyOf = (m: MerchColours) => `${m.main}${m.accent}${m.initials}${m.design?.rows.join() ?? ""}`;

/** Every company's merch colours and their key, worked out as the world gets its companies (`setCompanies`). */
const COMPANIES = new Map<number, { colours: MerchColours; key: string }>();
let version = 0;

export function setMerchCompanies(list: readonly MerchCompany[]): void {
  COMPANIES.clear();
  for (const c of list) {
    const colours = merchColours(c);
    COMPANIES.set(c.id, { colours, key: keyOf(colours) });
  }
  version++;
}

/** Goes up whenever the companies change: for caches of anything wearing merch. */
export const merchVersion = (): number => version;

export const coloursOf = (companyId: number): MerchColours =>
  COMPANIES.get(companyId)?.colours ?? goneColours(companyId);

/** A company's merch colours, if the world has that company (the 3D avatars dress from these too). */
export const knownColours = (companyId: number): MerchColours | undefined =>
  COMPANIES.get(companyId)?.colours;

/** A key for caches: what the merch of `companyId` looks like right now. */
export const merchKey = (companyId: number): string =>
  COMPANIES.get(companyId)?.key ?? keyOf(goneColours(companyId));

/** The cap over the head, from row 0: `c` crown, `C` brim, `L` the badge. */
// Pixel art reads as a grid.
// prettier-ignore
export const CAP: Record<"down" | "side" | "up", string[]> = {
  down: ["................", ".....oooooo.....", "....occLLcco....", "...occcLLcccco..", "..oCCCCCCCCCCo.."],
  side: ["................", ".....oooooo.....", "....occccLco....", "...occcccLLco...", "...occcccCCCCCo."],
  up: ["................", ".....oooooo.....", "....occcccco....", "...occcccccco...", "...occcccccco...", "...oCCCCCCCCo..."],
};

export const capPalette = (m: MerchColours): Palette => ({ o: C.ink, c: m.main, C: m.shade, L: m.accent });

/**
 * Over the body (drawn at y = 9): the logo on the chest from the front, and for a hoodie its
 * drawstrings, pocket and, from behind, the hood.
 */
export function drawTop(
  p: Pen,
  m: MerchColours,
  view: "down" | "side" | "up",
  hoodie: boolean,
  flip: boolean,
) {
  const x = (n: number) => (flip ? 15 - n : n);
  typedSwitch(view, {
    down: () => {
      if (m.design) {
        // The 4×3 thumbnail's middle two columns on the chest (one row with a hoodie's pouch below).
        const rows = thumb(m.design)
          .slice(0, hoodie ? 1 : 3)
          .map((r) => r.slice(1, 3));
        p.grid(rows, designPalette(m), 7, 10);
      } else p.rect(7, 10, 2, hoodie ? 1 : 2, m.accent);
      if (hoodie) {
        p.px(6, 9, C.white);
        p.px(9, 9, C.white);
        p.rect(6, 11, 4, 1, m.shade);
      }
    },
    side: () => p.px(x(9), 10, m.accent),
    up: () => {
      if (!hoodie) return;
      // The hood, down the back of the head.
      p.rect(4, 6, 8, 3, C.ink);
      p.rect(5, 6, 6, 3, m.main);
      p.rect(5, 8, 6, 1, m.shade);
    },
  });
}

/** The mug, in the right hand. From behind, it's hidden. */
export function drawMug(p: Pen, m: MerchColours, view: "down" | "side" | "up", flip: boolean) {
  if (view === "up") return;
  const [x0, y0] = view === "down" ? [12, 10] : [10, 10];
  const x = (n: number, w = 1) => (flip ? 16 - n - w : n);
  p.rect(x(x0, 3), y0, 3, 4, C.ink);
  p.rect(x(x0 + 1), y0 + 1, 1, 2, m.main);
  p.px(x(x0 + 1), y0 + 1, m.accent);
  p.rect(x(x0 + 3), y0 + 1, 1, 2, C.ink);
}

/** One piece on its own, 16×16, for the bag, the floor and the shop: big enough for the initials. */
export const merchFrame = cached(
  (companyId: number, bit: number) => `${companyId}:${bit}:${merchKey(companyId)}`,
  (companyId: number, bit: number) => {
    const m = coloursOf(companyId);
    return bake(16, 16, (p) => {
      if (bit === 4) return cap(p, m);
      if (bit === 8) return mug(p, m);
      shirt(p, m, bit === 2);
    });
  },
);

const designPalette = (m: MerchColours): Palette => ({ a: m.accent, w: C.white, k: C.ink });

/** The design shrunk to half size: a 2×2 block is a pixel if any of it is, in the first colour found. */
function thumb(d: MerchDesign): string[] {
  const out: string[] = [];
  for (let y = 0; y < MERCH_PRINT_H; y += 2) {
    let row = "";
    for (let x = 0; x < MERCH_PRINT_W; x += 2)
      row +=
        [d.rows[y]![x], d.rows[y]![x + 1], d.rows[y + 1]![x], d.rows[y + 1]![x + 1]].find((c) => c !== ".") ??
        ".";
    out.push(row);
  }
  return out;
}

/** The print, centred on `cx`, from row `y`: the drawing at full size on a shirt, shrunk (`small`) on the rest; else the initials. */
function print(p: Pen, m: MerchColours, cx: number, y: number, color = m.accent, small = false) {
  if (m.design) {
    const rows = small ? thumb(m.design) : m.design.rows;
    p.grid(rows, designPalette(m), Math.round(cx - rows[0]!.length / 2), y);
    return;
  }
  p.text(m.initials, Math.round(cx - (m.initials.length * 4 - 1) / 2), y, color);
}

/** A piece of merch drawn from a design that isn't saved yet, for the editor. */
export const merchPreview = (company: MerchCompany, bit: number): HTMLCanvasElement => {
  const m = merchColours(company);
  return bake(16, 16, (p) => {
    if (bit === 4) return cap(p, m);
    if (bit === 8) return mug(p, m);
    shirt(p, m, bit === 2);
  });
};

function shirt(p: Pen, m: MerchColours, hoodie: boolean) {
  // Sleeves out, body down: a tee laid flat.
  p.rect(4, 2, 8, 13, C.ink);
  p.rect(0, 3, 16, 6, C.ink);
  p.rect(1, 4, 14, 4, m.main);
  p.rect(5, 3, 6, 11, m.main);
  p.rect(1, 7, 3, 1, m.shade);
  p.rect(12, 7, 3, 1, m.shade);
  p.rect(5, 13, 6, 1, m.shade);
  if (hoodie) {
    // The hood behind the neck, strings, the pouch.
    p.rect(5, 0, 6, 3, C.ink);
    p.rect(6, 1, 4, 2, m.shade);
    p.px(7, 3, C.white);
    p.px(8, 3, C.white);
    p.px(7, 4, C.white);
    p.px(8, 4, C.white);
    p.rect(5, 12, 6, 1, m.shade);
    print(p, m, 8, 6);
  } else {
    p.rect(7, 3, 2, 1, m.shade);
    print(p, m, 8, 6);
  }
}

function cap(p: Pen, m: MerchColours) {
  p.rect(3, 5, 10, 7, C.ink);
  p.rect(2, 7, 12, 5, C.ink);
  p.rect(4, 6, 8, 5, m.main);
  p.rect(3, 8, 10, 3, m.main);
  p.rect(1, 11, 15, 3, C.ink);
  p.rect(2, 12, 13, 1, m.shade);
  p.px(7, 4, C.ink);
  p.px(8, 4, C.ink);
  print(p, m, 8, 5, m.accent, true);
}

function mug(p: Pen, m: MerchColours) {
  p.rect(2, 14, 11, 2, C.shadow);
  p.rect(2, 3, 11, 12, C.ink);
  p.rect(3, 4, 9, 10, m.main);
  p.rect(3, 4, 9, 1, shade(m.main, 0.3));
  p.rect(12, 6, 3, 6, C.ink);
  p.rect(13, 7, 1, 4, m.shade);
  p.rect(12, 7, 1, 4, m.main);
  print(p, m, 7, 6, m.accent, true);
  // Steam.
  p.px(5, 1, C.stoneLight);
  p.px(6, 0, C.stoneLight);
  p.px(9, 1, C.stoneLight);
}
