/**
 * The slices' hand-built rooms, as skins on the world's tile maps (`registerRoomSkin`): the data-driven
 * town (`town3d.ts`), the company house (`hq3d.ts`), the Tavern and the dorm above it (`tavern3d.ts`) and the
 * basement net cafe (`basement3d.ts`). The map still decides where you can walk and which tiles are doors;
 * each skin only draws the room, with its own wall rows trimmed, so it sits `[1, 2]` tiles in (the two wall
 * rows on top, one column at the left). The office is a `Room` with the trophy shelf and the pet bed; the dungeon
 * has no skin and is drawn tile by tile from the registered assets (`registry.ts`).
 *
 * Each room's code is its own dynamic import, fetched when someone is about to walk in (`world.load(id)`,
 * `world.preload(id)`), so the first frame needs the town and nothing else. `loadRoomSkins()` fetches them all (the tests
 * and the budget check build every room).
 */

import { GameMap, MAPS, type MapId } from "../data/maps.ts";
import type { Asset } from "../furniture/furniture.ts";
import type { Model } from "../kit/kit.ts";
import type { TileBuilder } from "./world.ts";
import { loadRoomCode, registerRoomLoader, registerRoomSkin, registerTile } from "./world.ts";

export const INSET: [number, number] = [1, 2];

/** Registers the skins of a set of rooms once their code is in. */
const room = (ids: readonly MapId[], load: () => Promise<void>): void => {
  for (const id of ids) registerRoomLoader(id, () => load());
};

room(["town"], async () => {
  const { buildTown3d, MARGIN, SAMPLE_COMPANIES } = await import("../town/town3d.ts");
  registerRoomSkin("town", () => {
    const town = buildTown3d(SAMPLE_COMPANIES);
    // The town's tiles (with the arcade's door written in), as the world's map; the picture has MARGIN of grass round it.
    const map = new GameMap("town", "Town", town.map.rows, town.map.x0, town.map.y0);
    return { group: town.group, offset: [-MARGIN, -MARGIN], map, extra: town };
  });
});

room(["hq"], async () => {
  const [{ buildHq }, { DUNGEON_ASSETS }] = await Promise.all([
    import("./hq3d.ts"),
    import("../dungeon/dungeon3d.ts"),
  ]);
  registerRoomSkin("hq", () => {
    const hq = buildHq();
    // The hallway of office doors on the north wall, drawn as the registered `R` tile.
    const door = tileModel(DUNGEON_ASSETS, "R");
    if (door)
      for (const x of [3, 7]) {
        const m = door();
        if (!m) continue;
        m.position.set(x - INSET[0] + 0.5, 0, 1 - INSET[1] + 0.5);
        hq.room.group.add(m);
      }
    return { group: hq.room.group, offset: INSET, facing: (v) => hq.room.facing(v), extra: hq };
  });
});

room(["inn", "upstairs"], async () => {
  const { buildDormRoom, buildTavernRoom } = await import("./tavern3d.ts");
  registerRoomSkin("inn", () => {
    const inn = buildTavernRoom();
    return { group: inn.room.group, offset: INSET, facing: (v) => inn.room.facing(v), extra: inn };
  });
  registerRoomSkin("upstairs", () => {
    const dorm = buildDormRoom();
    return { group: dorm.room.group, offset: INSET, facing: (v) => dorm.room.facing(v), extra: dorm };
  });
});

// The six shops: the shop's own room, mounted like the Tavern, with the map its blocked tiles make.
room(
  ["shop-furniture", "shop-clothes", "shop-barber", "shop-pets", "shop-natmarked", "shop-market"],
  async () => {
    const { SHOP_IDS, SHOP_ROOM, shopRoom } = await import("../shops/catalog.ts");
    for (const id of SHOP_IDS)
      registerRoomSkin(SHOP_ROOM[id], () => {
        const shop = shopRoom(id);
        return {
          group: shop.room.group,
          offset: INSET,
          facing: (v) => shop.room.facing(v),
          map: shop.map,
          extra: shop,
        };
      });
  },
);

room(["basement"], async () => {
  const { buildBasement } = await import("./basement3d.ts");
  registerRoomSkin("basement", () => {
    const b = buildBasement();
    return { group: b.room.group, offset: INSET, facing: (v) => b.room.facing(v), extra: b };
  });
});

// The office: a `Room` (so the decor slice's wallpapers, floors and sizes apply to it) with the trophy shelf and the pet bed.
room(["office"], async () => {
  const [{ Room }, { DUNGEON_ASSETS }, { PETS_ASSETS }] = await Promise.all([
    import("./room.ts"),
    import("../dungeon/dungeon3d.ts"),
    import("../pets/pets3d.ts"),
  ]);
  registerRoomSkin("office", () => {
    const map = MAPS.office;
    const inset: [number, number] = [1, 1];
    const room = new Room(map.width - 2, map.height - 2, { north: [3, 7], door: null, west: [] });
    const put = (id: string, assets: readonly Asset[], ch: string) => {
      const a = assets.find((q) => q.id === id);
      const at = map.find(ch)[0];
      if (a && at) room.place(a, at[0] - inset[0], at[1] - inset[1], 0);
    };
    put("tile:U", DUNGEON_ASSETS, "U");
    put("tile:Q", PETS_ASSETS, "Q");
    return { group: room.group, offset: inset, facing: (v) => room.facing(v), extra: room };
  });
});

// The dungeon's way out, in the stone wall (the dungeon slice draws it as `dungeon:exit`).
room(["dungeon"], async () => {
  const { DUNGEON_ASSETS } = await import("../dungeon/dungeon3d.ts");
  const exit = DUNGEON_ASSETS.find((a) => a.id === "dungeon:exit");
  if (exit) registerTile("x", exit, { rooms: ["dungeon"] });
});

const ALL: MapId[] = [
  "town",
  "hq",
  "inn",
  "upstairs",
  "shop-furniture",
  "shop-clothes",
  "shop-barber",
  "shop-pets",
  "shop-natmarked",
  "shop-market",
  "basement",
  "office",
  "dungeon",
];

/** Fetches the code of every hand-built room (or of `ids`): for the tests and anything that builds them all. */
export async function loadRoomSkins(ids: readonly MapId[] = ALL): Promise<void> {
  await Promise.all(ids.map((id) => loadRoomCode(id)));
}

/** A drawing function for a tile registered with `assets`, for skins that want to add a door by hand. */
function tileModel(assets: readonly Asset[], ch: string): (() => Model | null) | null {
  const asset: Asset | undefined = assets.find((a) => a.id === `tile:${ch}`);
  if (!asset) return null;
  const build: TileBuilder = () => asset.build();
  return () => build({} as never);
}
