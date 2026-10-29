import type * as THREE from "three";
import { ticks } from "../kit/kit.ts";

/** Hardware-independent facts about a scene: what the CPU has to walk and what the GPU is asked to draw. */
export interface SceneStats {
  objects: number;
  meshes: number;
  instanced: number;
  instances: number;
  /** Meshes that would each cost a draw call (visible, not instanced, counted once per material). */
  drawables: number;
  triangles: number;
  geometries: number;
  materials: number;
  textures: number;
  lights: number;
  shadowCasters: number;
  transparent: number;
  ticks: number;
}

export function sceneStats(scene: THREE.Object3D): SceneStats {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const texs = new Set<THREE.Texture>();
  const s: SceneStats = {
    objects: 0,
    meshes: 0,
    instanced: 0,
    instances: 0,
    drawables: 0,
    triangles: 0,
    geometries: 0,
    materials: 0,
    textures: 0,
    lights: 0,
    shadowCasters: 0,
    transparent: 0,
    ticks: ticks.length,
  };
  scene.traverseVisible((o) => {
    s.objects++;
    if ((o as THREE.Light).isLight) s.lights++;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    s.meshes++;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    const g = m.geometry;
    geos.add(g);
    const available = (g.index?.count ?? g.getAttribute("position")?.count ?? 0) - g.drawRange.start;
    const tris = Math.max(0, Math.min(available, g.drawRange.count)) / 3;
    const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    if (n !== 1 || (m as THREE.InstancedMesh).isInstancedMesh) {
      s.instanced++;
      s.instances += n;
    }
    if (tris > 0) s.drawables += list.length;
    s.triangles += tris * n;
    if (m.castShadow) s.shadowCasters++;
    for (const mat of list) {
      mats.add(mat);
      if (mat.transparent) s.transparent++;
      for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture);
    }
  });
  s.geometries = geos.size;
  s.materials = mats.size;
  s.textures = texs.size;
  return s;
}

interface Tracked {
  renderer: THREE.WebGLRenderer;
  scene: () => THREE.Scene | null;
}
const tracked: Tracked[] = [];

/** Registers a renderer so the perf harness (and the console) can read `renderer.info` and the live scene. */
export function trackRenderer(renderer: THREE.WebGLRenderer, scene: () => THREE.Scene | null): () => void {
  const entry = { renderer, scene };
  tracked.push(entry);
  (globalThis as unknown as Record<string, unknown>).__perfRenderer = renderer;
  (globalThis as unknown as Record<string, unknown>).__perfScene = () => tracked[0]?.scene() ?? null;
  (globalThis as unknown as Record<string, unknown>).__unbatched = () => {
    const sc = tracked[0]?.scene();
    return sc ? unbatched(sc) : null;
  };
  (globalThis as unknown as Record<string, unknown>).__perfStats = () =>
    tracked.map((t) => {
      const sc = t.scene();
      const i = t.renderer.info;
      return {
        memory: { ...i.memory },
        programs: i.programs?.length ?? 0,
        scene: sc ? sceneStats(sc) : null,
      };
    });
  return () => {
    const i = tracked.indexOf(entry);
    if (i >= 0) tracked.splice(i, 1);
    const debug = globalThis as unknown as Record<string, unknown>;
    if (debug.__perfRenderer === renderer) debug.__perfRenderer = tracked.at(-1)?.renderer;
  };
}

/** Debug: what still draws on its own, grouped by what it is made of (`__unbatched()` in the console). */
export function unbatched(scene: THREE.Object3D): { by: [string, number][]; total: number } {
  const by = new Map<string, number>();
  let total = 0;
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    total++;
    const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    let live = "";
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.userData.live) live = "live ";
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? "instanced " : "";
    const k = `${live}${inst}${m.geometry.type}/${mat.type}${mat.transparent ? "/transparent" : ""}${m.userData.bakedSource ? "/src" : ""}`;
    by.set(k, (by.get(k) ?? 0) + 1);
  });
  return { by: [...by].sort((a, b) => b[1] - a[1]).slice(0, 14), total };
}
