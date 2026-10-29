import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import type { RoomId } from "@tokenmaxxing/core/world.ts";
import { geometryDetail } from "../kit/kit.ts";
import { viewOf, worldRoom } from "../rooms/room-skin.ts";
import { type RoomCtx, type RoomView, registerRoom, withTicks } from "../rooms/rooms.ts";
import { DungeonLive } from "./dungeon-live.ts";
import { CAPS } from "./raidfx.ts";

/**
 * The raid dungeon: a stone room built from the core map tile by tile (dais, torches, war desks and seats), and
 * over it the live raid (`dungeon-live.ts`): the boss, the raiders at their desks, the missiles, the loot. The torches
 * move to the wall they hang on; Medium thins the crowd (`CAPS.lean`).
 */
function buildDungeon(id: RoomId, ctx: RoomCtx): RoomView {
  const map: GameMap = ctx.map;
  const caps = geometryDetail() === 0 ? CAPS.lean : CAPS.full;
  const built = worldRoom("dungeon", map, () => null);
  const room = built.value;
  // The torches' brackets stand against the wall: the back row's tile is a half-tile in front of it.
  for (const m of room.drawn.get("j") ?? []) m.position.z -= 0.5;
  const made = withTicks(() => new DungeonLive(map, caps));
  const live = made.value;
  room.group.add(live.group);
  let t = 0;
  // The dungeon is wide: its own framing (9), closer than the generic room's, so the bosses and clones read.
  const view = viewOf(
    id,
    map,
    room,
    [...built.ticks, ...made.ticks],
    {
      extra: live,
      keepers: new Set(),
      free: built.free,
      live: (now) => {
        t = now;
        live.update(t);
      },
    },
    9,
  );
  const dispose = view.dispose;
  return Object.assign(view, {
    liveSigns: () => live.signs(),
    dispose() {
      live.dispose();
      dispose();
    },
  });
}

registerRoom("dungeon", buildDungeon);
