import { expect, test } from "bun:test";
import * as THREE from "three";
import { disposeObject } from "../src/render3d/engine/dispose.ts";
import { bake, Grid } from "../src/render3d/pets/petvox.ts";

test("voxel faces share corners without changing topology, normals or per-corner color", () => {
  const mesh = bake(new Grid().set(0, 0, 0, "#ffffff"), { jitter: 0, flat: true });
  const geometry = mesh.geometry;
  expect(geometry.getAttribute("position").count).toBe(24);
  expect(geometry.index!.count).toBe(36);
  const expanded = geometry.toNonIndexed();
  const position = expanded.getAttribute("position");
  const normals = expanded.getAttribute("normal");
  const colors = expanded.getAttribute("color");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1).sub(a);
    c.fromBufferAttribute(position, i + 2).sub(a);
    expect(b.cross(c).normalize().dot(a.fromBufferAttribute(normals, i))).toBeCloseTo(1);
  }
  for (let i = 0; i < colors.count; i++)
    expect([colors.getX(i), colors.getY(i), colors.getZ(i)]).toEqual([1, 1, 1]);
  expanded.dispose();
  disposeObject(mesh);
});

test("identical pet surfaces share buffers and release them only after the last owner leaves", () => {
  const grid = new Grid().set(0, 0, 0, "#aabbcc").set(1, 0, 0, "*#ffeeaa");
  const first = bake(grid, { seed: 2 });
  const second = bake(grid, { seed: 2 });
  const variant = bake(grid, { seed: 3 });
  expect(first.geometry).toBe(second.geometry);
  expect(first.geometry).not.toBe(variant.geometry);
  let disposed = 0;
  first.geometry.addEventListener("dispose", () => disposed++);
  disposeObject(first);
  expect(disposed).toBe(0);
  disposeObject(second);
  expect(disposed).toBe(1);
  disposeObject(second);
  expect(disposed).toBe(1);
  disposeObject(variant);
  const rebuilt = bake(grid, { seed: 2 });
  expect(rebuilt.geometry).not.toBe(first.geometry);
  disposeObject(rebuilt);
});
