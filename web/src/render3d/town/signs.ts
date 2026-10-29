import { compact } from "@tokenmaxxing/core/format.ts";
import { TAVERN } from "@tokenmaxxing/core/tavern.ts";
import type { Peek } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { world } from "../../game/world.ts";
import { hud } from "../../store.ts";
import type { Overlay } from "../engine/overlay.ts";
import type { RoomView, Sign } from "../rooms/rooms.ts";

/** At most this many names show under a house's sign; the rest are a "+N" (as in the 2D game). */
const CHIPS_MAX = 4;

interface Shown {
  el: HTMLDivElement;
  text: string;
  chips: HTMLDivElement | null;
  chipsKey: string;
  cls: string;
  click: (() => void) | undefined;
}

/**
 * The words fixed to places: company signs (clicking one opens the company's page), the Tavern's, office
 * doors' names, `💤 N asleep`, and the chips of who is at home under a house's sign. Same words as the 2D
 * game's labels, as DOM over the canvas.
 */
export class Signs {
  private readonly shown = new Map<string, Shown>();
  private asleep: HTMLDivElement | null = null;
  private readonly at = new THREE.Vector3();
  private listed: { view: RoomView; list: Sign[] } | null = null;

  constructor(private readonly overlay: Overlay) {}

  private all(view: RoomView): Sign[] {
    // The room's own fixed signs, computed once; doors come from the snapshot and change with it.
    if (this.listed?.view !== view) this.listed = { view, list: view.signs() };
    const out = [...this.listed.list];
    const more = view.liveSigns?.();
    if (more) out.push(...more);
    for (const d of world.doors) {
      const [x, z] = view.toWorld(d.x, d.y);
      out.push({
        key: `door:${d.x},${d.y}`,
        at: [x, 2.3, z + 0.5],
        kind: "door",
        text: d.name,
        own: d.userId === world.selfId,
      });
    }
    return out;
  }

  private textOf(s: Sign): string | null {
    if (s.kind === "inn") return `🛏 The ${TAVERN ? "Tavern" : "Inn"}`;
    if (s.kind === "door" || s.kind === "label") return s.text ?? null;
    const c = world.companies.get(s.companyId ?? -1);
    return c ? `🏢 ${c.name} · ${compact(c.todayTokens)} today` : null;
  }

  update(view: RoomView, camera: THREE.OrthographicCamera): void {
    const live = new Set<string>();
    for (const s of this.all(view)) {
      const text = this.textOf(s);
      if (text === null) continue;
      live.add(s.key);
      let e = this.shown.get(s.key);
      if (!e) {
        const el = this.overlay.make("r3-sign");
        if (s.kind === "company" && s.companyId !== undefined) {
          const id = s.companyId;
          el.classList.add("link");
          el.addEventListener("click", () => hud.set({ panel: { kind: "companyCard", companyId: id } }));
        }
        if (s.own || s.kind === "company" || s.kind === "inn") el.classList.add("own");
        e = { el, text: "", chips: null, chipsKey: "", cls: "", click: undefined };
        this.shown.set(s.key, e);
        if (s.kind === "label")
          el.addEventListener("click", () => {
            this.shown.get(s.key)?.click?.();
          });
      }
      if (s.kind === "label") {
        const cls = [s.own ? "own" : "", s.cls ?? "", s.onClick ? "link" : ""].filter(Boolean).join(" ");
        if (e.cls !== cls) {
          e.cls = cls;
          e.el.className = `label r3-sign ${cls}`.trim();
        }
        e.click = s.onClick;
      }
      if (e.text !== text) {
        e.text = text;
        e.el.textContent = text;
      }
      this.at.set(...s.at);
      const on = this.overlay.place(e.el, this.at, camera, 0, s.dy ?? 0, true);
      this.chips(e, s, on, camera);
    }
    for (const [key, e] of this.shown)
      if (!live.has(key)) {
        e.el.remove();
        e.chips?.remove();
        this.shown.delete(key);
      }
    this.sleeping(view, camera);
  }

  /** Who is at home, under a company house's sign: `💤 name Lv5`. */
  private chips(e: Shown, s: Sign, on: boolean, camera: THREE.Camera): void {
    const people: readonly Peek[] =
      s.kind === "company" && s.companyId !== undefined ? (world.houses[s.companyId] ?? []) : [];
    if (!people.length || !on) {
      if (e.chips) {
        e.chips.remove();
        e.chips = null;
        e.chipsKey = "";
      }
      return;
    }
    const key = people.map((p) => `${p.id}${p.state}${p.name}${p.level}`).join();
    if (!e.chips || e.chipsKey !== key) {
      e.chips?.remove();
      const row = this.overlay.make("r3-chips");
      for (const p of people.slice(0, CHIPS_MAX)) {
        const chip = document.createElement("div");
        chip.className = "r3-chip";
        chip.textContent = `${p.state === "away" ? "💤 " : p.state === "working" ? "💻 " : ""}${p.name} Lv${p.level}`;
        chip.addEventListener("click", () => hud.set({ panel: { kind: "card", userId: p.id } }));
        row.append(chip);
      }
      if (people.length > CHIPS_MAX) {
        const more = document.createElement("div");
        more.className = "r3-chip";
        more.textContent = `+${people.length - CHIPS_MAX}`;
        row.append(more);
      }
      e.chips = row;
      e.chipsKey = key;
    }
    this.at.set(...s.at);
    this.overlay.place(e.chips, this.at, camera, 0, 24, true);
  }

  /** `💤 N asleep` over the room's top middle: the offline players the Inn only counts. */
  private sleeping(view: RoomView, camera: THREE.Camera): void {
    if (world.asleep <= 0) {
      this.asleep?.remove();
      this.asleep = null;
      return;
    }
    this.asleep ??= this.overlay.make("r3-sign");
    const text = `💤 ${world.asleep} asleep`;
    if (this.asleep.textContent !== text) this.asleep.textContent = text;
    const b = view.bounds;
    this.at.set((b.minX + b.maxX) / 2, 2.4, b.minZ + 2.4);
    this.overlay.place(this.asleep, this.at, camera);
  }

  dispose(): void {
    for (const e of this.shown.values()) {
      e.el.remove();
      e.chips?.remove();
    }
    this.shown.clear();
    this.asleep?.remove();
    this.listed = null;
  }
}
