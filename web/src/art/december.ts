import { C } from "./palette.ts";
import { bake, once } from "./pixels.ts";

/**
 * December (`game/december.ts`): a julefrokost place setting for one tile of a Tavern table (`art/tavern.ts`
 * `table`: its top is rows 4 to 9): a red runner down the middle, a plate with food on it and a snaps glass.
 */
export const RUNNER = "#b3262e";

export const placeSetting = once(() =>
  bake(16, 16, (p) => {
    p.rect(0, 6, 16, 2, RUNNER);
    p.rect(0, 7, 16, 1, "#8c1d24");
    p.rect(2, 4, 6, 3, C.ink);
    p.rect(3, 4, 4, 2, "#fbf7ef");
    p.rect(4, 4, 2, 1, "#c8743a");
    p.rect(11, 3, 2, 4, C.ink);
    p.rect(11, 4, 2, 2, "#dff3ff");
  }),
);
