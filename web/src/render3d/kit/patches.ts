import type * as THREE from "three";

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];

/**
 * Adds a named shader tweak to a material, after any it already has (snow settling on roofs, the player seen
 * through trees). Each name is added once, and the program cache key lists them, so materials with different
 * sets never share a program.
 */
export function addPatch(mat: THREE.Material, name: string, patch: (shader: Shader) => void): void {
  const names: string[] = (mat.userData.patches as string[] | undefined) ?? [];
  mat.userData.patches = names;
  if (names.includes(name)) return;
  names.push(name);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    patch(shader);
  };
  mat.customProgramCacheKey = () => names.join("+");
  mat.needsUpdate = true;
}
