// bun web/scripts/zfight.ts [room ...] [--blocks] [--max=N] [--json=file]: finds surfaces that z-fight, in every room, built headlessly.
//
// Two triangles z-fight when they face the camera, lie in (nearly) the same plane and overlap: the GPU can't tell which is
// in front, so each pixel picks one or the other, and the picks change with the camera (a flicker as you walk). Seen in
// the game as the striped back wall of the company house (two walls on one plane) and the fountain's water (level with
// the stone it fills). Gap is how far apart the two planes are, in world units along the normal: 0 is a certain fight;
// a few thousandths of a unit can fight too where the depth buffer is coarse (the desktop app's WebKit) or far away.
// Pieces of one mesh next to each other are not reported, nor faces that point down (the camera is always above).
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
(globalThis as { __traceSrc?: boolean }).__traceSrc = true;
// Some views import the net client, which reads where the page is served from.
Object.assign(globalThis.location, {
  origin: "http://localhost",
  href: "http://localhost/",
  protocol: "http:",
  host: "localhost",
});
const { loadAllSlices } = await import("../src/render3d/perf/headless.ts");
await loadAllSlices();

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const rooms = args.filter((a) => !a.startsWith("--"));
const MAX = Number(flag("max") ?? 25);
const GAP = Number(flag("gap") ?? 0.004);
const CELL = 1.5;

interface Tri {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  n: THREE.Vector3;
  area: number;
  mesh: THREE.Mesh;
  /** The facing(s) this triangle is drawn with: +1 its normal, -1 the opposite (a double-sided material has both). */
  sides: number[];
  min: THREE.Vector3;
  max: THREE.Vector3;
}

const label = (o: THREE.Object3D): string => {
  const path: string[] = [];
  for (let p: THREE.Object3D | null = o; p && path.length < 4; p = p.parent) {
    const tags = Object.keys(p.userData).filter((k) => p!.userData[k] === true || k === "actor");
    const n = p.name || (p as THREE.Mesh).geometry?.type?.replace("Geometry", "") || p.type;
    path.push(tags.length ? `${n}{${tags.join(",")}}` : n);
  }
  return path.join("<");
};

const matOf = (m: THREE.Mesh): THREE.Material =>
  (Array.isArray(m.material) ? m.material[0]! : m.material) as THREE.Material;
const describe = (m: THREE.Mesh): string => {
  const mat = matOf(m) as THREE.MeshBasicMaterial;
  const col = mat.color ? `#${mat.color.getHexString()}` : "";
  const t = mat.transparent ? " glass" : "";
  const map = (mat as { map?: unknown }).map ? " tex" : "";
  const src = (m.userData.src as string | undefined) ?? "";
  return `${label(m)} ${mat.type.replace("Material", "")}${col ? ` ${col}` : ""}${t}${map}${src ? ` @ ${src}` : ""}`;
};

function triangles(root: THREE.Object3D): Tri[] {
  root.updateMatrixWorld(true);
  const out: Tri[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || !m.visible) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    const g = m.geometry;
    const pos = g.getAttribute("position");
    if (!pos) return;
    const idx = g.index;
    const count = idx ? idx.count : pos.count;
    const flip = m.matrixWorld.determinant() < 0;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const side = (mats[0] as THREE.Material).side;
    const sides = side === THREE.DoubleSide ? [1, -1] : side === THREE.BackSide ? [-1] : [1];
    const v = (i: number) =>
      new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld);
    for (let i = 0; i + 2 < count; i += 3) {
      const a = v(i);
      const b = v(i + 1);
      const c = v(i + 2);
      const n = e1.subVectors(b, a).cross(e2.subVectors(c, a));
      const area = n.length() / 2;
      if (area < 2e-5) continue;
      n.normalize();
      if (flip) n.negate();
      out.push({
        a,
        b,
        c,
        n: n.clone(),
        area,
        mesh: m,
        sides,
        min: new THREE.Vector3(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z)),
        max: new THREE.Vector3(Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z)),
      });
    }
  });
  return out;
}

const SAMPLES: [number, number][] = [
  [1 / 3, 1 / 3],
  [0.6, 0.2],
  [0.2, 0.6],
  [0.2, 0.2],
  [0.45, 0.45],
  [0.08, 0.08],
  [0.84, 0.08],
  [0.08, 0.84],
];
const tmp = new THREE.Vector3();

/** What share of `s`'s sample points lie inside `t` (and on its plane, within `gap`). */
function inside(s: Tri, t: Tri, gap: number): number {
  const e0 = new THREE.Vector3().subVectors(t.b, t.a);
  const e1 = new THREE.Vector3().subVectors(t.c, t.a);
  const d00 = e0.dot(e0);
  const d01 = e0.dot(e1);
  const d11 = e1.dot(e1);
  const den = d00 * d11 - d01 * d01;
  if (Math.abs(den) < 1e-12) return 0;
  let hit = 0;
  const q = new THREE.Vector3();
  for (const [u, v] of SAMPLES) {
    q.copy(s.a).addScaledVector(tmp.subVectors(s.b, s.a), u).addScaledVector(tmp.subVectors(s.c, s.a), v);
    const w = tmp.subVectors(q, t.a);
    if (Math.abs(w.dot(t.n)) > gap) continue;
    const d20 = w.dot(e0);
    const d21 = w.dot(e1);
    const bv = (d11 * d20 - d01 * d21) / den;
    const bw = (d00 * d21 - d01 * d20) / den;
    if (bv >= -1e-6 && bw >= -1e-6 && bv + bw <= 1 + 1e-6) hit++;
  }
  return hit / SAMPLES.length;
}

interface Finding {
  key: string;
  a: string;
  b: string;
  gap: number;
  area: number;
  pairs: number;
  at: [number, number, number];
  facing: string;
}

function scan(tris: Tri[]): Finding[] {
  const cells = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;
  tris.forEach((t, i) => {
    // Never visible from the camera (always above): faces that look down.
    if (t.sides.every((s) => t.n.y * s < -0.5)) return;
    const x0 = Math.floor((t.min.x - GAP) / CELL);
    const x1 = Math.floor((t.max.x + GAP) / CELL);
    const y0 = Math.floor((t.min.y - GAP) / CELL);
    const y1 = Math.floor((t.max.y + GAP) / CELL);
    const z0 = Math.floor((t.min.z - GAP) / CELL);
    const z1 = Math.floor((t.max.z + GAP) / CELL);
    // A huge triangle (the ground) is compared in the cells it covers, up to a cap.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4000) return;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const k = keyOf(x, y, z);
          const l = cells.get(k);
          if (l) l.push(i);
          else cells.set(k, [i]);
        }
  });
  const seen = new Set<string>();
  const found = new Map<string, Finding>();
  for (const list of cells.values()) {
    for (let ai = 0; ai < list.length; ai++) {
      const A = tris[list[ai]!]!;
      for (let bi = ai + 1; bi < list.length; bi++) {
        const B = tris[list[bi]!]!;
        if (A.mesh === B.mesh) continue;
        const pk = `${list[ai]},${list[bi]}`;
        if (seen.has(pk)) continue;
        // Facing the same way on screen: some drawn orientation of one equals one of the other.
        let same = false;
        for (const sa of A.sides) for (const sb of B.sides) if (A.n.dot(B.n) * sa * sb > 0.9995) same = true;
        if (!same) continue;
        if (
          A.min.x > B.max.x + GAP ||
          B.min.x > A.max.x + GAP ||
          A.min.y > B.max.y + GAP ||
          B.min.y > A.max.y + GAP ||
          A.min.z > B.max.z + GAP ||
          B.min.z > A.max.z + GAP
        )
          continue;
        const gap = Math.abs(tmp.subVectors(B.a, A.a).dot(A.n));
        if (gap > GAP) continue;
        const share = Math.max(inside(A, B, GAP), inside(B, A, GAP));
        if (share < 0.2) continue;
        seen.add(pk);
        const ka = describe(A.mesh);
        const kb = describe(B.mesh);
        const key = [ka, kb].sort().join("  |  ");
        const f = found.get(key);
        const area = Math.min(A.area, B.area) * share;
        if (f) {
          f.pairs++;
          f.area += area;
          f.gap = Math.min(f.gap, gap);
        } else {
          const c = new THREE.Vector3().addVectors(A.min, A.max).multiplyScalar(0.5);
          found.set(key, {
            key,
            a: ka,
            b: kb,
            gap,
            area,
            pairs: 1,
            at: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
            facing: `${A.n.x.toFixed(2)},${A.n.y.toFixed(2)},${A.n.z.toFixed(2)}`,
          });
        }
      }
    }
  }
  return [...found.values()];
}

// MARK: Scenarios: the real views, as the game builds them.
const { mapOf } = await import("@tokenmaxxing/core/world.ts");
const { setTown, plotId } = await import("@tokenmaxxing/core/maps.ts");
const { setHq, setOffice, doorsFor } = await import("@tokenmaxxing/core/office.ts");
const { SHOP_ROOM } = await import("@tokenmaxxing/core/shoprooms.ts");
const { buildRoom, prepareRoom } = await import("../src/render3d/rooms/rooms.ts");
await import("../src/render3d/rooms/room-loaders.ts");
await import("../src/render3d/town/room-town.ts");
await import("../src/render3d/rooms/room-skin.ts");
await import("../src/render3d/rooms/room-furnished.ts");
await import("../src/render3d/dungeon/room-dungeon.ts");

// One company per house tier, on free plots of the town.
const tokens = [0, 2e6, 6e7, 8e8, 1.2e10, 4e11];
const companies = tokens.map((t, i) => ({
  id: i + 1,
  name: `Co ${i + 1}`,
  plot: plotId(i < 3 ? i : i - 3, i < 3 ? -1 : 2),
  members: 3 + i * 4,
  todayTokens: t / 30,
  tokens30d: t,
  website: null,
  brand: i % 2 ? { color: "#d94f4f", roof: "#8a3030", logo: null } : null,
  deskFleet: i % 4,
}));
setTown(companies.map((c) => c.plot));
const doors = doorsFor(
  Array.from({ length: 9 }, (_, i) => ({ userId: i + 1, name: `P${i + 1}`, open: i % 3 !== 0, slot: i })),
);
setHq(1, doors);
setOffice(1, 1, {});
setOffice(2, 2, { wall: "#cfe0ee", floor: "#9a7b55" });

const scenarios: { name: string; id: string }[] = [
  { name: "town", id: "town" },
  { name: "inn", id: "inn" },
  { name: "upstairs", id: "upstairs" },
  { name: "basement", id: "basement" },
  { name: "dungeon", id: "dungeon" },
  { name: "hq (floor + hallways)", id: "hq:1" },
  { name: "office, first size", id: "office:1" },
  { name: "office, grown, with decor", id: "office:2" },
  ...Object.values(SHOP_ROOM).map((id) => ({ name: String(id), id: String(id) })),
];

const all: Record<string, Finding[]> = {};
const picked = rooms.length
  ? scenarios.filter((x) => rooms.some((r) => x.name.startsWith(r) || x.id === r))
  : scenarios;
for (const sc of picked) {
  const t0 = performance.now();
  let tris: Tri[];
  try {
    await prepareRoom(sc.id);
    const view = buildRoom(sc.id as never, { map: mapOf(sc.id as never), companies, minutes: () => 780 });
    // --blocks: as the High tier draws it (the Voxel style swaps each smooth primitive for its block).
    if (args.includes("--blocks")) {
      const { blockify } = await import("../src/render3d/kit/blocky.ts");
      blockify(view.group);
    }
    tris = triangles(view.group);
  } catch (e) {
    console.log(`\n== ${sc.name}: could not build (${String(e).slice(0, 120)})`);
    continue;
  }
  const f = scan(tris).sort((x, y) => (x.gap > 0.0005 ? 1 : 0) - (y.gap > 0.0005 ? 1 : 0) || y.area - x.area);
  all[sc.name] = f;
  const sure = f.filter((x) => x.gap <= 0.0005);
  console.log(
    `\n== ${sc.name}: ${tris.length} triangles · ${f.length} kinds of overlap (${sure.length} exactly coplanar) · ${(performance.now() - t0).toFixed(0)} ms`,
  );
  for (const x of f.slice(0, MAX))
    console.log(
      `  gap ${x.gap.toFixed(4)} area ${x.area.toFixed(2)} ×${x.pairs} at ${x.at.join(",")} facing ${x.facing}\n    ${x.a}\n    ${x.b}`,
    );
}
const out = flag("json");
if (out) await Bun.write(out, JSON.stringify(all, null, 1));
process.exit(0);
