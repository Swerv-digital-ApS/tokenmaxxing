import { expect, test } from "bun:test";
import { ALL_CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import { DECORS } from "@tokenmaxxing/core/decor.ts";
import { DESKS } from "@tokenmaxxing/core/desks.ts";
import { HOME_PIECES } from "@tokenmaxxing/core/home.ts";
import { GameMap } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, PIECES, type Piece } from "@tokenmaxxing/core/office.ts";
import { POSTERS } from "@tokenmaxxing/core/posters.ts";
import { MERCH } from "@tokenmaxxing/core/shop.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D room modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { objectAt } = await import("../src/art/objects.ts");
const { fancyPiece } = await import("../src/art/furniture-fancy.ts");
const { posterArt } = await import("../src/art/furniture-posters.ts");
const { FLOOR_ART, WALL_ART } = await import("../src/art/tiles.ts");
const { CEILING_ASSET_IDS, DESK_TIERS, WALL_ASSET_IDS, merchProp } =
  await import("../src/render3d/furniture/furniture3d.ts");
const { FLOORS, WALLPAPERS } = await import("../src/render3d/furniture/decor3d.ts");
const { assetOfChar, turnOfChar } = await import("../src/render3d/rooms/room-furnished.ts");

/** Every piece an office can hold, whoever sells it: the shop's, the raid's trophies, the company's, the home's, the cases'. */
const ALL: readonly Piece[] = [...PIECES, ...COMPANY_FURNITURE, ...HOME_PIECES, ...ALL_CASE_PIECES];

/**
 * Intentional exceptions, by map character.
 *  "=": the rug is a floor tile in 2D (`GROUND.rug`, no sprite of its own) and a flat tile in 3D (free there).
 */
const NO_SPRITE = new Set(["="]);
const FREE_IN_3D = new Set(["="]);

const artOf = (p: Piece): string | undefined => (p as { art?: string }).art;
const isCompany = (p: Piece): boolean => COMPANY_FURNITURE.includes(p as never);

/** What the 2D side says about a piece's footprint: a fancy piece's own, a poster's, else one tile (`objectAt` draws one per tile). */
const sprite2D = (p: Piece): { w: number; h: number; placement: string } => {
  const art = artOf(p);
  const f = art ? fancyPiece(art) : undefined;
  if (f) return { w: f.w, h: f.h, placement: f.placement };
  const poster = art ? posterArt(art) : undefined;
  if (poster) return { w: poster.w, h: 1, placement: "wall" };
  return { w: p.w ?? 1, h: 1, placement: "floor" };
};

const meshesOf = (build: () => { traverse: (f: (o: unknown) => void) => void }): number => {
  let n = 0;
  build().traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) n++;
  });
  return n;
};

test("every piece has a 2D sprite and a 3D asset (the placer never needs its box)", () => {
  expect(ALL.length).toBeGreaterThanOrEqual(67 + 12);
  for (const p of ALL) {
    if (!NO_SPRITE.has(p.ch)) {
      const map = new GameMap("office" as never, "t", [`.${p.ch.repeat(p.w ?? 1)}.`]);
      expect(objectAt(map, 1, 0), `2D sprite for ${p.name}`).not.toBeNull();
    }
    const asset = assetOfChar(p.ch);
    expect(asset, `3D asset for ${p.name}`).toBeDefined();
    expect(
      meshesOf(() => asset!.build()),
      `3D model of ${p.name}`,
    ).toBeGreaterThan(0);
  }
});

test("every case piece, of every case, has a 2D sprite (objectAt would throw without one)", () => {
  expect(ALL_CASE_PIECES.length).toBeGreaterThanOrEqual(12);
  for (const p of ALL_CASE_PIECES) {
    const map = new GameMap("office" as never, "t", [`.${p.ch.repeat(p.w ?? 1)}.`]);
    expect(objectAt(map, 1, 0), `2D sprite for ${p.name}`).not.toBeNull();
    const f = fancyPiece(p.art);
    expect(f, `art "${p.art}" for ${p.name}`).toBeDefined();
    expect(f!.w, `${p.name}: 2D width`).toBe(p.w ?? 1);
  }
});

test("a piece's footprint, name and price are the same in the catalog, the sprite and the model", () => {
  for (const p of ALL) {
    const asset = assetOfChar(p.ch)!;
    const s = sprite2D(p);
    expect(asset.w, `${p.name}: 3D width`).toBe(p.w ?? 1);
    expect(s.w, `${p.name}: 2D width`).toBe(p.w ?? 1);
    // Depth: the sprite's rows (the Persian rug and the ping-pong table reach back over the row behind).
    expect(asset.d, `${p.name}: 3D depth`).toBe(s.h);
    expect(asset.name, `${p.name}: 3D name`).toBe(p.name);
    const art = artOf(p);
    const f = art ? fancyPiece(art) : undefined;
    if (f) {
      expect(f.name, `${p.name}: 2D name`).toBe(p.name);
      expect(f.price, `${p.name}: 2D price`).toBe(p.price);
    }
    if (!FREE_IN_3D.has(p.ch)) expect(asset.price, `${p.name}: 3D price`).toBe(p.price);
  }
});

test("facing and placement agree", () => {
  for (const p of ALL) {
    const asset = assetOfChar(p.ch)!;
    const s = sprite2D(p);
    const turn = turnOfChar(p.ch);
    // Seats face the room's south (2); nothing else turns, and nothing that hangs or lies flat does.
    expect([0, 2], `${p.name}: turn`).toContain(turn);
    if (turn === 2) expect(asset.seat, `${p.name}: only a seat turns`).toBeDefined();
    if (s.placement !== "floor") expect(turn, `${p.name}: turn of a hung or flat piece`).toBe(0);
    const hangs = s.placement === "wall" || (p as { wall?: true }).wall === true;
    // The company's whiteboard, bookshelf, neon sign and trophy case are "wall" pieces in 2D (drawn against the
    // wall) but stand on the floor in 3D, so only posters and personal-office wall pieces must hang there.
    if (!isCompany(p) || (p as { wall?: true }).wall) {
      expect(WALL_ASSET_IDS.has(asset.id), `${p.name}: hangs in 3D as in 2D`).toBe(hangs);
    }
    expect(CEILING_ASSET_IDS.has(asset.id), `${p.name}: ceiling`).toBe(s.placement === "ceiling");
  }
});

test("a sofa-like personal piece seats in 3D as it does in 2D", () => {
  for (const h of HOME_PIECES) expect(!!assetOfChar(h.ch)!.seat, `${h.name}: seat`).toBe(h.seat === "sofa");
});

test("the ten posters have art of the catalog's width", () => {
  expect(POSTERS.length).toBe(10);
  for (const p of POSTERS) expect(posterArt(p.art)?.w, p.name).toBe(p.w ?? 1);
});

test("wallpapers and floors: the same ids, names, prices and levels in core, 2D and 3D", () => {
  const three = { wall: WALLPAPERS, floor: FLOORS };
  const two: Record<string, Record<string, unknown>> = { wall: WALL_ART, floor: FLOOR_ART };
  for (const kind of ["wall", "floor"] as const) {
    expect(three[kind].map((d) => d.id)).toEqual(DECORS[kind].map((d) => d.id));
    for (const d of DECORS[kind]) {
      const look = three[kind].find((l) => l.id === d.id)!;
      expect(look.name).toBe(d.name);
      expect(look.price).toBe(d.price);
      expect(look.level).toBe(d.level);
      // The plain ones (cream panels, boards) are the base tile; every other id has art of its own.
      if (d.id !== "plain" && d.id !== "boards")
        expect(two[kind]![d.id], `${kind} ${d.id} 2D art`).toBeDefined();
    }
  }
});

test("desk setups match the core tiers", () => {
  const row = (t: { id: string; name: string; price: number; fleet: number; level?: number }) =>
    [t.id, t.name, t.price, t.fleet, t.level].join("|");
  expect(DESK_TIERS.map(row)).toEqual(DESKS.map(row));
});

test("every merch kind has a 3D prop", () => {
  const company = { id: 1, name: "Acme", brand: null };
  for (const m of MERCH)
    expect(
      meshesOf(() => merchProp(company, m.kind)),
      m.kind,
    ).toBeGreaterThan(0);
});
