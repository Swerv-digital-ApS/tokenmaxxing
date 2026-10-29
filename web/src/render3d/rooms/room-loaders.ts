import { registerRoomPrep } from "./rooms.ts";
import type { MapId } from "./world.ts";

/**
 * The hand-built rooms are separate code, fetched when somebody is about to walk in (`prepareRoom`, `preloadRoom`),
 * so the first frame needs the town and nothing else. A prep imports the room's builder module (which registers
 * itself), then the skin's code and tile art for that map (`world.load`'s own steps).
 */
const prep = (kind: string, module: () => Promise<unknown>, map: MapId = kind as MapId): void =>
  registerRoomPrep(kind, async () => {
    await module();
    const [{ loadRoomCode }, { loadSlices }] = await Promise.all([
      import("./world.ts"),
      import("../kit/registry.ts"),
    ]);
    await loadRoomCode(map);
    await loadSlices([map]);
  });

const skinned = () => import("./room-skin.ts");
for (const k of [
  "inn",
  "upstairs",
  "basement",
  "hq",
  "shop-furniture",
  "shop-clothes",
  "shop-barber",
  "shop-pets",
  "shop-natmarked",
  "shop-market",
])
  prep(k, skinned);
prep("dungeon", () => import("../dungeon/room-dungeon.ts"));
for (const k of ["office", "common"]) prep(k, () => import("./room-furnished.ts"), "office");
prep("town", async () => {});
