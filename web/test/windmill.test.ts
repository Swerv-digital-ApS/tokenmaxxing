import { expect, test } from "bun:test";
import { CALM, presetWeather } from "@tokenmaxxing/core/sky.ts";
import { SAILS, WINDMILL } from "@tokenmaxxing/core/windmill.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
const { buildTown3d } = await import("../src/render3d/town/town3d.ts");
const { withTicks } = await import("../src/render3d/rooms/rooms.ts");
const { hubOffset } = await import("../src/art/windmill.ts");

const storm = presetWeather("storm")!;
const rotorOf = (mill: THREE.Object3D) => {
  let rotor: THREE.Object3D | undefined;
  mill.traverse((o) => {
    if (o.userData.rigid && o.parent?.userData.rigid) rotor = o;
  });
  return rotor!;
};

test("the 3D town has the map's windmill, in the middle of its 2×2 tiles", () => {
  const town = buildTown3d([], { arcade: false });
  const [corner] = town.map.find(WINDMILL);
  expect([...town.windmills.keys()]).toEqual([`${corner![0]},${corner![1]}`]);
  const mill = town.windmills.get(`${corner![0]},${corner![1]}`)!;
  const [x, z] = town.toWorld(corner![0], corner![1]);
  expect(mill.position.x).toBeCloseTo(x + 0.5, 5);
  expect(mill.position.z).toBeCloseTo(z + 0.5, 5);
});

test("its sails stand still in calm air and spin with the game's wind once it is set", () => {
  const built = withTicks(() => buildTown3d([], { arcade: false }));
  const town = built.value;
  const rotor = rotorOf([...town.windmills.values()][0]!);
  const run = (from: number) => {
    for (let i = 0; i <= 10; i++) for (const f of built.ticks) f(from + i * 0.05);
  };
  // Until the game's weather is set it's calm: the sails don't move.
  run(0);
  expect(rotor.rotation.z).toBe(0);
  town.setWeather(() => storm);
  run(1);
  expect(rotor.rotation.z).toBeGreaterThan(0);
  // A storm turns them at the cap: half a second is about a third of a turn, not more.
  expect(rotor.rotation.z).toBeLessThanOrEqual(SAILS.maxRps * 0.5 * Math.PI * 2 + 1e-6);
});

test("the sails face where the wind comes from, the same way round in 3D as in 2D", () => {
  const front = new THREE.Vector3();
  for (const windDir of [0, 45, 90, 180, 250, 270]) {
    // A mill seeing its first wind faces straight into it.
    const mill = buildTown3d([], { arcade: false }).windmills.values().next().value!;
    mill.update(0, { windMs: CALM.windMs, windDir });
    mill.updateMatrixWorld(true);
    rotorOf(mill).getWorldDirection(front);
    const a = (windDir * Math.PI) / 180;
    // North is -z, east +x.
    expect(front.x).toBeCloseTo(Math.sin(a), 5);
    expect(front.z).toBeCloseTo(-Math.cos(a), 5);
    // 2D: the windshaft points the same way on screen (east is right, south is down).
    const [hx, hy] = hubOffset(windDir);
    if (Math.abs(front.x) > 0.2) expect(Math.sign(hx)).toBe(Math.sign(front.x));
    else expect(Math.abs(hx)).toBeLessThanOrEqual(2);
    if (Math.abs(front.z) > 0.2) expect(Math.sign(hy)).toBe(Math.sign(front.z));
    else expect(Math.abs(hy)).toBeLessThanOrEqual(1);
  }
});
