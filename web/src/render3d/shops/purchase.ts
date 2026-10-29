/**
 * What an item id in a shop means to the real game, as pure functions: which server call buys it
 * (`purchaseOf`), what wearing, applying or placing it does (`equipOf`, `lookWith`), and what a failed call
 * says (`failOf`). The ids are the ones in core (`core/src/shop.ts` items, `decor.ts`, `desks.ts`); the shop
 * specs carry a few of their own (`pet.<n>.<variant>`) that map onto them here.
 */

import { onSale } from "@tokenmaxxing/core/costumes.ts";
import { type DecorKind, FLOORS, WALLPAPERS } from "@tokenmaxxing/core/decor.ts";
import { DESKS } from "@tokenmaxxing/core/desks.ts";
import { PET_VARIANTS, wearPet } from "@tokenmaxxing/core/pets.ts";
import { itemById, MERCH } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { isWorn, withItem } from "../../hud/lookOps.ts";

/** How an item is paid for, or why it cannot be. */
export type Purchase =
  /** `town.buy(id)`: clothes, face things, pets, pet gear, a personal office's furniture. */
  | { kind: "item"; id: string }
  /** `town.buy(id)` for a company's merch (`merch.<companyId>.<kind>`). */
  | { kind: "merch"; id: string; companyId: number }
  /** `town.buyDecor(decor, id)`. */
  | { kind: "decor"; decor: DecorKind; id: string }
  /** `town.buyDesk(id)`. */
  | { kind: "desk"; id: string }
  /** `town.buyPiece(id)`, from the company wallet: company furniture and posters. */
  | { kind: "piece"; id: string }
  /** Nothing to pay: it comes with a pet you hold (`pet.<n>.<variant>`). */
  | { kind: "variant"; pet: number; variant: number }
  /** Nothing to pay: free from the start (the creator's parts, the plain decor, the laptop). */
  | { kind: "free" }
  /** Never sold: a level reward, raid loot, a case's item, the traveling merchant's cart; or a holiday costume out of season. */
  | { kind: "unsold"; why: "level" | "loot" | "case" | "edition" | "earned" | "season" }
  | { kind: "unknown" };

const MERCH_ID = /^merch\.[1-9]\d{0,9}\.([a-z]+)$/;

/** `id` if it is real merch (`merch.<companyId>.<kind>`), or null. */
export function realMerchId(id: string): string | null {
  const m = MERCH_ID.exec(id);
  return m && MERCH.some((k) => k.kind === m[1]) ? id : null;
}

/** `pet.<n>.<variant name>` as the pet and its `Look.petVariant`, or null. */
export function petVariantOf(id: string): { pet: number; variant: number } | null {
  const m = /^pet\.(\d+)\.([a-z]+)$/.exec(id);
  if (!m) return null;
  const pet = Number(m[1]);
  const at = PET_VARIANTS[pet]?.indexOf(m[2]!) ?? -1;
  return at < 0 ? null : { pet, variant: at + 1 };
}

const decorOf = (id: string) => {
  const m = /^decor\.(wall|floor)\.([a-z]+)$/.exec(id);
  if (!m) return null;
  const kind = m[1] as DecorKind;
  const d = (kind === "wall" ? WALLPAPERS : FLOORS).find((x) => x.id === m[2]);
  return d ? { kind, d } : null;
};

export function purchaseOf(id: string, now = Date.now()): Purchase {
  if (/^(style|skin|hair)\.\d+$/.test(id)) return { kind: "free" };
  const variant = petVariantOf(id);
  if (variant) return { kind: "variant", ...variant };
  if (id.startsWith("merch.")) {
    const real = realMerchId(id);
    return real ? { kind: "merch", id: real, companyId: Number(real.split(".")[1]) } : { kind: "unknown" };
  }
  if (id.startsWith("decor.")) {
    const x = decorOf(id);
    if (!x) return { kind: "unknown" };
    if (x.d.level !== undefined) return { kind: "unsold", why: "level" };
    return x.d.price === 0 ? { kind: "free" } : { kind: "decor", decor: x.kind, id: x.d.id };
  }
  if (id.startsWith("desk.")) {
    const d = DESKS.find((x) => `desk.${x.id}` === id);
    if (!d) return { kind: "unknown" };
    // The better setups are also bought sooner with coins (`buyDesk`), the laptop is free.
    return d.price === 0 ? { kind: "free" } : { kind: "desk", id: d.id };
  }
  const item = itemById(id);
  if (!item) return { kind: "unknown" };
  if (item.company) return { kind: "piece", id };
  if (item.case) return { kind: "unsold", why: "case" };
  if (item.loot) return { kind: "unsold", why: "loot" };
  if (item.level !== undefined) return { kind: "unsold", why: "level" };
  if (item.earned) return { kind: "unsold", why: "earned" };
  if (!onSale(item, now)) return { kind: "unsold", why: "season" };
  if (item.price === 0) return { kind: "free" };
  return { kind: "item", id };
}

// MARK: Wearing

/** What owning an item lets you do with it. */
export type Equip =
  | { kind: "wear"; id: string }
  | { kind: "restyle"; slot: "style" | "skin" | "hair"; index: number }
  | { kind: "pet"; pet: number; variant: number }
  | { kind: "petwear"; index: number }
  | { kind: "decor"; decor: DecorKind; id: string }
  | { kind: "desk"; id: string }
  | { kind: "place"; id: string }
  | { kind: "none" };

export function equipOf(id: string): Equip {
  const r = /^(style|skin|hair)\.(\d+)$/.exec(id);
  if (r) return { kind: "restyle", slot: r[1] as "style", index: Number(r[2]) };
  const v = petVariantOf(id);
  if (v) return { kind: "pet", ...v, variant: v.variant };
  if (id.startsWith("merch.")) {
    const real = realMerchId(id);
    return real ? { kind: "wear", id: real } : { kind: "none" };
  }
  const d = decorOf(id);
  if (d) return { kind: "decor", decor: d.kind, id: d.d.id };
  if (id.startsWith("desk."))
    return DESKS.some((x) => `desk.${x.id}` === id) ? { kind: "desk", id: id.slice(5) } : { kind: "none" };
  const item = itemById(id);
  if (!item) return { kind: "none" };
  if (item.slot === "furniture") return { kind: "place", id };
  if (item.slot === "petwear") return { kind: "petwear", index: item.index };
  if (item.slot === "pet") return { kind: "pet", pet: item.index, variant: 0 };
  return { kind: "wear", id };
}

/** `look` after `eq` (wearing on, or taking `off` the item); other kinds change nothing in a look. */
export function lookWith(look: Look, eq: Equip, on = true): Look {
  switch (eq.kind) {
    case "restyle":
      return { ...look, [eq.slot]: eq.index };
    case "pet":
      return {
        ...wearPet(look, eq.pet),
        petVariant: eq.variant || (look.pet === eq.pet ? look.petVariant : 0),
      };
    case "petwear":
      return { ...look, petwear: on ? eq.index : 0 };
    case "wear": {
      const item = itemById(eq.id);
      return item ? withItem(item, look, on) : look;
    }
    default:
      return look;
  }
}

/** Whether `look` has `id` on: worn, the pet (and its look) in use, the style chosen. */
export function wornIn(look: Look, id: string): boolean {
  const eq = equipOf(id);
  switch (eq.kind) {
    case "restyle":
      return look[eq.slot] === eq.index;
    case "pet":
      return look.pet === eq.pet && look.petVariant === eq.variant;
    case "petwear":
      return look.petwear === eq.index;
    case "wear": {
      const item = itemById(eq.id);
      return !!item && isWorn(item, look);
    }
    default:
      return false;
  }
}

// MARK: Failures

export type FailReason =
  "coins" | "level" | "owned" | "unowned" | "company" | "unavailable" | "slow" | "offline" | "other";

export type Outcome = { ok: true; message?: string } | { ok: false; reason: FailReason; message: string };

export const done = (message?: string): Outcome => ({ ok: true, message });
export const fail = (reason: FailReason, message: string): Outcome => ({ ok: false, reason, message });

const CODES: Record<string, FailReason> = {
  too_poor: "coins",
  owned: "owned",
  not_owned: "unowned",
  not_member: "company",
  not_owner: "company",
  not_found: "unavailable",
  not_for_sale: "unavailable",
  not_tradeable: "unavailable",
  rate_limited: "slow",
  invalid_look: "other",
  invalid_decor: "other",
};

/** A failed server call as an outcome the panel can toast: the server's own words, sorted into a reason. */
export function failOf(err: unknown): Outcome & { ok: false } {
  const e = err as { code?: string; message?: string } | null;
  const message = e?.message?.replace(/^.*?: /, "") || "Something went wrong.";
  return { ok: false, reason: (e?.code && CODES[e.code]) || "other", message };
}
