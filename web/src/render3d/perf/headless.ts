import * as THREE from "three";
import { loadSlices } from "../kit/registry.ts";
import type { MapId } from "../rooms/world.ts";
import { World } from "../rooms/world.ts";
import { loadRoomSkins } from "../rooms/world-rooms.ts";
import { forgetShopRoom, shopOfRoom } from "../shops/catalog.ts";
import { type BakeMode, bakeStatic, freezeLayer } from "./bake.ts";
import { sceneStats } from "./stats.ts";

/** Registers every slice's tiles, as the game does at start. */
export async function loadAllSlices(): Promise<void> {
  await loadSlices();
  await loadRoomSkins();
}

export interface RoomCost {
  drawCalls: number;
  triangles: number;
  materials: number;
  textureMB: number;
  /** Canvas textures a room holds (after atlasing) and its largest edge in pixels. */
  textures: number;
  biggest: number;
  geometryMB: number;
  lights: number;
  buildMs: number;
}

const world = () => ((globalThis as { __perfWorld?: World }).__perfWorld ??= new World());

/** Counts a fresh room at noon so street animation cannot change which parts the samples consider static. */
export function measureRoom(
  id: string,
  options: { actors?: "frozen" | "live"; variant?: BakeMode } = {},
): RoomCost {
  const page = globalThis.location as { search: string };
  const search = page.search;
  page.search = "?clock=12:00";
  try {
    return measure(id, options);
  } finally {
    page.search = search;
  }
}

function measure(id: string, options: NonNullable<Parameters<typeof measureRoom>[1]>): RoomCost {
  const content = world();
  content.evict(id as MapId);
  const shop = shopOfRoom(id);
  if (shop) forgetShopRoom(shop);
  const start = performance.now();
  const room = content.room(id as MapId);
  const buildMs = performance.now() - start;
  const scene = new THREE.Scene();
  scene.add(room.group);
  const layer = bakeStatic(room.group);
  const variant = options.variant ?? "smooth";
  if (layer) layer.show(variant);
  // People and pets that stand about are merged at run time (see `freeze.ts`): count them as the player sees them.
  const actors: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.actor) actors.push(o);
  });
  if (options.actors !== "live") for (const a of actors) freezeLayer(a, variant);
  const after = sceneStats(scene);
  let texBytes = 0;
  let biggest = 0;
  const seen = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const v of (Array.isArray(m) ? m : [m]).flatMap((x) => Object.values(x ?? {}))) {
      const t = v as THREE.Texture;
      const img = t?.isTexture ? (t.image as { width?: number; height?: number } | null) : null;
      if (!img || seen.has(t)) continue;
      seen.add(t);
      biggest = Math.max(biggest, img.width ?? 0, img.height ?? 0);
      if (t.mipmaps.length > 0) {
        for (const mip of t.mipmaps) {
          if ("width" in mip && "height" in mip) texBytes += mip.width * mip.height * 4;
        }
      } else texBytes += (img.width ?? 0) * (img.height ?? 0) * 4 * (t.generateMipmaps ? 1.34 : 1);
    }
  });
  let geometryBytes = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => {
    const geometry = (o as THREE.Mesh).geometry;
    if (!geometry || geometries.has(geometry)) return;
    geometries.add(geometry);
    geometryBytes += geometry.index?.array.byteLength ?? 0;
    for (const a of Object.values(geometry.attributes)) geometryBytes += a.array.byteLength;
  });
  return {
    drawCalls: after.drawables,
    triangles: Math.round(after.triangles),
    materials: after.materials,
    textureMB: Math.round((texBytes / 1048576) * 10) / 10,
    textures: seen.size,
    biggest,
    geometryMB: Math.round((geometryBytes / 1048576) * 10) / 10,
    lights: after.lights,
    buildMs: Math.round(buildMs * 10) / 10,
  };
}
