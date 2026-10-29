/**
 * The shop rows' prices, levels and names come from core (the server's own catalogue); the rows here only add what core
 * does not know (the 3D model, the blurb for the room). A row whose id core knows takes core's price, level and name,
 * so a price change in core reaches the shelves, and the buy panel can never ask for coins the server will not take.
 * Ids core does not have (`pet.<n>.<variant>`, the creator's `style.`/`skin.`/`hair.`) are left as written.
 */
import { DECORS } from "@tokenmaxxing/core/decor.ts";
import { DESKS } from "@tokenmaxxing/core/desks.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";

interface Row {
  id: string;
  name: string;
  price: number;
  level?: number;
}

function truth(id: string): Row | undefined {
  const decor = /^decor\.(wall|floor)\.(.+)$/.exec(id);
  if (decor) {
    const d = DECORS[decor[1] as "wall" | "floor"].find((x) => x.id === decor[2]);
    return d && { id, name: d.name, price: d.price, level: d.level };
  }
  if (id.startsWith("desk.")) {
    const d = DESKS.find((x) => `desk.${x.id}` === id);
    return d && { id, name: d.name, price: d.price, level: d.level };
  }
  return itemById(id);
}

export function fromCore<T extends Row>(rows: readonly T[]): T[] {
  return rows.map((r) => {
    const t = truth(r.id);
    if (!t) return r;
    const out = { ...r, name: t.name, price: t.price };
    if (t.level === undefined) delete out.level;
    else out.level = t.level;
    return out;
  });
}
