import { expect, test } from "bun:test";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

test("taking a person's rig away takes their pet with it: no ghost pet is left standing in the room", async () => {
  installHeadlessGlobals();
  // The renderer imports the network layer, which builds its client from the page's origin.
  Object.assign((globalThis as unknown as { location: object }).location, { origin: "http://localhost:1" });
  const { Entities } = await import("../src/render3d/people/entities.ts");
  const entities = new Entities({} as never);
  const person = new THREE.Group();
  const petRoot = new THREE.Group();
  petRoot.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  entities.group.add(person, petRoot);
  const rig = {
    id: 7,
    root: person,
    stack: { remove() {} },
    petLabel: null,
    burst: null,
    pet: { root: petRoot },
  };
  const internals = entities as unknown as { rigs: Map<number, unknown>; remove(r: unknown): void };
  internals.rigs.set(7, rig);

  internals.remove(rig);

  expect(entities.group.children).toEqual([]);
  expect(entities.size).toBe(0);
  expect(rig.pet).toBeNull();
});
