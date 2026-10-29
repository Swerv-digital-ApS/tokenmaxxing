import type * as THREE from "three";

/**
 * three's render lists sort with comparators that return `a.z - b.z`, a fraction, which is boxed (a fresh heap number) on
 * its way back to the sort: a few hundred per frame. These answer -1 or 1 for depth instead, in the same order.
 */

type Item = {
  groupOrder: number;
  renderOrder: number;
  /** three's materials have a numeric `id`; its types leave it out. */
  material: { id: number };
  materialVariant: number;
  z: number;
  id: number;
};

/** three's `painterSortStable`, answering -1 or 1 for depth (the only fraction it returned). */
function opaque(a: Item, b: Item): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z < b.z ? -1 : 1;
  return a.id - b.id;
}

/** three's `reversePainterSortStable`, likewise. */
function transparent(a: Item, b: Item): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.z !== b.z) return a.z > b.z ? -1 : 1;
  return a.id - b.id;
}

export function sortWithoutBoxing(renderer: THREE.WebGLRenderer): void {
  renderer.setOpaqueSort(opaque as never);
  renderer.setTransparentSort(transparent as never);
}
