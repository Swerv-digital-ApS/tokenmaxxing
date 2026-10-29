/**
 * What tells one HUD icon from another (`icons.ts`): the same key is the same picture. Nothing of three or the
 * DOM in it, so it can be tested on its own.
 */
import { merchKey } from "../art/merch.ts";
import type { IconSpec } from "./icons.ts";

/** What tells one icon from another: the same key is the same picture. */
export function iconKey(s: IconSpec): string {
  switch (s.kind) {
    case "piece":
      return `piece:${s.ch}`;
    case "pet":
      return `pet:${s.pet}.${s.variant ?? 0}.${s.wear ?? 0}.${(s.name ?? "").trim().toLowerCase()}`;
    case "avatar": {
      const l = s.look;
      const w = [
        l.style,
        l.skin,
        l.hair,
        l.outfit,
        l.glasses ?? 0,
        l.hat ?? 0,
        l.held ?? 0,
        l.back ?? 0,
        l.aura ?? 0,
      ];
      // Merch is dressed from the company's colours and print as they are now: a redraw is another picture.
      const merch = l.merch && l.merchWorn ? `.${l.merchWorn}:${merchKey(l.merch)}` : "";
      return `avatar:${w.join(".")}.${l.merch ?? 0}${merch}:${s.focus ?? "body"}:${s.facing ?? "front"}`;
    }
    case "merch": {
      const c = s.company;
      const d = c.merch ? `${c.merch.main}${c.merch.accent}${c.merch.rows.join("")}` : "";
      return `merch:${c.id}.${s.merch}:${c.brand?.roof ?? ""}${c.brand?.plaque ?? ""}:${c.name}:${d}`;
    }
    case "trophy":
      return `trophy:${s.id}.${s.earned === false ? 0 : 1}`;
    case "desk":
      return `desk:${s.tier}`;
    case "boss":
      return `boss:${s.id}`;
    case "case":
      // The Night Market's (the first case) keeps its old key.
      return s.caseId && s.caseId !== "night-market" ? `case:${s.caseId}:${s.what}` : `case:${s.what}`;
  }
}
