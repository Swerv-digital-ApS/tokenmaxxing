import { expect, test } from "bun:test";
import { ticks } from "../src/render3d/kit/kit.ts";
import {
  buildRoom,
  type RoomCtx,
  type RoomView,
  registerFallbackRoom,
  registerRoom,
  withTicks,
} from "../src/render3d/rooms/rooms.ts";

const stub = (id: string): RoomView => ({
  id,
  group: undefined as never,
  outdoors: false,
  bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1, height: 1 },
  view: 1,
  toWorld: (x, y) => [x, y],
  toTile: (x, z) => [x, z],
  seatY: () => 0,
  tick() {},
  signs: () => [],
  dispose() {},
});
const ctx = {} as RoomCtx;

test("a room's own builder is used, an office's id included, else the generic one", () => {
  registerFallbackRoom((id) => stub(`generic:${id}`));
  registerRoom("inn", (id) => stub(`inn-view:${id}`));
  registerRoom("office", (id) => stub(`office-view:${id}`));
  expect(buildRoom("inn", ctx).id).toBe("inn-view:inn");
  expect(buildRoom("office:12", ctx).id).toBe("office-view:office:12");
  expect(buildRoom("dungeon", ctx).id).toBe("generic:dungeon");
  // An exact id beats the kind before the colon.
  registerRoom("office:12", (id) => stub(`mine:${id}`));
  expect(buildRoom("office:12", ctx).id).toBe("mine:office:12");
  expect(buildRoom("office:13", ctx).id).toBe("office-view:office:13");
});

test("a room's animation callbacks leave the kit's global list with it", () => {
  const before = ticks.length;
  const a = () => {};
  const b = () => {};
  const made = withTicks(() => {
    ticks.push(a, b);
    return 7;
  });
  expect(made.value).toBe(7);
  expect(made.ticks).toEqual([a, b]);
  expect(ticks.length).toBe(before);
});
