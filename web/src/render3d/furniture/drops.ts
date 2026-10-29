import { lootById, RARITIES } from "@tokenmaxxing/core/loot.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import type { Drop } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { world } from "../../game/world.ts";
import { disposeObject } from "../engine/dispose.ts";
import { Model } from "../kit/kit.ts";
import { type Pet3D, petFrom2D } from "../pets/pets3d.ts";
import type { RoomView } from "../rooms/rooms.ts";

interface Shown {
  drop: Drop;
  root: THREE.Group;
  pet: Pet3D | null;
  /** The pillar of light over raid loot, in its rarity's colour. */
  beam: THREE.Mesh | null;
}

/**
 * What lies on the floor: a pet drop is the pet itself, any other wearable a ribboned parcel. Furniture is
 * in the room's map, so the room draws it. Taking one is the 2D game's right-click (`input.ts`).
 */
export class Drops {
  readonly group = new THREE.Group();
  private readonly shown = new Map<number, Shown>();
  private seen: readonly Drop[] | null = null;
  /** New meshes were added: the renderer swaps them for blocks. */
  dirty = false;

  /** Brings the floor up to date with `world.drops`; `t` is seconds, for the bobbing. */
  update(view: RoomView, t: number): void {
    if (this.seen !== world.drops) {
      this.seen = world.drops;
      const ids = new Set<number>();
      for (const d of world.drops) {
        const kind = itemById(d.item);
        if (!kind || kind.slot === "furniture") continue;
        ids.add(d.id);
        if (this.shown.has(d.id)) continue;
        const root = new THREE.Group();
        let pet: Pet3D | null = null;
        if (kind.slot === "pet") {
          pet = petFrom2D(kind.index);
          pet.root.scale.setScalar(1.25);
          root.add(pet.root);
        } else {
          const parcel = new Model();
          parcel.box([0.34, 0.24, 0.34], "#d9564a", [0, 0, 0], 0.03);
          parcel.box([0.36, 0.26, 0.07], "#f5d14a", [0, 0, 0], 0.01);
          parcel.box([0.07, 0.26, 0.36], "#f5d14a", [0, 0, 0], 0.01);
          parcel.box([0.14, 0.07, 0.07], "#f5d14a", [0, 0.26, 0], 0.01);
          root.add(parcel);
        }
        const [x, z] = view.toWorld(d.x, d.y);
        root.position.set(x, 0, z);
        // Raid loot lies in a beam of its rarity's colour (common green, rare blue, epic violet, legendary gold).
        let beam: THREE.Mesh | null = null;
        const loot = lootById(d.item);
        if (loot) {
          const w = 0.07 + 0.03 * ["common", "rare", "epic", "legendary"].indexOf(loot.rarity);
          beam = new THREE.Mesh(
            new THREE.BoxGeometry(w * 2, 3, w * 2),
            new THREE.MeshBasicMaterial({
              color: RARITIES[loot.rarity].color,
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
            }),
          );
          beam.position.y = 1.5;
          beam.userData.nopick = true;
          root.add(beam);
        }
        this.group.add(root);
        this.shown.set(d.id, { drop: d, root, pet, beam });
        this.dirty = true;
      }
      for (const [id, s] of this.shown)
        if (!ids.has(id)) {
          s.root.removeFromParent();
          disposeObject(s.root);
          this.shown.delete(id);
        }
    }
    for (const s of this.shown.values()) {
      s.root.position.y = s.pet ? 0 : 0.04 + Math.abs(Math.sin(t * 2 + s.drop.id)) * 0.05;
      s.pet?.update(t);
      if (s.beam)
        (s.beam.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.12 * Math.sin(t * 3 + s.drop.id);
    }
  }

  clear(): void {
    for (const s of this.shown.values()) {
      s.root.removeFromParent();
      disposeObject(s.root);
    }
    this.shown.clear();
    this.seen = null;
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
