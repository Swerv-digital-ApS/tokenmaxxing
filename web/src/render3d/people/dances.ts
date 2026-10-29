import { type DanceMove, tempoOf } from "@tokenmaxxing/core/dances.ts";

/**
 * The dances' moves for the 3D people (`Avatar`'s "dance" pose), as pure numbers so they can be tested apart from
 * three.js. Angles are the rig's own: an arm or leg hangs straight down from its joint, `[x, y, z]` in that order
 * (three's default "XYZ"). On the right-hand limb (the one at +x): x below 0 swings it forward and up, z above 0
 * raises it out to the side, and y turns a raised arm forward (below 0) or back. `mirror` gives the other side.
 * A knee above 0 bends back. The head's x above 0 looks down, its y above 0 turns to +x.
 */

export type V3 = [number, number, number];

export interface DancePose {
  /** The body over the feet: lifted, slid sideways (x) and forward (z), turned (y), leant forward (x) and tilted (z). */
  lift: number;
  slide: number;
  step: number;
  turn: number;
  lean: number;
  tilt: number;
  head: V3;
  /** The limb at -x, and the one at +x. */
  armL: V3;
  armR: V3;
  legL: V3;
  legR: V3;
  kneeL: number;
  kneeR: number;
  /** Eyes shut (the levitation's calm). */
  shut: boolean;
}

export const newDancePose = (): DancePose => ({
  lift: 0,
  slide: 0,
  step: 0,
  turn: 0,
  lean: 0,
  tilt: 0,
  head: [0, 0, 0],
  armL: [0, 0, 0],
  armR: [0, 0, 0],
  legL: [0, 0, 0],
  legR: [0, 0, 0],
  kneeL: 0,
  kneeR: 0,
  shut: false,
});

/** The same angles on the limb at -x. */
const mirror = (v: V3, out: V3): void => {
  out[0] = v[0];
  out[1] = -v[1];
  out[2] = -v[2];
};
const set = (v: V3, x: number, y: number, z: number): void => {
  v[0] = x;
  v[1] = y;
  v[2] = z;
};
/** Both arms the same, mirrored. */
const arms = (p: DancePose, x: number, y: number, z: number): void => {
  set(p.armR, x, y, z);
  mirror(p.armR, p.armL);
};

const TAU = Math.PI * 2;
/** -1 or 1, flipping every `period` beats. */
const square = (b: number, period = 1): number => (Math.floor(b / period) % 2 === 0 ? 1 : -1);
/** From 0 up to 1 over the first `k` of each beat and held: a move that snaps into place, then holds it. */
const snap = (b: number, k = 0.25): number => {
  const f = b - Math.floor(b);
  const u = Math.min(1, f / k);
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * Bends a leg by `a` at the hip and twice that back at the knee, so the foot stays under the hip: the body
 * drops by what the leg loses (`hip`, the hip's height). Returns the drop.
 */
function bend(p: DancePose, side: "L" | "R", a: number, hip: number): number {
  const leg = side === "L" ? p.legL : p.legR;
  leg[0] = -a;
  if (side === "L") p.kneeL = 2 * a;
  else p.kneeR = 2 * a;
  return hip * (1 - Math.cos(a));
}
/** Both knees bent by `a`, the body lowered to keep the feet on the floor. */
function crouch(p: DancePose, a: number, hip: number): void {
  const drop = bend(p, "L", a, hip);
  bend(p, "R", a, hip);
  p.lift -= drop;
}

/**
 * Writes the pose for `move`, `t` seconds in (plus `offset`, so a crowd isn't in step), into `p`. `hip` and `height`
 * are the dancer's, so a crouch keeps their feet down and a headspin puts their head on the floor.
 */
export function dancePose(
  move: DanceMove,
  t: number,
  hip: number,
  height: number,
  p: DancePose = newDancePose(),
): DancePose {
  Object.assign(p, {
    lift: 0,
    slide: 0,
    step: 0,
    turn: 0,
    lean: 0,
    tilt: 0,
    kneeL: 0,
    kneeR: 0,
    shut: false,
  });
  for (const v of [p.head, p.armL, p.armR, p.legL, p.legR]) set(v, 0, 0, 0);
  const b = t * tempoOf(move);
  const s = Math.sin(b * Math.PI);
  const s2 = Math.sin(b * TAU);
  const bounce = Math.abs(s);

  switch (move) {
    // Side to side on the beat, the stepping knee up, arms pumping the other way.
    case "groove": {
      p.slide = 0.05 * s;
      p.turn = 0.25 * s;
      p.tilt = -0.05 * s;
      p.lift = 0.03 * bounce;
      bend(p, s > 0 ? "L" : "R", 0.45 * bounce, 0);
      set(p.armR, -0.7 - 0.35 * s, 0, 0.25);
      set(p.armL, -0.7 + 0.35 * s, 0, -0.25);
      p.head[0] = 0.08 * bounce;
      p.head[2] = 0.08 * s;
      break;
    }
    // Palms up, pushing the ceiling on every beat.
    case "roof": {
      arms(p, -0.25, 0, 2.35 + 0.45 * Math.abs(s2));
      crouch(p, 0.25 * (1 - Math.abs(s2)), hip);
      p.head[0] = -0.15 * Math.abs(s2);
      p.turn = 0.2 * s;
      break;
    }
    // Both arms swing across together, in front one way and behind the other; the hips go the opposite way.
    case "floss": {
      const k = Math.sin(b * Math.PI);
      const front = Math.cos(b * Math.PI);
      set(p.armR, -0.6 * front, 0, 0.75 * k);
      set(p.armL, 0.6 * front, 0, 0.75 * k);
      p.slide = -0.08 * k;
      p.tilt = 0.14 * k;
      p.turn = -0.15 * k;
      p.head[2] = 0.06 * k;
      break;
    }
    // Snap into a dab, hold it, snap into the other side.
    case "dab": {
      const side = square(b, 1);
      const k = snap(b, 0.2);
      const out: V3 = [lerp(0, -0.3, k), 0, lerp(0.15, 2.25, k)];
      const across: V3 = [lerp(0, -0.55, k), lerp(0, -2.1, k), lerp(0.15, Math.PI / 2, k)];
      if (side > 0) {
        set(p.armR, ...out);
        mirror(across, p.armL);
        p.head[1] = lerp(0, 0.55, k);
      } else {
        mirror(out, p.armL);
        set(p.armR, ...across);
        p.head[1] = lerp(0, -0.55, k);
      }
      p.head[0] = lerp(0, 0.45, k);
      p.lean = 0.15 * k;
      p.tilt = 0.08 * side * k;
      crouch(p, 0.15 * k, hip);
      break;
    }
    // Stiff joints, moving only on the half beat: forearms up, turns in clicks.
    case "robot": {
      const q = Math.floor(b * 2);
      const a = (q % 4) - 1.5;
      set(p.armR, -Math.PI / 2 + 0.35 * square(b, 1), 0, 0.15);
      set(p.armL, -Math.PI / 2 - 0.35 * square(b, 1), 0, -0.15);
      p.turn = 0.18 * a;
      p.head[1] = -0.3 * square(b, 2);
      p.head[0] = 0.12 * square(b, 0.5);
      p.lift = q % 2 === 0 ? 0.015 : 0;
      break;
    }
    // A hand behind the head, the other arm out in front, ticking round and sweeping back.
    case "sprinkler": {
      const u = (b / 4) % 1;
      const ticks = 8;
      const turn =
        u < 0.8 ? -0.8 + (1.6 * Math.floor((u / 0.8) * ticks)) / (ticks - 1) : 0.8 - 1.6 * ((u - 0.8) / 0.2);
      p.turn = turn;
      set(p.armR, -Math.PI / 2, 0, 0.1);
      set(p.armL, -0.4, 0, -2.75);
      p.head[2] = 0.15;
      bend(p, "R", 0.35, 0);
      p.lift = u < 0.8 ? 0.02 * snap(u * ticks * 1.25) : 0;
      break;
    }
    // Flap for two beats, then wiggle down low.
    case "chicken": {
      const phrase = b % 4;
      if (phrase < 2) {
        arms(p, 0.25, 0, 0.35 + 0.7 * Math.abs(Math.sin(b * Math.PI * 2)));
        p.head[0] = 0.15 * Math.sin(b * Math.PI * 4);
        p.lift = 0.02 * Math.abs(s2);
      } else {
        crouch(p, 0.55, hip);
        p.tilt = 0.15 * Math.sin(b * Math.PI * 3);
        p.turn = 0.2 * Math.sin(b * Math.PI * 3);
        arms(p, 0.2, 0, 0.5);
      }
      break;
    }
    // Up to the ceiling, down to the floor, a hand on the hip.
    case "disco": {
      const up = square(b, 1) > 0;
      const k = snap(b, 0.3);
      set(p.armR, up ? lerp(-0.4, -0.3, k) : -0.35, 0, up ? lerp(-0.5, 2.6, k) : lerp(2.6, -0.5, k));
      set(p.armL, 0.25, 0, -0.55);
      p.tilt = (up ? -0.1 : 0.08) * k;
      p.turn = (up ? 0.2 : -0.1) * k;
      p.head[0] = up ? -0.25 * k : 0.2 * k;
      bend(p, up ? "L" : "R", 0.3, 0);
      p.lift = 0.02 * bounce;
      break;
    }
    // A knee up while the other foot slides back; arms pumping, going nowhere.
    case "running": {
      const side = s > 0;
      const k = bounce;
      const lift = -1.1 * k;
      const slide = 0.35 * k;
      if (side) {
        set(p.legL, lift, 0, 0);
        p.kneeL = 1.3 * k;
        set(p.legR, slide, 0, 0);
      } else {
        set(p.legR, lift, 0, 0);
        p.kneeR = 1.3 * k;
        set(p.legL, slide, 0, 0);
      }
      set(p.armR, -0.9 + 0.5 * s, 0, 0.15);
      set(p.armL, -0.9 - 0.5 * s, 0, -0.15);
      p.lift = 0.05 * k;
      p.lean = 0.12;
      p.head[0] = 0.1 * k;
      break;
    }
    // Big nods, one hand making horns.
    case "headbang": {
      const nod = Math.abs(s2);
      p.head[0] = -0.2 + 0.7 * nod;
      p.lean = 0.25 * nod;
      set(p.armR, -0.3, 0, 2.6 + 0.2 * nod);
      set(p.armL, -0.6 - 0.5 * nod, 0, -0.25);
      crouch(p, 0.2 + 0.1 * nod, hip);
      break;
    }
    // Heel taps on alternate feet, swinging arms, and every fourth beat the glasses hands.
    case "griddy": {
      const heel = square(b, 0.5);
      const glasses = Math.floor(b) % 4 === 3;
      if (heel > 0) {
        set(p.legR, -0.5, 0, 0);
        p.kneeL = 0.4;
      } else {
        set(p.legL, -0.5, 0, 0);
        p.kneeR = 0.4;
      }
      if (glasses) {
        arms(p, -2.7, 0, -0.35);
        p.head[0] = -0.1;
      } else {
        set(p.armR, -0.8 * heel, 0, 0.2);
        set(p.armL, 0.8 * heel, 0, -0.2);
      }
      p.lean = 0.2;
      p.lift = 0.03 * Math.abs(Math.sin(b * TAU));
      p.step = 0.08 * Math.sin((b * Math.PI) / 4);
      p.turn = 0.1 * heel;
      break;
    }
    // Gliding backwards on alternate toes, there and back.
    case "moonwalk": {
      const u = (b / 8) % 1;
      p.step = 0.3 - 0.6 * (u < 0.5 ? u * 2 : 2 - u * 2);
      const toe = square(b, 1);
      if (toe > 0) {
        set(p.legL, -0.25, 0, 0);
        p.kneeL = 0.75;
      } else {
        set(p.legR, -0.25, 0, 0);
        p.kneeR = 0.75;
      }
      set(p.armR, 0.15 * toe, 0, 0.12);
      set(p.armL, -0.15 * toe, 0, -0.12);
      p.head[2] = 0.1;
      p.lean = -0.05;
      break;
    }
    // Hands on the reins, a skipping trot; every eighth bar the lasso.
    case "horse": {
      const lasso = Math.floor(b / 8) % 2 === 1;
      const hop = Math.abs(s2);
      bend(p, s2 > 0 ? "L" : "R", 0.5 * hop, 0);
      p.lift = 0.07 * hop;
      if (lasso) {
        set(p.armR, -0.3, t * 14, 2.75);
        set(p.armL, -1.2, 0, 0.25);
      } else {
        set(p.armR, -1.3 + 0.15 * s2, 0, -0.3);
        set(p.armL, -1.3 + 0.15 * s2, 0, 0.3);
      }
      p.turn = 0.15 * s;
      p.head[0] = 0.1 * hop;
      break;
    }
    // Upside down on the head, spinning, legs out in a V.
    case "headspin": {
      p.lean = Math.PI;
      p.lift = height;
      p.turn = t * 9;
      set(p.legR, 0, 0, 0.55 + 0.1 * Math.sin(t * 9));
      mirror(p.legR, p.legL);
      arms(p, 0, 0, 0.7);
      break;
    }
    // The boat kid: rolling hands out front, a calm sway, a cool nod; every fourth bar both hands point the way.
    case "boat": {
      const point = Math.floor(b / 4) % 4 === 3;
      if (point) {
        const k = snap(b, 0.35);
        set(p.armR, lerp(-1.1, -1.55, k), 0, lerp(0.35, -0.15, k));
        set(p.armL, lerp(-1.1, -1.55, k), 0, lerp(-0.35, 0.15, k));
        p.head[0] = -0.1 * k;
      } else {
        set(p.armR, -1.1 + 0.35 * Math.sin(b * TAU), 0, 0.4 + 0.3 * Math.cos(b * TAU));
        set(p.armL, -1.1 + 0.35 * Math.sin(b * TAU + Math.PI), 0, -0.4 - 0.3 * Math.cos(b * TAU + Math.PI));
        p.head[0] = 0.12 * Math.max(0, s);
      }
      p.tilt = 0.06 * Math.sin(b * Math.PI * 0.5);
      p.turn = 0.15 * Math.sin(b * Math.PI * 0.25);
      p.head[2] = -0.08;
      crouch(p, 0.18 + 0.08 * bounce, hip);
      break;
    }
    // Arms crossed, weight on one hip, a slow nod.
    case "unbothered": {
      set(p.armR, 0.35, -2.05, Math.PI / 2);
      mirror(p.armR, p.armL);
      p.armL[0] = 0.2;
      p.head[0] = 0.15 * Math.max(0, Math.sin(b * Math.PI));
      p.head[1] = 0.3;
      p.head[2] = -0.06;
      p.lean = -0.06;
      p.tilt = 0.06;
      bend(p, "L", 0.18, 0);
      break;
    }
    // Charging: low, fists by the hips, shaking harder and harder; then the release, tall and wide.
    case "powerup": {
      const u = (b / 6) % 1;
      if (u < 0.75) {
        const k = u / 0.75;
        const shake = (0.008 + 0.02 * k) * Math.sin(t * 70);
        crouch(p, 0.45, hip);
        arms(p, 0.35, 0, 0.4);
        p.lift += Math.abs(shake);
        p.slide = shake;
        p.head[0] = -0.25 - 0.1 * k;
        p.lean = 0.12;
      } else {
        const k = snap((u - 0.75) * 4, 0.3);
        arms(p, -0.2, 0, lerp(0.4, 1.35, k));
        p.head[0] = -0.4 * k;
        p.lean = -0.1 * k;
        p.lift = 0.06 * k;
      }
      break;
    }
    // A hand sign held before the face, still as a statue, breathing.
    case "domain": {
      set(p.armR, -2.35, 0, -0.45);
      set(p.armL, -1.25, 0, 0.35);
      p.head[0] = -0.05;
      p.head[1] = 0.12 * Math.sin(b * Math.PI * 0.25);
      p.lift = 0.006 * Math.sin(b * Math.PI);
      break;
    }
    // Cross-legged in the air, eyes shut, slowly turning.
    case "levitate": {
      set(p.legR, -1.45, 0, 0.75);
      mirror(p.legR, p.legL);
      p.kneeL = p.kneeR = 2.3;
      arms(p, -0.55, 0, 0.55);
      p.lift = 0.7 - hip + 0.08 * Math.sin(b * Math.PI);
      p.turn = 0.35 * Math.sin(b * Math.PI * 0.2);
      p.head[0] = -0.05;
      p.shut = true;
      break;
    }
  }
  return p;
}
