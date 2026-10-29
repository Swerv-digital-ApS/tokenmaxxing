import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { LEGEND, MAPS, type MapId } from "@tokenmaxxing/core/maps.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
setDefaultTimeout(60_000);

const { buildTavernRoom, buildDormRoom, TAVERN_W, TAVERN_D } =
  await import("../src/render3d/rooms/tavern3d.ts");
const { buildBasement } = await import("../src/render3d/rooms/basement3d.ts");
const { buildHq } = await import("../src/render3d/rooms/hq3d.ts");
const { shopRoom, SHOP_ROOM, SHOP_IDS } = await import("../src/render3d/shops/catalog.ts");
const { Room } = await import("../src/render3d/rooms/room.ts");
type Room = InstanceType<typeof Room>;

/** A room's picture is the map less its walls: x by 1, y by 2. */
const DEFAULT_INSET = [1, 2] as const;
const INSET = DEFAULT_INSET;

/** The 3D pieces that are only an exit marker (the door, the stairs): they stand on or in front of a map portal. */
const EXIT_ASSET = /^(tile:[xuS]$|stairs:|[a-z]+:door$)/u;
/** Flat pieces you walk over (rugs) and the Tavern's stage board, a platform the map draws as walkable `e`. */
const FLAT_ASSET = /rug$|^tavern:stage$/u;

type Kind = "floor" | "solid";

/** What the 3D room has on room tile (x, z): nothing, a flat rug or an exit marker is floor. */
function roomKind(room: Room, x: number, z: number): Kind {
  if (room.open(x, z)) return "floor";
  const id = room.at(x, z)?.asset.id ?? "";
  return FLAT_ASSET.test(id) || EXIT_ASSET.test(id) ? "floor" : "solid";
}

/** What the map says on the same tile: blocking means a prop, a seat, a wall; a portal tile is the exit. */
function mapKind(ch: string): Kind {
  return LEGEND[ch]?.walk || LEGEND[ch]?.portal ? "floor" : "solid";
}

const isSeat = (ch: string) => LEGEND[ch]?.seat !== undefined;

interface Opts {
  /** Map tiles ("x,y" in map coordinates) where a difference is intended, with the reason. */
  allow?: Record<string, string>;
  /** The room's exits are drawn outside its `Room` (a wall hanging, the skin), so `room.placed` has no marker for them. */
  exits?: false;
  /** The map tile of room tile (0, 0); default `INSET`. */
  inset?: readonly [number, number];
}

/** Every tile where the map and the room disagree about blocking or sitting, as readable lines. */
function diff(id: MapId, room: Room, opts: Opts = {}) {
  const out: string[] = [];
  const INSET = opts.inset ?? DEFAULT_INSET;
  const map = MAPS[id];
  const allow = opts.allow ?? {};
  for (let z = 0; z < room.D; z++)
    for (let x = 0; x < room.W; x++) {
      const mx = x + INSET[0];
      const my = z + INSET[1];
      if (allow[`${mx},${my}`]) continue;
      const ch = map.at(mx, my);
      const m = mapKind(ch);
      const r = roomKind(room, x, z);
      const a = room.at(x, z)?.asset;
      // The room's last row is the wall row when the map's bottom row is wall (`W`): the exit steps down into it.
      if (ch === "W" && r === "floor" && z === room.D - 1) continue;
      if (m !== r) out.push(`${id} map(${mx},${my})='${ch}' ${m} vs 3D ${r} (${a?.id ?? "-"})`);
      else if (isSeat(ch) !== (!!a && (!!a.seat || !!a.bed) && r === "solid"))
        out.push(`${id} map(${mx},${my})='${ch}' seat=${isSeat(ch)} vs 3D ${a?.id ?? "-"}`);
    }
  // Every portal of the map has an exit marker in the room within a tile (3D: on the wall row or the floor in front).
  for (const ch of opts.exits === false ? [] : ["x", "u", "S"]) {
    for (const [px, py] of map.find(ch)) {
      const near = room.placed.some((p) => {
        if (!EXIT_ASSET.test(p.asset.id)) return false;
        const [w, d] = Room.footprint(p.asset, p.turn);
        const cx = p.x + w / 2 + INSET[0];
        const cy = p.z + d / 2 + INSET[1];
        return Math.abs(cx - 0.5 - px) <= 1.5 && Math.abs(cy - 0.5 - py) <= 1.5;
      });
      if (!near && !allow[`${px},${py}`]) out.push(`${id} map(${px},${py})='${ch}' has no exit marker in 3D`);
    }
  }
  return out;
}

describe("room parity: the map and the 3D room are the same tiles", () => {
  test("inn", () => {
    const t = buildTavernRoom();
    // The Tavern's door is a wall hanging (`hang("tile:x")`), so it is checked through `layout` below.
    expect(diff("inn", t.room, { exits: false })).toEqual([]);
  });

  test("inn: the layout's characters are the map's", () => {
    const { layout } = buildTavernRoom();
    const lines: string[] = [];
    for (const [k, ch] of layout) {
      const [x, z] = k.split(",").map(Number) as [number, number];
      const m = MAPS.inn.at(x + INSET[0], z + INSET[1]);
      // The tip jar `$` stands on the bar counter `a` (3D: a model on the counter, the layout keeps the counter).
      if (m === "$" && ch === "a") continue;
      if (m !== ch) lines.push(`inn map(${x + INSET[0]},${z + INSET[1]})='${m}' vs layout '${ch}'`);
    }
    // And the other way: a map tile that is not plain floor or wall has a piece in the 3D room.
    for (let z = -1; z <= TAVERN_D; z++)
      for (let x = 0; x < TAVERN_W; x++) {
        const m = MAPS.inn.at(x + INSET[0], z + INSET[1]);
        if (m !== "_" && m !== "W" && !layout.has(`${x},${z}`))
          lines.push(`inn map(${x + INSET[0]},${z + INSET[1]})='${m}' has no 3D piece`);
      }
    expect(lines).toEqual([]);
  });

  test("upstairs", () => {
    expect(diff("upstairs", buildDormRoom().room)).toEqual([]);
  });

  test("basement", () => {
    expect(diff("basement", buildBasement().room)).toEqual([]);
  });

  test("hq", () => {
    // The stairs up and the exit door are drawn by the house skin (`room-skin.ts`, from `map.find("u")`), and so is the
    // office directory `ς` (from `map.find("ς")`): not in the `Room`, but placed from the map's own tile.
    const allow = { "14,12": "office directory, placed by the skin from the map" };
    expect(diff("hq", buildHq().room, { exits: false, allow })).toEqual([]);
  });

  for (const s of SHOP_IDS)
    test(`shop-${s}`, () => {
      const shop = shopRoom(s);
      // The pet shop's bed `Q` is a prop on the map (nobody lies in it) but a `bed` asset in 3D (the pets sleep in it).
      const allow = s === "pets" ? Object.fromEntries([3, 4, 5].map((x) => [`${x},11`, "pet bed"])) : {};
      // The shops' exit door is the room's `door` tile (not a placed marker): it is the map's `x`.
      expect(diff(SHOP_ROOM[s], shop.room, { exits: false, allow })).toEqual([]);
      const door = `${shop.door[0] + INSET[0]},${shop.door[1] + INSET[1]}`;
      expect(MAPS[SHOP_ROOM[s]].find("x").map(([x, y]) => `${x},${y}`)).toEqual([door]);
    });
});
