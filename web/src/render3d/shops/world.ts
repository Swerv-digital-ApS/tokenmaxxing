/**
 * What the shops need from the 3D renderer's world, as a small interface the renderer implements and hands to
 * `installShops` (`index.ts`): showing a look on the local player's avatar without saving it, entering the Office
 * placement mode for a bought piece, and putting a wallpaper or floor on the Office the renderer draws.
 * Everything that costs or saves goes to the server through the `GameBackend`, never through here.
 */
import type { Look2D } from "../people/gear3d.ts";

export interface ShopWorld {
  /** Shows `look` on the local player for now; null puts the saved one back. Never saved. */
  previewLook(look: Look2D | null): void;
  /** The render style of the world, for the buy panel's 3D preview. */
  renderStyle(): { style: "classic" | "voxel"; pixelSize: number; night: boolean };
  /**
   * Enters the Office placement mode for the personal furniture piece `itemId` (a core item id, `furn.<ch>`),
   * taking the player to their Office first if need be. The renderer ends it with a drop through the same call
   * the Bag uses (`town.drop`). False when it has no placement mode (the caller then drops where the player stands).
   */
  startPlacement(itemId: string, company?: boolean): boolean;
  /** The Office's wallpaper and floor, as core `decor.ts` ids; what the player sets changes at once, before the server answers. */
  applyDecor(d: { wall?: string; floor?: string }): void;
}
