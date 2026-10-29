import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import * as THREE from "three";

/**
 * The floor marker of every exit in a room: a warm ring on the threshold (the walkable tile a door or stairs is
 * taken from) that pulses while you are within a few tiles of it, so a way out is never missed. One ring
 * geometry and one material for all of them (the pulse is the material's opacity and each ring's scale: a
 * uniform and a matrix, no allocation), kept out of the static batching (`userData.live`).
 */

/** How near (tiles) you must be for a marker to show. */
export const MARKER_REACH = 3.2;

let ringGeometry: THREE.RingGeometry | null = null;
let ringMaterial: THREE.MeshBasicMaterial | null = null;
function shared(): { geometry: THREE.RingGeometry; material: THREE.MeshBasicMaterial } {
  ringGeometry ??= new THREE.RingGeometry(0.3, 0.46, 24);
  ringMaterial ??= new THREE.MeshBasicMaterial({
    color: "#ffd35c",
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return { geometry: ringGeometry, material: ringMaterial };
}

/**
 * The walkable tile an exit at (x, y) is taken from: the one straight on to it (a wall behind the exit on the
 * far side: the foot of a flight, the mat of a door), else any walkable neighbour.
 */
export function thresholdOf(map: GameMap, x: number, y: number): [number, number] {
  const sides = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const [dx, dy] of sides)
    if (map.walkable(x + dx, y + dy) && map.at(x - dx, y - dy) === "W") return [x + dx, y + dy];
  for (const [dx, dy] of sides) if (map.walkable(x + dx, y + dy)) return [x + dx, y + dy];
  return [x, y];
}

/** Every portal tile of a map, with its threshold. */
export function exitsOf(map: GameMap): { ch: string; x: number; y: number; at: [number, number] }[] {
  const out: { ch: string; x: number; y: number; at: [number, number] }[] = [];
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const x = rx + map.x0;
      const y = ry + map.y0;
      if (map.kind(x, y).portal) out.push({ ch: row[rx]!, x, y, at: thresholdOf(map, x, y) });
    }
  });
  return out;
}

export class ExitMarkers {
  readonly group = new THREE.Group();
  private readonly rings: { mesh: THREE.Mesh; x: number; z: number }[] = [];

  constructor(map: GameMap, toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "exit-markers";
    this.group.userData.live = true;
    const { geometry, material } = shared();
    for (const e of exitsOf(map)) {
      const [x, z] = toWorld(e.at[0], e.at[1]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.03, z);
      mesh.visible = false;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.rings.push({ mesh, x, z });
    }
  }

  get count(): number {
    return this.rings.length;
  }

  /** Once a frame: `me` is where the player stands (world x, z), `t` the clock in seconds. */
  update(me: [number, number] | null, t: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    shared().material.opacity = 0.28 + 0.3 * pulse;
    const scale = 1 + 0.1 * pulse;
    for (const r of this.rings) {
      const near = me !== null && Math.hypot(r.x - me[0], r.z - me[1]) <= MARKER_REACH;
      r.mesh.visible = near;
      if (near) r.mesh.scale.setScalar(scale);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.rings.length = 0;
  }
}
