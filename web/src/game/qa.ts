import { DANCES } from "@tokenmaxxing/core/dances.ts";
import { route } from "@tokenmaxxing/core/world.ts";
import { conn, town } from "../net.ts";
import { graphics } from "../settings/graphics.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { camera, viewHooks } from "./camera.ts";
import { ghost, undoStack } from "./furniture.ts";
import { walkTo } from "./input.ts";
import { myPetTile } from "./pets.ts";
import { perf, pickTile } from "./stage.ts";
import { self, showMyDance, world } from "./world.ts";

/**
 * A handle for the QA scripts (`scripts/qa`) to drive the real game: `localStorage["tokenmaxxing.qa"] = "1"`
 * turns it on as `window.__tm`. Nothing here is used by the game itself.
 */
export function exposeForQa(): void {
  if (!storage.getItem("tokenmaxxing.qa")) return;
  Object.defineProperty(window, "__tmTown", { get: () => town });
  Object.assign(window, {
    __tm: {
      world,
      self,
      hud,
      graphics,
      camera,
      viewHooks,
      perf,
      pickTile,
      petTile: myPetTile,
      walkTo,
      route,
      ghost,
      undoStack,
      dances: DANCES,
      showMyDance,
      conn: () => conn,
    },
  });
}
