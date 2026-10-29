/**
 * Dancing, as both renderers see it: who is dancing what (`PlayerInfo.dance`), who is in an aura battle, and the
 * 2D game's take on each move. The 3D moves are `render3d/people/dances.ts`. Pure: no canvas, no DOM.
 */
import { type Dance, type DanceMove, danceAt, inBattle, tempoOf } from "@tokenmaxxing/core/dances.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import type { Pose } from "../art/characters.ts";
import type { Avatar } from "./world.ts";

/** The dance `a` is doing right now: only on their feet, and never while a step is under way. */
export function danceOf(a: Pick<Avatar, "info" | "state">): Dance | undefined {
  return a.state === "idle" && a.info.dance ? danceAt(a.info.dance) : undefined;
}

/** The ids of everyone dancing within `BATTLE_TILES` of another dancer: they are in an aura battle. */
export function battlers(avatars: Iterable<Pick<Avatar, "info" | "state" | "x" | "y">>): Set<number> {
  const dancing = [...avatars].filter((a) => danceOf(a));
  const out = new Set<number>();
  for (let i = 0; i < dancing.length; i++)
    for (let j = i + 1; j < dancing.length; j++)
      if (inBattle(dancing[i]!, dancing[j]!)) {
        out.add(dancing[i]!.info.id);
        out.add(dancing[j]!.info.id);
      }
  return out;
}

/** `#rrggbb` as `r,g,b`, for `drawGlow`. */
export const rgbOf = (hex: string): string =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(",");

/** A 2D frame of a dance: which way and in which frame the sprite is drawn, and how it's moved, turned and stretched. */
export interface Dance2D {
  facing: Facing;
  pose: Pose;
  /** Whole pixels, right and down. */
  dx: number;
  dy: number;
  /** Mirrored left to right. */
  flip: boolean;
  /** Radians, about the feet (a headspin: about the middle, upside down). */
  angle: number;
  /** Height over width: below 1 squashes, above stretches. */
  squash: number;
}

const SPIN: readonly Facing[] = ["down", "right", "up", "left"];
/** The 16-pixel sprite's version of `move`, `t` seconds in, facing `facing` when it doesn't turn. */
export function dance2D(move: DanceMove, t: number, facing: Facing): Dance2D {
  const b = t * tempoOf(move);
  const beat = Math.floor(b);
  const odd = beat % 2 === 1;
  const s = Math.sin(b * Math.PI);
  const out: Dance2D = { facing, pose: "stand", dx: 0, dy: 0, flip: false, angle: 0, squash: 1 };
  switch (move) {
    case "groove":
    case "griddy":
      out.dx = s > 0 ? 1 : -1;
      out.pose = odd ? "walkA" : "walkB";
      out.dy = -Math.round(Math.abs(s));
      break;
    case "roof":
    case "headbang":
      out.dy = -Math.round(2 * Math.abs(Math.sin(b * Math.PI * 2)));
      out.squash = 1 + 0.08 * Math.abs(Math.sin(b * Math.PI * 2));
      break;
    case "floss":
      out.dx = Math.round(1.5 * s);
      out.pose = Math.floor(b * 2) % 2 ? "walkA" : "walkB";
      break;
    case "dab":
    case "disco":
      out.flip = odd;
      out.angle = (odd ? -1 : 1) * 0.18;
      break;
    case "robot":
      out.facing = SPIN[Math.floor(b * 2) % 4 === 3 ? 3 : Math.floor(b * 2) % 4 === 1 ? 1 : 0]!;
      break;
    case "sprinkler":
      out.facing = Math.floor(b * 2) % 8 < 4 ? "right" : "left";
      out.dy = Math.floor(b * 4) % 2 ? -1 : 0;
      break;
    case "chicken":
      out.squash = beat % 4 < 2 ? 1 + 0.1 * Math.abs(Math.sin(b * Math.PI * 2)) : 0.85;
      out.dx = beat % 4 < 2 ? 0 : Math.round(Math.sin(b * Math.PI * 3));
      break;
    case "running":
      out.pose = Math.floor(b * 2) % 2 ? "walkA" : "walkB";
      out.dy = -Math.round(Math.abs(s));
      break;
    case "moonwalk": {
      const u = (b / 8) % 1;
      out.dx = Math.round(4 - 8 * (u < 0.5 ? u * 2 : 2 - u * 2));
      out.facing = u < 0.5 ? "right" : "left";
      out.pose = odd ? "walkA" : "walkB";
      break;
    }
    case "horse":
      out.dy = -Math.round(2 * Math.abs(Math.sin(b * Math.PI * 2)));
      out.pose = odd ? "walkA" : "walkB";
      break;
    case "headspin":
      out.angle = Math.PI;
      out.facing = SPIN[Math.floor(t * 8) % 4]!;
      break;
    case "boat":
      out.dx = Math.round(Math.sin(b * Math.PI * 0.5));
      out.angle = 0.06 * Math.sin(b * Math.PI * 0.5);
      break;
    case "unbothered":
    case "domain":
      out.squash = 1 + 0.02 * Math.sin(b * Math.PI);
      break;
    case "powerup": {
      const charging = (b / 6) % 1 < 0.75;
      out.squash = charging ? 0.9 : 1.08;
      out.dx = charging ? Math.round(Math.sin(t * 70)) : 0;
      break;
    }
    case "levitate":
      out.dy = -4 - Math.round(1.5 * Math.sin(b * Math.PI));
      break;
  }
  return out;
}
