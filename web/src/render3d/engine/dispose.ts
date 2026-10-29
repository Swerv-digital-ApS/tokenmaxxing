import * as THREE from "three";
import { dropBaked } from "../perf/bake.ts";
import { dropPropsNight } from "../town/props.ts";

/** Texture slots a material can hold. `gradientMap` is the toon bands, shared by every material. */
const MAPS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
] as const;

/** Things the asset kit caches for everyone (`userData.shared`): freeing them would only re-upload them. */
const shared = (o: { userData: Record<string, unknown> }): boolean => o.userData.shared === true;

export interface Freed {
  geometries: number;
  materials: number;
  textures: number;
}

/**
 * Frees what `root` and everything under it holds on the GPU: geometries (and the blocky stand-ins
 * `blocky.ts` keeps beside them), materials, their textures, instanced buffers and shadow maps. Things the
 * kit shares between every model (`userData.shared`) are left alone. Safe to call on an object that is
 * still shared: three re-uploads what a later frame needs.
 */
export function disposeObject(
  root: THREE.Object3D,
  freed: Freed = { geometries: 0, materials: 0, textures: 0 },
): Freed {
  dropBaked(root);
  dropPropsNight(root);
  // Disposal may remove generated children; collect callbacks before invoking any of them.
  const callbacks: (() => void)[] = [];
  root.traverse((o) => {
    const off = o.userData.onDispose as (() => void) | undefined;
    if (off) {
      o.userData.onDispose = undefined;
      callbacks.push(off);
    }
  });
  for (const off of callbacks) off();
  const seen = new Set<unknown>();
  const free = (thing: { dispose(): void; userData: Record<string, unknown> }, kind: keyof Freed) => {
    if (seen.has(thing) || shared(thing)) return;
    seen.add(thing);
    thing.dispose();
    freed[kind]++;
  };
  const material = (m: THREE.Material) => {
    if (seen.has(m)) return;
    if (!shared(m)) {
      const slots = m as unknown as Record<string, unknown>;
      for (const key of MAPS) {
        const t = slots[key];
        if (t instanceof THREE.Texture) free(t, "textures");
      }
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms)
        for (const u of Object.values(uniforms))
          if (u.value instanceof THREE.Texture) free(u.value, "textures");
    }
    free(m, "materials");
  };
  root.traverse((o) => {
    const any = o as THREE.Mesh;
    if (any.geometry) {
      free(any.geometry, "geometries");
      const saved = o.userData.voxelSaved as { geometry?: THREE.BufferGeometry } | undefined;
      if (saved?.geometry) free(saved.geometry, "geometries");
    }
    const night = o.userData.nightGlow as { day: THREE.Material; night: THREE.Material } | undefined;
    if (night) {
      material(night.day);
      material(night.night);
    }
    if (any.material)
      for (const m of Array.isArray(any.material) ? any.material : [any.material]) material(m);
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    const lit = o as THREE.DirectionalLight;
    if (lit.isLight && lit.shadow) lit.shadow.dispose();
    const bg = (o as THREE.Scene).background;
    if (bg instanceof THREE.Texture) free(bg, "textures");
  });
  return freed;
}

/** What the renderer holds right now: the numbers the leak checks compare. */
export interface Gpu {
  geometries: number;
  textures: number;
  programs: number;
  calls: number;
  triangles: number;
}

export function gpuNow(r: THREE.WebGLRenderer): Gpu {
  const { memory, programs, render } = r.info;
  return {
    geometries: memory.geometries,
    textures: memory.textures,
    programs: programs?.length ?? 0,
    calls: render.calls,
    triangles: render.triangles,
  };
}
