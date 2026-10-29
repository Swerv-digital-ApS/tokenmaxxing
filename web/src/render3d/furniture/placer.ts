import { pieceOf, type Rot, sideways } from "@tokenmaxxing/core/office.ts";
import * as THREE from "three";
import { assetOfChar, turnOfChar } from "../rooms/room-furnished.ts";
import type { RoomView } from "../rooms/rooms.ts";
import type { Asset } from "./furniture.ts";

/** A tile of the room's map, with the piece's own footprint. */
export interface Aim {
  x: number;
  y: number;
}

/**
 * Putting a piece of furniture down in your Office: a see-through copy of it follows the pointer over the floor
 * (green where it can go, red where it cannot) and a click picks the tile. What happens then (walking up to the
 * tile, facing it, dropping) is the renderer's, through the same server call the Bag uses.
 */
export class Placer {
  private ghost: THREE.Group | null = null;
  private material: THREE.MeshBasicMaterial | null = null;
  private asset: Asset | undefined;
  /** The piece's item id and its width in tiles. */
  itemId: string | null = null;
  width = 1;
  private wall = false;

  get active(): boolean {
    return this.itemId !== null;
  }

  /** Starts placing `itemId` (`furn.<ch>`) in `scene`; false when no art for it exists to show. */
  begin(itemId: string, scene: THREE.Scene): boolean {
    this.cancel();
    const ch = itemId.startsWith("furn.") ? itemId.slice(5) : null;
    if (!ch) return false;
    this.asset = assetOfChar(ch);
    this.width = Math.max(1, pieceOf(ch)?.w ?? 1);
    this.wall = pieceOf(ch)?.wall === true;
    this.itemId = itemId;
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghost.userData.nopick = true;
    this.ghost.userData.live = true;
    this.material = new THREE.MeshBasicMaterial({
      color: "#5be08a",
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const model = this.asset?.build();
    if (model) {
      // One flat colour over the whole piece (the shape is what matters).
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = this.material!;
          m.castShadow = m.receiveShadow = false;
          m.userData.nopick = true;
        }
      });
      this.ghost.add(model);
    } else {
      // A wall piece without art is a flat slab on the wall, anything else a block on the floor.
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(this.width * 0.9, this.wall ? 0.7 : 0.9, this.wall ? 0.06 : 0.9),
        this.material,
      );
      box.position.y = this.wall ? 0 : 0.45;
      this.ghost.add(box);
    }
    scene.add(this.ghost);
    return true;
  }

  /**
   * Moves the ghost to the tile under the pointer (null: off the floor). `fits` says whether it can go there,
   * `rot` how far it is turned (quarter turns clockwise): a quarter turn lies it down its column from the aimed tile.
   */
  aim(view: RoomView, tile: Aim | null, fits: boolean, rot: Rot = 0): void {
    if (!this.ghost) return;
    this.ghost.visible = tile !== null;
    if (!tile) return;
    const [x, z] = view.toWorld(tile.x, tile.y);
    // The footprint is `width` tiles to the right of the aimed one, centred on the aimed tile's row.
    const w = this.asset?.w ?? this.width;
    const d = this.asset?.d ?? 1;
    // A wall piece hangs on the wall row's inner face at the height the room hangs its own (`Room.hang`).
    const turned = this.wall ? 0 : rot;
    if (this.wall) this.ghost.position.set(x - 0.5 + w / 2, 0.95, z + 0.51);
    else if (sideways(turned)) this.ghost.position.set(x, 0, z - 0.5 + this.width / 2);
    else this.ghost.position.set(x - 0.5 + w / 2, 0, z - 0.5 + d / 2);
    this.ghost.rotation.y = ((turnOfChar(this.itemId!.slice(5)) - turned) * Math.PI) / 2;
    this.material!.color.set(fits ? "#5be08a" : "#e8584f");
  }

  cancel(): void {
    this.ghost?.removeFromParent();
    this.material?.dispose();
    this.ghost = null;
    this.material = null;
    this.itemId = null;
  }
}
