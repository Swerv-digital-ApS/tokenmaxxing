import { wearPet } from "@tokenmaxxing/core/pets.ts";
import { type Item, MERCH } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { typedSwitch } from "hanzio";

/** Whether `look` wears `item`: in its slot, or as one of the company merch it wears. */
export function isWorn(item: Item, look: Look): boolean {
  return typedSwitch(
    item.slot,
    {
      furniture: () => false,
      dance: () => false,
      merch: () => look.merch === item.companyId && (look.merchWorn & item.index) > 0,
    },
    (slot) => look[slot] === item.index,
  );
}

const MERCH_TOPS = MERCH.filter((m) => m.kind === "tee" || m.kind === "hoodie").reduce(
  (n, m) => n | m.bit,
  0,
);

/** `look` without its merch tee or hoodie (the cap and mug stay): a new outfit replaces it. */
export function withoutMerchTop(look: Look): Look {
  const bits = look.merchWorn & ~MERCH_TOPS;
  return { ...look, merch: bits ? look.merch : 0, merchWorn: bits };
}

/**
 * `look` with `item` on (or off). Merch is one company's at a time, and a hoodie and a tee don't go
 * over each other, nor over an outfit: whichever goes on last replaces the other.
 */
export function withItem(item: Item, look: Look, on: boolean): Look {
  return typedSwitch(
    item.slot,
    {
      furniture: () => look,
      dance: () => look,
      // A different pet starts in its original look.
      pet: () => (on ? wearPet(look, item.index) : { ...look, pet: 0, petVariant: 0 }),
      outfit: () => (on ? withoutMerchTop({ ...look, outfit: item.index }) : { ...look, outfit: 0 }),
      merch: () => {
        const mine = look.merch === item.companyId ? look.merchWorn : 0;
        const bits = on
          ? (item.index & MERCH_TOPS ? mine & ~MERCH_TOPS : mine) | item.index
          : mine & ~item.index;
        return { ...look, merch: bits ? item.companyId! : 0, merchWorn: bits };
      },
    },
    (slot) => ({ ...look, [slot]: on ? item.index : 0 }),
  );
}

/**
 * Whether two looks are the same, field by field: the server's copy and a draft can list their fields in another
 * order, and leave out what is empty (no pet name, no merch) or spell it out as nothing.
 */
export function sameLook(a: Look, b: Look): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Look>;
  return [...keys].every((k) => (a[k] || undefined) === (b[k] || undefined));
}
