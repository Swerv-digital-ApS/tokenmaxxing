/**
 * The windmill by the Tavern in 3D (2D: `art/windmill.ts`, `game/windmill.ts`): a Danish gallery mill, with a brick
 * base, a wooden gallery, a white-washed octagonal tower, and a cap with a fantail at the back. The cap turns the
 * sails into the wind and the sails turn as fast as it blows, both from `turnMill` (`core/src/windmill.ts`) and the
 * game's weather. Cap and sails are rigid: each batches on its own and moves as one, a draw call per colour, so they
 * keep to a few colours.
 */

import type { Weather } from "@tokenmaxxing/core/sky.ts";
import { type Mill, newMill, turnMill } from "@tokenmaxxing/core/windmill.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { Model, toon } from "../kit/kit.ts";

const BRICK = "#b0503f";
const OCTAGON = Math.PI / 8;
/** Where the tower ends and the cap sits. */
const TOP = 3.93;

export interface Windmill extends Model {
  /** Moves the sails and cap on by `dt` seconds of the weather's wind. */
  update: (dt: number, wind: Pick<Weather, "windMs" | "windDir">) => void;
}

/** One sail, along +y from the hub: the stock, and the lattice frame and cloth on its trailing side (+x). */
function sail(rotor: Model, turn: number): void {
  const s = rotor.part();
  s.rotation.z = turn;
  s.box([0.07, 2.25, 0.07], C.woodDark, [0, 0.05, 0], 0.01);
  s.box([0.4, 1.65, 0.02], C.white, [0.25, 0.6, -0.03], 0);
  for (const x of [0.05, 0.45]) s.box([0.035, 1.65, 0.04], C.woodDark, [x, 0.6, 0], 0);
  for (let k = 0; k < 6; k++) s.box([0.44, 0.03, 0.04], C.woodDark, [0.25, 0.6 + k * 0.32, 0], 0);
}

/**
 * Moves where each of `rigid`'s meshes sits into its geometry, so they all sit at its middle. The batching groups a
 * rigid part's meshes by where they sit (`bake.ts`), and sails round their hub would be four batches instead of one.
 * A part rigid of its own inside it is left alone.
 */
function oneBatch(rigid: THREE.Object3D): void {
  rigid.updateMatrixWorld(true);
  const into = rigid.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  rigid.traverse((o) => {
    let own = true;
    for (let p = o.parent; p && p !== rigid; p = p.parent) own &&= !p.userData.rigid;
    if ((o as THREE.Mesh).isMesh && own && !o.userData.rigid) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    const local = into.clone().multiply(mesh.matrixWorld);
    // A plain copy: the Voxel style would rebuild a primitive from its parameters, in the wrong place.
    mesh.geometry = new THREE.BufferGeometry().copy(mesh.geometry).applyMatrix4(local);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    rigid.add(mesh);
  }
}

/** A windmill standing on 2×2 tiles round its middle; its sails face +z until the wind says otherwise. */
export function windmill(): Windmill {
  const m = new Model() as Windmill;
  // The brick base on a stone plinth, a door in front.
  m.cyl(1.08, 0.12, C.stone, [0, 0, 0], 1.06, 8).rotation.y = OCTAGON;
  m.cyl(1.0, 1.3, BRICK, [0, 0.1, 0], 0.95, 8).rotation.y = OCTAGON;
  m.box([0.46, 0.78, 0.06], C.ink, [0, 0.12, 0.9], 0.01);
  m.box([0.38, 0.72, 0.06], C.woodDark, [0, 0.12, 0.92], 0.01);
  // The gallery, its posts and rails round the tower.
  m.cyl(1.38, 0.08, C.wood, [0, 1.36, 0], 1.38, 8).rotation.y = OCTAGON;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + OCTAGON;
    const mid = a + OCTAGON;
    m.box([0.05, 0.42, 0.05], C.woodDark, [Math.cos(a) * 1.3, 1.44, Math.sin(a) * 1.3], 0);
    const rail = m.box([0.98, 0.05, 0.04], C.woodDark, [Math.cos(mid) * 1.2, 1.82, Math.sin(mid) * 1.2], 0);
    rail.rotation.y = -mid - Math.PI / 2;
  }
  // The tower, tapering, and a window over the gallery.
  m.cyl(0.85, TOP - 1.44, C.wall, [0, 1.44, 0], 0.56, 8).rotation.y = OCTAGON;
  const window = m.box([0.2, 0.3, 0.05], C.ink, [0, 2.45, 0.68], 0.01);
  window.rotation.x = -0.12;
  m.cyl(0.6, 0.08, C.woodDark, [0, TOP - 0.06, 0], 0.6, 8).rotation.y = OCTAGON;

  // The cap: a hood that turns on the tower's top, the windshaft out of its front, the fantail on its back.
  const cap = m.part([0, TOP, 0]);
  cap.userData.rigid = true;
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    toon(C.wallTop),
  );
  hood.scale.set(1, 0.95, 1.3);
  hood.position.y = 0.04;
  hood.castShadow = hood.receiveShadow = true;
  cap.add(hood);
  cap.cyl(0.64, 0.08, C.woodDark, [0, 0, 0], 0.64, 14);
  cap.cyl(0.07, 0.7, C.woodDark, [0, 0.36, 0.42], 0.07, 8).rotation.x = Math.PI / 2;
  for (const x of [-0.14, 0.14]) {
    // From low on the hood's back up to the fantail's hub.
    const strut = cap.box([0.04, 0.04, 0.9], C.woodDark, [x, 0.3, -0.7], 0);
    strut.rotation.x = 0.5;
  }
  const fan = cap.part([0, 0.55, -1.08]);
  fan.ball(0.06, C.woodDark);
  for (let k = 0; k < 6; k++)
    fan.box([0.02, 0.3, 0.12], C.white, [0, 0, 0], 0).rotation.x = (k * Math.PI) / 3;

  // The sails, turning on the windshaft's end.
  const rotor = cap.part([0, 0.36, 1.14]);
  rotor.userData.rigid = true;
  rotor.ball(0.13, C.woodDark);
  for (let i = 0; i < 4; i++) sail(rotor, (i * Math.PI) / 2);
  oneBatch(rotor);
  oneBatch(cap);

  let state: Mill | null = null;
  m.update = (dt, wind) => {
    state = state ? turnMill(state, wind, dt) : newMill(wind);
    // Compass degrees to a turn about y: north is -z, east +x, and the sails start facing +z (south).
    cap.rotation.y = Math.PI - (state.facing * Math.PI) / 180;
    rotor.rotation.z = state.turn * Math.PI * 2;
  };
  return m;
}
