import { expect, test } from "bun:test";
import * as THREE from "three";
import { batchStatic } from "../src/render3d/engine/batch.ts";
import { disposeObject } from "../src/render3d/engine/dispose.ts";

const counted = (target: { addEventListener: (t: "dispose", f: () => void) => void }) => {
  const n = { v: 0 };
  target.addEventListener("dispose", () => n.v++);
  return n;
};

test("everything a room holds is freed once, shared things are left alone", () => {
  const root = new THREE.Group();
  const geo = new THREE.BoxGeometry();
  const shared = new THREE.BoxGeometry();
  shared.userData.shared = true;
  const tex = new THREE.Texture();
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const sharedMat = new THREE.MeshBasicMaterial();
  sharedMat.userData.shared = true;
  const counts = {
    geo: counted(geo),
    shared: counted(shared),
    tex: counted(tex),
    mat: counted(mat),
    sharedMat: counted(sharedMat),
  };
  // Two meshes on the same geometry and material: still one dispose each.
  for (const g of [geo, geo, shared]) root.add(new THREE.Mesh(g, g === shared ? sharedMat : mat));
  const freed = disposeObject(root);
  expect(counts.geo.v).toBe(1);
  expect(counts.mat.v).toBe(1);
  expect(counts.tex.v).toBe(1);
  expect(counts.shared.v).toBe(0);
  expect(counts.sharedMat.v).toBe(0);
  expect(freed).toEqual({ geometries: 1, materials: 1, textures: 1 });
});

test("the blocky stand-in a voxel mesh keeps beside its geometry is freed too", () => {
  const original = new THREE.SphereGeometry();
  const block = new THREE.BoxGeometry();
  const n = counted(original);
  const mesh = new THREE.Mesh(block, new THREE.MeshBasicMaterial());
  mesh.userData.voxelSaved = { geometry: original };
  disposeObject(mesh);
  expect(n.v).toBe(1);
});

test("lights free their shadow maps and instanced meshes their buffers", () => {
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
  const g = new THREE.Group();
  g.add(sun, inst);
  expect(() => disposeObject(g)).not.toThrow();
});

const box = (x: number, z: number, mat: THREE.Material, y = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

test("batching merges what stands still and leaves what moves, hides and changes", () => {
  const root = new THREE.Group();
  const stone = new THREE.MeshBasicMaterial({ color: "#888888" });
  const glass = new THREE.MeshBasicMaterial({ color: "#88aaff", transparent: true, opacity: 0.5 });
  const still = [0, 1, 2, 3, 4, 5].map((i) => box(i, 0, stone));
  const spinner = box(10, 0, stone);
  const toggled = box(11, 0, stone);
  const swapped = box(12, 0, stone);
  const pane = box(13, 0, glass);
  const far = box(100, 100, stone);
  const far2 = box(101, 100, stone);
  root.add(...still, spinner, toggled, swapped, pane, far, far2);
  const night = new THREE.MeshBasicMaterial({ color: "#ffee88" });
  const before = root.children.length;
  const result = batchStatic(root, {
    chunk: 16,
    samples: 4,
    probe: (i) => {
      spinner.rotation.y = i * 0.7;
      toggled.visible = i % 2 === 0;
      swapped.material = i === 2 ? night : stone;
    },
  });
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  // The still boxes became one mesh near the origin and one far away; the movers and the glass stay.
  const merged = meshes.filter((m) => m.userData.batched);
  expect(merged.map((m) => m.userData.batched).sort()).toEqual([2, 6]);
  expect(meshes).toContain(spinner);
  expect(meshes).toContain(toggled);
  expect(meshes).toContain(swapped);
  expect(meshes).toContain(pane);
  for (const m of still) expect(meshes).not.toContain(m);
  expect(result.before).toBe(before);
  expect(result.after).toBeLessThan(result.before);
  // The merged mesh draws the same boxes where they were, and keeps the shadow flags.
  const first = merged.find((m) => m.userData.batched === 6)!;
  first.geometry.computeBoundingBox();
  expect(first.geometry.boundingBox!.min.x).toBeCloseTo(-0.5);
  expect(first.geometry.boundingBox!.max.x).toBeCloseTo(5.5);
  expect(first.castShadow).toBe(true);
  expect(first.material).toBe(stone);
});

test("room disposal retires nested batches, pending probes, frozen actors and night subscriptions", async () => {
  const { bakePending, batchWithoutWarmup, frozenCount, freezeLayer, syncBaked, trackAdditions } =
    await import("../src/render3d/perf/bake.ts");
  const { Freezer } = await import("../src/render3d/perf/freeze.ts");
  const { nightGlow, setPropsNight } = await import("../src/render3d/town/props.ts");
  trackAdditions();
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.userData.bake = true;
  const rigid = new THREE.Group();
  rigid.userData.rigid = true;
  const actor = new THREE.Group();
  actor.userData.live = true;
  const stone = new THREE.MeshToonMaterial({ color: "#888888" });
  for (const parent of [root, rigid, actor]) for (let i = 0; i < 4; i++) parent.add(box(i, 0, stone));
  const glowing = root.children[0] as THREE.Mesh;
  nightGlow(glowing, new THREE.MeshBasicMaterial({ color: "#ffff00" }));
  root.add(rigid, actor);
  scene.add(root);
  batchWithoutWarmup(root);
  batchWithoutWarmup(rigid);
  const layers = syncBaked(scene, "smooth");
  expect(layers.length).toBe(2);
  const before = frozenCount();
  const frozen = freezeLayer(actor)!;
  expect(frozenCount()).toBe(before + 1);
  const freezer = new Freezer(actor, 1);
  freezer.settle("stand");
  const pending = new THREE.Group();
  pending.userData.bake = true;
  pending.add(box(0, 0, stone), box(1, 0, stone));
  scene.add(pending);
  syncBaked(scene, "smooth");
  expect(bakePending(scene)).toBe(true);
  disposeObject(scene);
  expect(bakePending(scene)).toBe(false);
  expect(layers.every((layer) => layer.disposed)).toBe(true);
  expect(frozen.disposed).toBe(true);
  expect(frozenCount()).toBe(before);
  expect(freezer.frozen).toBe(false);
  const material = glowing.material;
  setPropsNight(true);
  expect(glowing.material).toBe(material);
  setPropsNight(false);
});
