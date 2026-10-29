/**
 * The pond treasures' body gear in 3D (`core/src/fishing-loot.ts`): the golden rod held in the hand and the tackle box
 * worn on the back, in the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dFishing.ts`, it
 * adds its builders to the shop's `HELD_BUILDERS` / `BACK_BUILDERS` under their names.
 */
import { BACK_BUILDERS, type BackBuilder, HELD_BUILDERS, type HeldBuilder } from "./gear3dBody.ts";
import { lit, ring } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const GOLD = "#f2c230";
const GOLD_LIGHT = "#ffe27a";
const GOLD_DARK = "#b8860b";
const CORK = "#7a5232";
const CORK_DARK = "#5a3a22";
const LINE = "#e9f1f5";
const RED = "#e63946";
const STEEL = "#c3cad6";
const STEEL_DARK = "#7a8394";
const TEAL = "#2a9d8f";
const TEAL_DARK = "#1c6b62";
const TEAL_LIGHT = "#5cc7b5";
const BRASS = "#d9a441";
const BLACK = "#2b2f36";

// MARK: Held

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // Golden rod: a gold rod held at a slant, a cork grip, a reel with a crank, gold guides and a thin line hanging off the
  // tip to a small red and white bobber. The line sways, the bobber bobs and a glint runs up the blank.
  "Golden rod": (h, tick) => {
    // The rod leans forward and up from the hand; each section of the blank bends a little more, so it arcs.
    const lean = 0.9;
    const bends = [0, 0.1, 0.14];
    const rod = h.part([0, -0.02, 0.03]);
    rod.rotation.x = lean;
    // The grip: cork rings with gold caps either end, and the hand round the middle of it.
    rod.cyl(0.014, 0.03, GOLD_DARK, [0, -0.1, 0], 0.016, 8);
    rod.cyl(0.016, 0.14, CORK, [0, -0.07, 0], 0.016, 8);
    for (const y of [-0.04, 0.0, 0.04]) rod.cyl(0.0175, 0.008, CORK_DARK, [0, y, 0], 0.0175, 8);
    rod.cyl(0.017, 0.014, GOLD, [0, 0.07, 0], 0.014, 8);
    // The reel, under the rod just above the grip: a spool between two plates, a foot and a crank with a red knob.
    rod.box([0.03, 0.05, 0.03], GOLD_DARK, [0, 0.095, 0.012], 0.004);
    const reel = rod.part([0, 0.12, 0.04]);
    reel.cyl(0.03, 0.05, GOLD, [0.025, 0, 0], 0.03, 12).rotation.z = Math.PI / 2;
    reel.cyl(0.021, 0.056, STEEL, [0.028, 0, 0], 0.021, 10).rotation.z = Math.PI / 2;
    reel.cyl(0.032, 0.006, GOLD_LIGHT, [0.033, 0, 0], 0.032, 12).rotation.z = Math.PI / 2;
    reel.box([0.008, 0.008, 0.03], GOLD_DARK, [0.036, -0.004, 0.015], 0.002);
    reel.ball(0.01, RED, [0.036, 0, 0.03]);
    // The blank, three tapering gold sections joined at the bends, with a guide ring under each.
    let at = rod.part([0, 0.078, 0]);
    let tip = 0;
    const lens = [0.15, 0.15, 0.11];
    const radii = [0.0125, 0.0098, 0.0072, 0.0045];
    lens.forEach((len, i) => {
      if (i) {
        const next = at.part([0, lens[i - 1]!, 0]);
        next.rotation.x = bends[i]!;
        at = next;
      }
      at.cyl(radii[i]!, len + 0.002, i % 2 ? GOLD_LIGHT : GOLD, [0, 0, 0], radii[i + 1]!, 8);
      at.cyl(radii[i]! + 0.002, 0.008, GOLD_DARK, [0, 0, 0], radii[i]! + 0.002, 8);
      ring(at, GOLD_DARK, 0.007, 0.0018, [0, len * 0.55, 0.016], true);
      tip += bends[i]!;
    });
    const end = at.part([0, lens[2]!, 0]);
    end.ball(0.007, GOLD_DARK, [0, 0, 0]);
    // The line hangs straight down from the tip whatever the rod does (the lean and the bends undone), to the bobber.
    const sag = -(lean + tip);
    const line = end.part([0, 0, 0]);
    line.rotation.x = sag;
    const drop = 0.2;
    line.box([0.004, drop, 0.004], LINE, [0, -drop, 0], 0);
    const bob = line.part([0, -drop, 0]);
    bob.ball(0.022, "#ffffff", [0, -0.01, 0], [1, 1.15, 1]);
    bob.ball(0.02, RED, [0, 0.016, 0], [1, 0.9, 1]);
    bob.box([0.005, 0.022, 0.005], RED, [0, 0.03, 0], 0);
    bob.box([0.004, 0.03, 0.004], LINE, [0, -0.052, 0], 0);
    bob.box([0.005, 0.026, 0.005], STEEL_DARK, [0, -0.08, 0], 0);
    bob.box([0.016, 0.005, 0.005], STEEL_DARK, [0.006, -0.084, 0], 0);
    // A glint that runs up the blank and back, a plus of light.
    const glint = rod.part([0, 0.1, 0.014]);
    glint.box([0.05, 0.007, 0.007], lit("#fffbe0"), [0, -0.0035, 0], 0);
    glint.box([0.007, 0.05, 0.007], lit("#fffbe0"), [0, -0.025, 0], 0);
    tick((t) => {
      line.rotation.x = sag + Math.sin(t * 1.5) * 0.05;
      line.rotation.z = Math.sin(t * 1.1 + 1) * 0.06;
      bob.position.y = -drop + Math.sin(t * 2.4) * 0.006;
      bob.rotation.z = Math.sin(t * 2 + 0.5) * 0.12;
      const k = (t * 0.35) % 1;
      glint.position.y = 0.1 + k * 0.4;
      glint.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) ** 2));
      glint.rotation.y = t * 2;
    });
  },
};
Object.assign(HELD_BUILDERS, HELD);

// MARK: Back

/** A lure on a short line, hung from the pivot of `p` (cube units: down is negative). */
function hung(p: VoxModel, kind: "spoon" | "jig"): void {
  const v = new Vx(p);
  v.b(-0.15, -2.0, -0.15, 0.3, 2.0, 0.3, "#e9f1f5");
  if (kind === "spoon") {
    v.b(-0.8, -4.4, -0.3, 1.6, 2.4, 0.6, "#dfe6ee");
    v.b(-0.4, -4.0, -0.35, 0.8, 1.6, 0.3, RED);
    v.b(-0.8, -4.8, -0.3, 1.6, 0.4, 0.6, STEEL_DARK);
  } else {
    v.b(-0.65, -3.3, -0.65, 1.3, 1.3, 1.3, "#ff9f1c");
    v.b(-0.9, -4.9, -0.9, 1.8, 1.6, 1.8, "#2ec4b6");
    for (const x of [-0.6, 0, 0.6]) v.b(x - 0.15, -6.1, -0.15, 0.3, 1.2, 0.3, "#ff4d6d");
  }
  v.b(-0.15, -5.4, -0.15, 0.3, 1.0, 0.3, STEEL_DARK);
}

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Tackle box pack: a green-teal metal tackle box on the back, ribbed, with brass corners, two steel latches, a black
  // carrying handle across the top and a fish sticker on the lid. Two lures dangle off its sides; walking sets them
  // swinging and rattles the lid.
  "Tackle box pack": (b, tick) => {
    const v = new Vx(b);
    // Straps over the shoulders, down the chest.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x, -7, 4, 1, 7.2, 0.5, BLACK);
      v.b(x, -0.6, 3.9, 1, 0.6, 0.6, BLACK);
      v.b(x, -1.2, -0.4, 1, 1.2, 0.5, BLACK);
    }
    // The tray: a base with a dark rim and ribs down the back.
    v.b(-4, -8.4, -4.8, 8, 3.8, 4.6, TEAL);
    v.b(-4.1, -8.6, -4.9, 8.2, 0.6, 4.8, TEAL_DARK);
    for (const y of [-7.6, -6.7]) v.b(-3.6, y, -5.0, 7.2, 0.25, 0.25, TEAL_DARK);
    // The lid on its hinge: it sits on the tray's front edge and lifts a hair as you walk.
    const lid = vpart(b, [0, -4.6 * U, -0.2 * U]);
    const l = new Vx(lid);
    const at = (x: number, y: number, z: number, w: number, hh: number, d: number, c: string) =>
      l.b(x, y + 4.6, z + 0.2, w, hh, d, c);
    at(-4, -4.6, -4.8, 8, 3.0, 4.6, TEAL);
    at(-4.1, -5.0, -4.9, 8.2, 0.5, 4.8, TEAL_DARK);
    at(-3.4, -1.6, -4.4, 6.8, 0.6, 3.8, TEAL_LIGHT);
    for (const y of [-3.6, -2.7]) at(-3.6, y, -5.0, 7.2, 0.25, 0.25, TEAL_DARK);
    // The handle: two steel posts and a black grip, standing up from the lid.
    for (const x of [-2.8, 2.2]) at(x, -1.0, -3.4, 0.6, 0.9, 0.9, STEEL);
    at(-2.8, -0.2, -3.5, 5.6, 0.7, 1.1, BLACK);
    // A fish sticker on the lid, nose to the left.
    at(-1.3, -3.4, -5.08, 1.8, 0.9, 0.16, "#ffd23f");
    at(0.5, -3.6, -5.08, 0.7, 1.3, 0.16, "#ff9f1c");
    at(-1.1, -3.0, -5.14, 0.3, 0.3, 0.1, BLACK);
    // Brass corner caps, front and back, bottom and top.
    for (const x of [-4.2, 3.3]) {
      v.b(x, -8.7, -5.0, 0.9, 0.9, 0.9, BRASS);
      at(x, -2.5, -5.0, 0.9, 0.9, 0.9, BRASS);
    }
    // Two steel latches across the seam, each with a hasp and a keyhole.
    for (const x of [-2.9, 1.9]) {
      v.b(x, -6.0, -5.1, 1.0, 2.6, 0.35, STEEL);
      v.b(x + 0.15, -4.5, -5.3, 0.7, 0.6, 0.25, STEEL_DARK);
      v.b(x + 0.35, -5.5, -5.3, 0.3, 0.5, 0.2, BLACK);
    }
    // The two lures, off a ring on each side of the tray.
    const left = vpart(b, [-4.5 * U, -6.4 * U, -2.6 * U]);
    const right = vpart(b, [4.5 * U, -6.4 * U, -2.6 * U]);
    new Vx(left).b(-0.35, -0.35, -0.35, 0.7, 0.7, 0.7, STEEL);
    new Vx(right).b(-0.35, -0.35, -0.35, 0.7, 0.7, 0.7, STEEL);
    hung(left, "jig");
    hung(right, "spoon");
    tick((t, walking) => {
      const rate = walking ? 8 : 1.5;
      const amp = walking ? 0.3 : 0.06;
      left.rotation.z = Math.sin(t * rate) * amp;
      left.rotation.x = Math.sin(t * rate * 0.8 + 1) * amp * 0.6;
      right.rotation.z = Math.sin(t * rate + 2.4) * amp;
      right.rotation.x = Math.sin(t * rate * 0.8 + 3) * amp * 0.6;
      lid.rotation.x = walking ? Math.abs(Math.sin(t * 9)) * 0.045 : 0;
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
