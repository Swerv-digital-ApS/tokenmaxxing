import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import type * as THREE from "three";
import { ExitMarkers, exitsOf, MARKER_REACH, thresholdOf } from "../src/render3d/rooms/exit-markers.ts";

test("an exit's threshold is the walkable tile it is taken from", () => {
  // The Office's door is in the south wall: the threshold is the floor tile above it.
  const [dx, dy] = MAPS.office.find("x")[0]!;
  expect(thresholdOf(MAPS.office, dx, dy)).toEqual([dx, dy - 1]);
  // The Tavern's stairs down stand by the east wall: the tile above them is the way on.
  const [sx, sy] = MAPS.inn.find("S")[0]!;
  expect(MAPS.inn.walkable(...thresholdOf(MAPS.inn, sx, sy))).toBe(true);
  expect(
    exitsOf(MAPS.inn)
      .map((e) => e.ch)
      .sort(),
  ).toEqual(["S", "u", "x"]);
});

test("a marker shows only while the player is within reach, pulsing on one shared material", () => {
  const toWorld = (tx: number, ty: number): [number, number] => [tx + 0.5, ty + 0.5];
  const m = new ExitMarkers(MAPS.office, toWorld);
  expect(m.count).toBe(1);
  expect(m.group.userData.live).toBe(true);
  const ring = m.group.children[0]!;
  const [tx, ty] = exitsOf(MAPS.office)[0]!.at;
  m.update(null, 0);
  expect(ring.visible).toBe(false);
  m.update([tx + 0.5, ty + 0.5 - MARKER_REACH + 0.1], 1);
  expect(ring.visible).toBe(true);
  m.update([tx + 0.5, ty + 0.5 - MARKER_REACH - 0.5], 2);
  expect(ring.visible).toBe(false);
  const other = new ExitMarkers(MAPS.common, toWorld);
  expect((other.group.children[0] as THREE.Mesh).material).toBe((ring as THREE.Mesh).material);
  m.dispose();
  other.dispose();
});
