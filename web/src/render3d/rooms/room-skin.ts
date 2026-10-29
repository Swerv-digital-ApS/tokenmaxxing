import type { GameMap, MapId } from "@tokenmaxxing/core/maps.ts";
import { SHOP_IDS, SHOP_ROOM, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { companyOfRoom, type RoomId } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { DUNGEON_ASSETS } from "../dungeon/dungeon3d.ts";
import { beginTickScope, endTickScope, glow, Model, painted, planks } from "../kit/kit.ts";
import { beginLanScope, endLanScope } from "../kit/livescreen.ts";
import { forgetShopRoom, type ShopRoom, shopRoom } from "../shops/catalog.ts";
import type { MarketSlots } from "../shops/market-slots.ts";
import { setPropsNight } from "../town/props.ts";
import { type BasementScene, dimBasement } from "./basement3d.ts";
import { exitPlate, exitStairs } from "./exits3d.ts";
import { buildHq, directoryBoard, type Hq } from "./hq3d.ts";
import { Room, WALL_T } from "./room.ts";
import type { TavernRoom } from "./tavern3d.ts";
import { buildRoomSkin, type RoomSkin, WorldRoom } from "./world.ts";
import "./world-rooms.ts";
import { world } from "../../game/world.ts";
import { disposeObject } from "../engine/dispose.ts";
import { placedIn } from "../furniture/placed.ts";
import { DeskSetups } from "./desk-setups.ts";
import { ExitMarkers } from "./exit-markers.ts";
import { hallwayTiles, houseOffset, housePassage, PASSAGE_W } from "./hq-layout.ts";
import { liveBasement, liveTavern } from "./live.ts";
import { PokerEvents } from "./poker-events.ts";
import { type LiveFrame, type RoomCtx, type RoomView, registerRoom, withTicks } from "./rooms.ts";
import { RouletteEvents } from "./roulette-events.ts";
import { TavernEvents } from "./tavern-events.ts";
import { wallEase } from "./walls.ts";

/**
 * The hand-built rooms (`world-rooms.ts`): the Tavern and the dorm, the basement, the four shops, the
 * company house and the offices, each built from the core map of the room the server says we are in (so the
 * tiles, doors, seats and displays are the game's own). The slices register their tile art at load.
 */
const SEAT_Y: Record<string, number> = { bench: 0.31, chair: 0.33, sofa: 0.36, bed: 0.3 };
const WALL_H = 2.6;

/** What a room builder hands back besides the picture. */
export interface SkinParts {
  /** Once a frame: the real game's data on the room's boards (`live.ts`). */
  live?: (t: number) => void;
  /** Once a frame, after the people: the real game's events in the room (the Tavern's jukebox sign). */
  frame?: (f: LiveFrame) => void;
  /** A coin was tossed into the tip jar or fountain in front of this tile. */
  onToss?: (tx: number, ty: number) => void;
  /** The room's own light, once: given the stage's lights (the Tavern keeps them to dim after dark). */
  lights?: (scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) => void;
  /** Frees what `frame` made (labels). */
  end?: () => void;
  /** A shop's interior, for picking its shelves. */
  shop?: ShopRoom;
  /** The basement's dim light. */
  dim?: boolean;
  /** The skin's own handles into the room (the Tavern's boards, the basement's screens...), by room. */
  extra: unknown;
  /** Bots whose bodies the room draws itself (the barkeep, the shopkeepers): ids. */
  keepers: ReadonlySet<number>;
  /** Lets go of what the room listens to outside itself (the LAN party), when it is thrown away. */
  free?: () => void;
}

/** Bent, the barkeep: the Tavern draws him behind the bar himself. */
const BARKEEP_BOT = -4;

const kindOf = (id: string): string => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id);

/**
 * Which way each seat of a room is turned (a yaw), by the middle of its tile in the view's units. The server only
 * knows a chair as "up" and a bench as "down"; the pieces are turned to the table or the bar, and a sitter should
 * face where their seat does.
 */
function seatYaws(group: THREE.Group, extra: unknown): { x: number; z: number; yaw: number }[] {
  const room = (extra as { room?: unknown } | null)?.room;
  if (!(room instanceof Room)) return [];
  group.updateMatrixWorld(true);
  const origin = group.getWorldPosition(new THREE.Vector3());
  const out: { x: number; z: number; yaw: number }[] = [];
  for (const p of room.placed) {
    if (!p.asset.seat) continue;
    const seat = room.seatOf(p);
    if (seat) out.push({ x: seat.at.x - origin.x, z: seat.at.z - origin.z, yaw: seat.turn });
  }
  return out;
}

/** The room as a `RoomView`: the world room's group, its walls that lower, and the tick functions it registered. */
export function viewOf(
  id: string,
  map: GameMap,
  room: WorldRoom,
  ticks: ((t: number) => void)[],
  parts: SkinParts,
  view = Math.max(7, Math.min(12, Math.max(map.width * 0.5, map.height * 0.75))),
): RoomView & { parts: SkinParts; room: WorldRoom } {
  const W = map.width;
  const D = map.height;
  const group = new THREE.Group();
  group.add(room.group);
  // The pulsing ring on every exit's threshold while you are near it.
  const markers = new ExitMarkers(map, (tx, ty) => [tx - map.x0 + 0.5, ty - map.y0 + 0.5]);
  group.add(markers.group);
  let yaws: ReturnType<typeof seatYaws> | null = null;
  // The static batching of the renderer's stage does the merging; the room's own flag would batch twice.
  room.group.userData.bake = false;
  return {
    id,
    group,
    room,
    parts,
    keepers: parts.keepers,
    shop: parts.shop,
    lights: parts.lights ?? (parts.dim ? (scene, hemi, sun) => dimBasement(scene, hemi, sun) : undefined),
    outdoors: false,
    bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D, height: WALL_H },
    view,
    toWorld: (tx, ty) => [tx - map.x0 + 0.5, ty - map.y0 + 0.5],
    toTile: (x, z) => [Math.floor(x) + map.x0, Math.floor(z) + map.y0],
    seatY: (_x, _y, kind) => SEAT_Y[kind] ?? 0.33,
    seatYaw(tx, ty) {
      yaws ??= seatYaws(group, parts.extra);
      const x = tx - map.x0 + 0.5;
      const z = ty - map.y0 + 0.5;
      let best: number | null = null;
      let bestD = 0.6;
      for (const s of yaws) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bestD) {
          bestD = d;
          best = s.yaw;
        }
      }
      return best;
    },
    tick(t, _dt, toward) {
      for (const f of ticks) f(t);
      parts.live?.(t);
      room.facing(toward);
    },
    frame(f) {
      markers.update(f.me, f.t);
      parts.frame?.(f);
    },
    onToss: parts.onToss,
    signs: () => [],
    night: (on) => setPropsNight(on),
    dispose() {
      parts.end?.();
      parts.free?.();
      markers.dispose();
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

/** A world room from `skin` (or tile by tile when null), with the ticks its builders registered. */
export function worldRoom(mapId: MapId, map: GameMap, skin: () => RoomSkin | null) {
  const scope = beginTickScope();
  beginLanScope();
  const built = withTicks(() => new WorldRoom(mapId, map, skin()));
  const free = endLanScope();
  endTickScope(scope, built.value.group);
  return { ...built, free };
}

/** A room with a skin of its own (`world-rooms.ts`), or drawn tile by tile when it has none. */
function buildSkinned(id: RoomId, ctx: RoomCtx): RoomView {
  const mapId = kindOf(id) as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  const extra = built.value.skin?.extra ?? null;
  const live =
    mapId === "inn"
      ? liveTavern(extra as TavernRoom)
      : mapId === "basement"
        ? liveBasement(extra as BasementScene)
        : undefined;
  const inn = mapId === "inn" ? new TavernEvents(extra as TavernRoom) : null;
  const poker = mapId === "basement" ? new PokerEvents((extra as BasementScene).poker) : null;
  const roulette = mapId === "basement" ? new RouletteEvents((extra as BasementScene).roulette) : null;
  const basement = poker && roulette ? { poker, roulette } : null;
  return viewOf(id, ctx.map, built.value, built.ticks, {
    extra,
    keepers: mapId === "inn" ? new Set([BARKEEP_BOT]) : new Set(),
    live,
    dim: mapId === "basement",
    frame: inn
      ? (f) => inn.update(f)
      : basement
        ? (f) => {
            basement.poker.update(f);
            basement.roulette.update(f);
          }
        : undefined,
    lights: inn ? (_scene, hemi, sun) => inn.lights(hemi, sun) : undefined,
    onToss: inn ? () => inn.toss() : undefined,
    end: inn
      ? () => inn.dispose()
      : basement
        ? () => {
            basement.poker.dispose();
            basement.roulette.dispose();
          }
        : undefined,
    free: built.free,
  });
}

/** A shop: its hand-built interior, with the shopkeeper the room draws itself. */
function buildShop(id: RoomId, ctx: RoomCtx): RoomView {
  const shop = shopOfRoom(id)!;
  forgetShopRoom(shop);
  const mapId = SHOP_ROOM[shop] as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  dropSceneLabels(shopRoom(shop).shopkeeper.root);
  const botId = SHOPKEEPER_BOT[shop];
  // Torvehallen's shelves and cases show what players have on display (`hud.market`), drawn by its live layer.
  const market = shop === "market" ? (shopRoom(shop).extra as { slots: MarketSlots }).slots : null;
  return viewOf(
    id,
    ctx.map,
    built.value,
    built.ticks,
    {
      extra: shopRoom(shop),
      shop: shopRoom(shop),
      keepers: new Set([botId]),
      frame: market ? (f) => market.update(f) : undefined,
      end: market ? () => market.dispose() : undefined,
      free: () => {
        built.free();
        forgetShopRoom(shop);
      },
    },
    SHOP_VIEW[shop] ?? 8.5,
  );
}

/**
 * A shop's builder names its shopkeeper and has them talk with a plate and a bubble of its own (painted quads on the
 * keeper). The people layer does both, the same as for everyone else, so the builder's go.
 */
function dropSceneLabels(keeper: THREE.Object3D): void {
  for (const o of [...keeper.children]) {
    const map =
      o instanceof THREE.Sprite || o instanceof THREE.Mesh
        ? (o.material as THREE.MeshBasicMaterial).map
        : null;
    if (map instanceof THREE.CanvasTexture) o.removeFromParent();
  }
}

/** The core bot behind each shop's counter. */
export const SHOPKEEPER_BOT: Record<(typeof SHOP_IDS)[number], number> = {
  furniture: -5,
  clothes: -6,
  barber: -7,
  pets: -8,
  natmarked: -9,
  market: -10,
};
const SHOP_VIEW: Partial<Record<(typeof SHOP_IDS)[number], number>> = {
  furniture: 11,
  clothes: 8.5,
  barber: 8,
  pets: 8.5,
  natmarked: 9,
  market: 10.5,
};

/** The company house, with its dropped furniture and posters and the company's desk fleet and colours. */
function buildHouse(id: RoomId, ctx: RoomCtx): RoomView {
  const co = ctx.companies.find((c) => c.id === companyOfRoom(id));
  const scope = beginTickScope();
  const passage = housePassage(ctx.map);
  const built = withTicks(() =>
    buildHq({
      fleet: co?.deskFleet ?? 0,
      placed: placedIn(ctx.map),
      gap: passage ? [passage[0], PASSAGE_W] : undefined,
    }),
  );
  const hq = built.value;
  endTickScope(scope, hq.room.group);
  // The stairs up to the common room, in the south wall (`u`): on the floor tile in front of it.
  for (const [sx, sy] of ctx.map.find("u")) {
    const [rx, rz] = hq.tile(sx, sy);
    const m = exitStairs("up", { wall: "#efe4cf", plate: "LOUNGE", layout: "side" });
    m.position.set(rx + 0.5, 0, rz - 0.5);
    m.rotation.y = Math.PI;
    hq.room.group.add(m);
    // Its doorway is in the south wall, which goes down when the camera looks over it: it goes down with it.
    const door = m.children.find((c) => c.userData.doorway);
    if (door) hq.room.attachToWall([0, -1], door);
  }
  // The office directory (`ς`) stands on its floor tile, facing south.
  for (const [bx, by] of ctx.map.find("ς")) {
    const [rx, rz] = hq.tile(bx, by);
    const m = directoryBoard();
    m.position.set(rx + 0.5, 0, rz + 0.5);
    hq.room.group.add(m);
  }
  // The house's floor keeps its tiles as the hallways grow above it (negative y, `hqMap`): the picture is placed by
  // the map's origin (`hq-layout.ts`), and the hallways with their office doors are drawn over it. The map is the
  // live one (`world.map`); the stage builds the room again when it changes (a door added), as its key is the map.
  const offset = houseOffset(ctx.map);
  const halls = buildHallways(ctx.map, hq);
  hq.room.group.add(halls.group);
  const skin: RoomSkin = {
    group: hq.room.group,
    offset,
    facing: (v) => {
      hq.room.facing(v);
      halls.facing(v);
    },
    extra: hq,
  };
  const room = new WorldRoom("hq", ctx.map, skin);
  const desks = new DeskSetups(ctx.map, hq.room.placed, [1, 2]);
  return viewOf(id, ctx.map, room, built.ticks, {
    extra: hq,
    keepers: new Set(),
    frame: (f) => {
      halls.player(f.me ? [f.me[0] - offset[0], f.me[1] - offset[1]] : null);
      desks.update(f.now);
    },
  });
}

/** The plank floor of the hallways, one slab per run of corridor tiles, its planks laid on the house floor's grid. */
function floorSlab(x: number, z: number, w: number, d: number, plank: THREE.Material): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (x + pos.getX(i) + w / 2) / 4, -(z + pos.getZ(i) + d / 2) / 4);
  const mesh = new THREE.Mesh(g, plank);
  mesh.position.set(x + w / 2, 0, z + d / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The hallways of office doors above the house's floor (`hqMap`: four rows per six offices, a wall of doors three
 * tiles apart over a corridor two tiles deep, joined to the floor by a two-wide passage through the north wall).
 * Drawn tile by tile in the room's own coordinates: wall blocks, the house's plank floor, the dungeon slice's office
 * door on every `R` (flush with the wall under a header, a mat in front, a lamp on the wall between two doors), and an
 * opening in the floor's north wall with a lintel and a runner where the passage meets each hallway. The walls
 * between you and the camera go down to a skirting while you are up there (`facing`, `player`), like the room's own.
 * The owner's name is a near label (`signs.ts`), so it shows when you are close.
 */
function buildHallways(map: GameMap, hq: Hq) {
  const group = new THREE.Group();
  const WALL = "#efe4cf";
  const CAP = "#5b4a44";
  const rows = new Map<number, { model: Model; z: number }>();
  const rowOf = (y: number) => {
    let r = rows.get(y);
    if (!r) {
      const model = new Model();
      model.userData.rigid = true;
      group.add(model);
      r = { model, z: hq.tile(0, y)[1] };
      rows.set(y, r);
    }
    return r;
  };
  const door = DUNGEON_ASSETS.find((a) => a.id === "tile:R");
  const tiles = hallwayTiles(map);
  const floors = new Map<number, number[]>();
  const fixtures = new Model();
  group.add(fixtures);
  for (const t of tiles) {
    const at: [number, number, number] = [t.rx + 0.5, 0, t.rz + 0.5];
    if (t.kind === "wall") {
      const row = rowOf(t.y).model;
      // The floor's own top wall row: the room draws its face and skirting there. The block stops behind them, or the
      // two faces share a plane and flicker in turn.
      const behind = t.rz === -1 ? WALL_T + 0.01 : 0;
      row.box([1, WALL_H, 1 - behind], WALL, [at[0], 0, at[2] - behind / 2], 0);
      row.box([1.02, 0.1, 1.02 - behind], CAP, [at[0], WALL_H, at[2] - behind / 2], 0.01);
      // A skirting on the face that has a corridor in front of it.
      if (!behind && map.walkable(t.x, t.y + 1))
        row.box([1.02, 0.16, 0.06], CAP, [at[0], 0, at[2] + 0.5], 0.008);
    } else if (t.kind === "door") {
      const row = rowOf(t.y).model;
      // A header over the door and the door at the wall's face, not sunk into a niche.
      row.box([1, WALL_H - 2.0, 1], WALL, [at[0], 2.0, at[2]], 0);
      row.box([1.02, 0.1, 1.02], CAP, [at[0], WALL_H, at[2]], 0.01);
      const m = door?.build();
      if (m) {
        m.position.set(at[0], 0, at[2] + 0.4);
        row.add(m);
      }
      // A brass plaque by the door (the name is the near label over it), and the mat to stand on.
      row.box([0.34, 0.14, 0.03], "#f5c842", [at[0], 2.2, at[2] + 0.52], 0.004);
      const d = world.doors.find((q) => q.x === t.x && q.y === t.y);
      const mine = d?.userId === world.selfId;
      fixtures.box([0.84, 0.025, 0.56], mine ? C.rug : C.rugLight, [at[0], 0, at[2] + 1.05], 0.006);
      fixtures.box([0.7, 0.03, 0.42], mine ? C.rugLight : C.rug, [at[0], 0, at[2] + 1.05], 0.006);
    } else {
      const run = floors.get(t.rz) ?? [];
      run.push(t.rx);
      floors.set(t.rz, run);
    }
  }
  // Wall lamps on the wall between two doors: the glow is the lamp, the pool on the floor in front of it.
  const lit = new Set<number>();
  for (const t of tiles)
    if (t.kind === "door" && map.at(t.x + 2, t.y) === "W" && map.at(t.x + 3, t.y) === "R") lit.add(t.rx);
  for (const t of tiles)
    if (t.kind === "door" && lit.has(t.rx)) {
      const lx = t.rx + 2;
      const lz = t.rz + 0.5;
      fixtures.box([0.1, 0.34, 0.12], C.metal, [lx, 1.9, lz + 0.56], 0.01);
      fixtures.box([0.06, 0.2, 0.06], glow("#ffe9b0"), [lx, 1.97, lz + 0.62], 0.004);
    }
  // The plank floor: a slab per run of corridor tiles in a row.
  const plank = painted(planks("#c9a574", 4));
  for (const [z, xs] of floors) {
    xs.sort((a, b) => a - b);
    let i = 0;
    while (i < xs.length) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j++;
      const w = xs[j]! - xs[i]! + 1;
      group.add(floorSlab(xs[i]!, z, w, 1, plank));
      i = j + 1;
    }
  }
  const passage = housePassage(map);
  if (passage) {
    const [px] = passage;
    // The opening in the floor's north wall: jambs, a lintel with its plate and a lamp, a runner through it.
    const open = new Model();
    open.userData.rigid = true;
    const w = PASSAGE_W;
    for (const x of [px, px + w]) open.box([0.16, 2.3, 0.34], C.woodDark, [x, 0, 0], 0.015);
    open.box([w + 0.16, 0.12, 0.34], C.woodDark, [px + w / 2, 2.3, 0], 0.015);
    open.box([w + 0.16, WALL_H - 2.42, 0.2], WALL, [px + w / 2, 2.42, 0], 0);
    exitPlate(open, "UP", "up", [px + w / 2, 2.12, 0.19]);
    open.box([0.34, 0.08, 0.2], C.metal, [px + w / 2 - 0.55, 2.2, 0.28], 0.01);
    open.box([0.26, 0.05, 0.14], glow("#ffe9b0"), [px + w / 2 - 0.55, 2.15, 0.28], 0.004);
    open.box([0.34, 0.08, 0.2], C.metal, [px + w / 2 + 0.55, 2.2, 0.28], 0.01);
    open.box([0.26, 0.05, 0.14], glow("#ffe9b0"), [px + w / 2 + 0.55, 2.15, 0.28], 0.004);
    group.add(open);
    // A runner from the floor up the passage, carried across every hallway it comes out in as a landing.
    for (const t of tiles) {
      if (t.kind !== "floor" || t.rx !== px) continue;
      fixtures.box([w - 0.2, 0.025, 0.8], C.rugLight, [px + w / 2, 0, t.rz + 0.5], 0.006);
      fixtures.box([w - 0.34, 0.03, 0.68], C.rug, [px + w / 2, 0, t.rz + 0.5], 0.006);
    }
  }
  let me: [number, number] | null = null;
  return {
    group,
    player(at: [number, number] | null) {
      me = at;
    },
    /** `view` points from the room to the camera: rows between the player and the camera go down. */
    facing(view: THREE.Vector3) {
      const pz = me?.[1] ?? null;
      const south = view.z > 0.01;
      hq.room.cutaway([0, 1], south && pz !== null && pz < 0);
      for (const r of rows.values()) {
        const between = pz !== null && Math.abs(view.z) > 0.01 && (r.z + 0.5 - pz) * view.z > 0;
        const target = between ? 0.06 : 1;
        r.model.scale.y += (target - r.model.scale.y) * wallEase.k;
        r.model.visible = r.model.scale.y > 0.02;
      }
    },
  };
}

registerRoom("inn", buildSkinned);
registerRoom("upstairs", buildSkinned);
registerRoom("basement", buildSkinned);
registerRoom("dungeon", buildSkinned);
registerRoom("hq", buildHouse);
for (const shop of SHOP_IDS) registerRoom(SHOP_ROOM[shop], buildShop);
