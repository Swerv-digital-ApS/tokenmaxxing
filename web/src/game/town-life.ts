import { PLAZA } from "@tokenmaxxing/core/maps.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { graphics } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { PigeonMotion, type PigeonPose } from "./animal-motion.ts";
import type { Frame } from "./frame.ts";
import { skyNow } from "./sky.ts";
import { self, world } from "./world.ts";

let animalCache: {
  map: typeof world.map;
  day: string;
  cat: [number, number];
  birds: [number, number][];
} | null = null;
/** The cat changes sleeping spots daily. Birds share fixed landmarks, but react locally to passers-by. */
export function townAnimals(): { cat: [number, number]; birds: [number, number][] } | null {
  if (world.room !== "town") return null;
  const day = dayKey(skyNow());
  if (animalCache?.map === world.map && animalCache.day === day) return animalCache;
  const tiles = world.map
    .find(":")
    .filter(([x, y]) => x > PLAZA.left && x < PLAZA.right && y > PLAZA.top && y < PLAZA.bottom);
  if (tiles.length < 9) return null;
  const seed = [...day].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  birdMotion = [new PigeonMotion(), new PigeonMotion(), new PigeonMotion()];
  animalCache = {
    map: world.map,
    day,
    cat: tiles[seed % tiles.length]!,
    birds: [tiles[2]!, tiles[5]!, tiles[8]!],
  };
  return animalCache;
}

let petUntil = 0;
let birdMotion = [new PigeonMotion(), new PigeonMotion(), new PigeonMotion()];
export function animalAt(x: number, y: number): "cat" | "bird" | null {
  const animals = townAnimals();
  if (!animals) return null;
  if (animals.cat[0] === x && animals.cat[1] === y) return "cat";
  return animals.birds.some(([bx, by]) => bx === x && by === y) ? "bird" : null;
}
export function interactAnimal(x: number, y: number): boolean {
  const animal = animalAt(x, y);
  if (!animal) return false;
  if (animal === "cat") {
    petUntil = performance.now() + 2500;
    hud.set({ dialog: "The town cat purrs and leans into your hand. 🐈" });
  } else {
    const animals = townAnimals()!;
    const index = animals.birds.findIndex(([bx, by]) => bx === x && by === y);
    if (index >= 0) birdMotion[index]!.scare(performance.now());
  }
  return true;
}
export function animalMotion(index: number, x: number, y: number, now: number): PigeonPose {
  const me = self();
  return birdMotion[index]!.sample(now, !!me && Math.hypot(me.x - x, me.y - y) < 1.3, index);
}
export const catPetted = (now: number): boolean => now < petUntil;

let lastProp = "";
let taps = 0;
export function interactTownProp(x: number, y: number): boolean {
  if (world.room !== "town") return false;
  const ch = world.map.at(x, y);
  if (ch !== "T" && ch !== "^" && ch !== "L") return false;
  const key = `${x},${y}`;
  taps = key === lastProp ? taps + 1 : 1;
  lastProp = key;
  const text =
    ch === "T"
      ? taps >= 3
        ? "A tiny door in the trunk opens. A note reads: you found the tree's secret. 🌳"
        : "The tree rustles. Something seems to be tucked inside."
      : ch === "^"
        ? taps >= 3
          ? "A tiny paper crown lies inside the bush. You leave it for its owner. 👑"
          : "The bush rustles suspiciously."
        : "The lamp gives a cheerful little hum. ✨";
  hud.set({ dialog: text });
  return true;
}

export function drawTownAnimals({ g, items, now }: Frame): void {
  const animals = townAnimals();
  if (!animals) return;
  const [cx, cy] = animals.cat;
  items.push({
    y: (cy + 1) * TILE - 1,
    draw: () => {
      const x = cx * TILE,
        y = cy * TILE;
      // Orange tabby: pointed ears, cream muzzle and paws, two eyes and a pink nose.
      g.fillStyle = "#93512e";
      g.fillRect(x + 3, y + 13, 11, 2);
      g.fillStyle = "#d78b45";
      g.fillRect(x + 4, y + 8, 9, 6);
      g.fillRect(x + 3, y + 5, 8, 6);
      g.fillRect(x + 3, y + 3, 2, 3);
      g.fillRect(x + 9, y + 3, 2, 3);
      g.fillRect(x + 13, y + 8, 2, 5);
      g.fillRect(x + 12, y + 7, 3, 2);
      g.fillStyle = "#e6a29a";
      g.fillRect(x + 4, y + 4, 1, 1);
      g.fillRect(x + 9, y + 4, 1, 1);
      g.fillStyle = "#93512e";
      g.fillRect(x + 6, y + 5, 1, 2);
      g.fillRect(x + 10, y + 11, 2, 1);
      g.fillRect(x + 14, y + 9, 1, 1);
      g.fillStyle = "#fff0d1";
      g.fillRect(x + 4, y + 13, 3, 2);
      g.fillRect(x + 9, y + 13, 3, 2);
      g.fillRect(x + 5, y + 9, 5, 2);
      g.fillStyle = "#302d32";
      g.fillRect(x + 4, y + 7, 2, 1);
      g.fillRect(x + 8, y + 7, 2, 1);
      g.fillStyle = "#cf7d83";
      g.fillRect(x + 6, y + 9, 2, 1);
      if (catPetted(now)) {
        g.fillStyle = "#f482a1";
        g.fillRect(x + 10, y + 1, 3, 3);
      }
    },
  });
  const calm = graphics.effective().reduceMotion;
  animals.birds.forEach(([bx, by], i) => {
    const pose = animalMotion(i, bx, by, now);
    const direction = i % 2 ? 1 : -1;
    const groundX = bx * TILE + 8 + pose.offset * direction * 11;
    const groundY = by * TILE + 12 + pose.offset * 3;
    items.push({
      y: groundY + 3,
      draw: () => {
        const x = Math.round(groundX),
          y = Math.round(groundY - pose.lift * TILE);
        // The shadow stays on the paving while the bird takes a short, flapping hop.
        g.fillStyle = "#00000025";
        g.fillRect(x - 3, Math.round(groundY + 2), 7, 2);
        g.save();
        g.translate(x, y);
        g.scale(direction * (pose.returning ? -1 : 1), 1);
        g.fillStyle = "#cf8a83";
        g.fillRect(-2, 2, 1, 2);
        g.fillRect(1, 2, 1, 2);
        g.fillStyle = "#8897a4";
        g.fillRect(-4, -2, 7, 5);
        g.fillStyle = "#505d70";
        g.fillRect(-6, 0, 3, 2);
        const peck = calm ? 0 : Math.round(pose.peck * 2);
        g.fillStyle = "#63978d";
        g.fillRect(1, -4 + peck, 3, 3);
        g.fillStyle = "#738394";
        g.fillRect(1, -6 + peck, 4, 3);
        g.fillStyle = "#d5b274";
        g.fillRect(5, -4 + peck, 2, 1);
        g.fillStyle = "#202936";
        g.fillRect(3, -5 + peck, 1, 1);
        const wing = calm ? 0 : Math.round(pose.wing * 6);
        g.fillStyle = "#a9b5bf";
        g.fillRect(-3, -2 - wing, 4, 3 + wing);
        g.fillStyle = "#536174";
        g.fillRect(-3, -1 - wing, 3, 1);
        g.restore();
      },
    });
  });
}
