/**
 * What a desk can look like: a laptop, then more and more screens. Cosmetic only; nothing about a desk
 * helps anyone work. Two ways to get a setup:
 *  - personal: bought once with your coins (`purchases`, item `desk.<id>`), the better ones also yours
 *    from a level, and you pick which one you own to use (`users.desk`);
 *  - the company's fleet: a house-wide tier bought from the company wallet, one step at a time.
 * What shows at a desk in a company house is the better of the two (`effectiveDesk`). The art is in
 * `web/src/art/desks.ts`, by index into `DESKS`; an index nobody knows is the laptop.
 */
export interface DeskSetup {
  id: string;
  name: string;
  /** Coins for you; 0 for the laptop. */
  price: number;
  blurb: string;
  /** Yours for free from this level (it can still be bought sooner). */
  level?: number;
  /** What the company wallet pays to bring the whole house up to this tier from the one before. */
  fleet: number;
}

/** In order of grandeur: an index is a tier, and a higher one is always the better setup. */
export const DESKS: readonly DeskSetup[] = [
  { id: "laptop", name: "Laptop", price: 0, fleet: 0, blurb: "One screen, covered in stickers." },
  { id: "dual", name: "Dual monitors", price: 60, fleet: 300, blurb: "Code on one, docs on the other." },
  { id: "triple", name: "Triple monitors", price: 180, fleet: 700, blurb: "Agents, logs and a dashboard." },
  {
    id: "ultrawide",
    name: "Ultrawide",
    price: 450,
    fleet: 1400,
    level: 25,
    blurb: "One long curved screen, edge to edge.",
  },
  {
    id: "battlestation",
    name: "Battlestation",
    price: 900,
    fleet: 2500,
    level: 40,
    blurb: "Three screens, a glowing tower and RGB everywhere.",
  },
];

export const LAPTOP = 0;

/** A setup's place in `DESKS` from its id; anything unknown is the laptop. */
export const deskIndex = (id: unknown): number => {
  const i = DESKS.findIndex((d) => d.id === id);
  return i < 0 ? LAPTOP : i;
};

/** The purchase row's item name for a bought one. */
export const deskItem = (id: string): string => `desk.${id}`;

/** Whether someone at `level` with these purchases (`deskItem` names) may use `d`. */
export const ownsDesk = (d: DeskSetup, level: number, bought: ReadonlySet<string>): boolean =>
  d.price === 0 || (d.level !== undefined && level >= d.level) || bought.has(deskItem(d.id));

/** A tier off the wire (`PlayerInfo.desk`, `CompanyInfo.deskFleet`): absent, odd or out of range is the laptop. */
export const cleanDesk = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < DESKS.length ? (v as number) : LAPTOP;

/** The setup drawn at a desk: the better of the sitter's own and the house's fleet (none: just theirs). */
export const effectiveDesk = (personal: unknown, fleet?: unknown): number =>
  Math.max(cleanDesk(personal), cleanDesk(fleet));

/** The next fleet tier up from `tier`, with what it costs the wallet; null at the top. */
export const nextFleet = (tier: unknown): { tier: number; setup: DeskSetup } | null => {
  const next = cleanDesk(tier) + 1;
  const setup = DESKS[next];
  return setup ? { tier: next, setup } : null;
};
