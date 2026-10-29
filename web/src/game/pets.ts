import { PET_ACT_EMOJI, type PetAct } from "@tokenmaxxing/core/pets.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { typedSwitch } from "hanzio";
import { PET_H, PET_W } from "../art/pets.ts";
import { BURST_MS } from "./emoji.ts";
import { PLAY_MS, type PlayPose, playPose } from "./petplay.ts";
import { petSound } from "./petsound.ts";
import { type Avatar, self, world } from "./world.ts";

/** Each pet's spot in world pixels (top-left). It trails its owner rather than sticking to them. */
const pets = new Map<
  number,
  { x: number; y: number; left: boolean; moving: boolean; asleep: boolean; room: string }
>();

/** Where a pet lies in its bed, as its top-left in world pixels (the bed's tile, a little in from its edge). */
export const bedSpot = ([bx, by]: readonly [number, number]): [number, number] => [
  bx * TILE + 2,
  by * TILE + 2,
];
/** How fast a pet walks to its bed, in pixels a millisecond. */
const WALK = 0.07;

/**
 * Moves `a`'s pet toward its spot: behind them while they walk, beside them while they rest. With `bed`
 * (the owner is in their own office): walks to the bed, and once there stays asleep whatever the owner
 * does.
 */
export function followPet(a: Avatar, px: number, py: number, dt: number, bed?: readonly [number, number]) {
  if (!a.info.look.pet) return null;
  if (bed) return sleepPet(a, px, py, dt, bedSpot(bed));
  const resting = a.state !== "idle";
  const [tx, ty]: [number, number] = resting
    ? [px + 13, py + 6]
    : typedSwitch(a.facing, {
        right: () => [px - 9, py + 6],
        left: () => [px + 13, py + 6],
        down: () => [px + 2, py - 4],
        up: () => [px + 2, py + 13],
      });
  let pet = pets.get(a.info.id);
  // New, or the owner jumped (a door, a warp): appear at the spot.
  if (!pet || pet.room !== world.room || Math.hypot(tx - pet.x, ty - pet.y) > 3 * TILE) {
    pet = { x: tx, y: ty, left: a.facing === "left", moving: false, asleep: false, room: world.room };
    pets.set(a.info.id, pet);
  }
  pet.asleep = false;
  const k = 1 - Math.exp(-dt / 140);
  const dx = (tx - pet.x) * k;
  pet.x += dx;
  pet.y += (ty - pet.y) * k;
  pet.moving = Math.hypot(tx - pet.x, ty - pet.y) > 1;
  // Face where it's going; at rest, face its owner.
  if (Math.abs(dx) > 0.05) pet.left = dx < 0;
  else if (resting) pet.left = true;
  return pet;
}

/** Walks the pet to its bed (from where it was trailing its owner in) and curls it up there. */
function sleepPet(a: Avatar, px: number, py: number, dt: number, [bx, by]: readonly [number, number]) {
  let pet = pets.get(a.info.id);
  if (!pet || pet.room !== world.room) {
    // Came in with its owner: starts where it would trail them.
    pet = { x: px - 9, y: py + 6, left: a.facing === "left", moving: false, asleep: false, room: world.room };
    pets.set(a.info.id, pet);
  }
  const dx = bx - pet.x;
  const dy = by - pet.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, WALK * dt);
  if (d > 0.5) {
    pet.x += (dx / d) * step;
    pet.y += (dy / d) * step;
    if (Math.abs(dx) > 0.5) pet.left = dx < 0;
  }
  pet.moving = d - step > 0.5;
  pet.asleep = !pet.moving;
  if (pet.asleep) {
    [pet.x, pet.y, pet.left] = [bx, by, true];
  }
  return pet;
}

/** Drops the pets of people who left the room. */
export function prunePets(): void {
  for (const id of pets.keys()) if (!world.avatars.has(id)) pets.delete(id);
  for (const id of reactions.keys()) if (!world.avatars.has(id)) reactions.delete(id);
}

/** What each owner's pet is reacting to (`petPlay`), and when it began. */
const reactions = new Map<number, { act: PetAct; at: number }>();
/** How far (tiles) someone else's pet can be and still be heard. */
const HEARD = 8;

/** `ownerId`'s pet reacts (the server sent `petPlay`, so it was allowed): it moves, hearts float up and it chirps. */
export function reactPet(ownerId: number, act: PetAct): void {
  const owner = world.avatars.get(ownerId);
  if (!owner?.info.look.pet) return;
  reactions.set(ownerId, { act, at: performance.now() });
  const me = self();
  if (ownerId === world.selfId) petSound(act, false);
  else if (me && Math.hypot(owner.x - me.x, owner.y - me.y) <= HEARD) petSound(act, true);
}

/** The reaction of `ownerId`'s pet at `now`: its pose and hearts, or null when it isn't reacting. */
export function reactionOf(
  ownerId: number,
  now: number,
): { act: PetAct; at: number; age: number; pose: PlayPose; emojis: string[] } | null {
  const r = reactions.get(ownerId);
  if (!r) return null;
  const age = now - r.at;
  if (age >= Math.max(PLAY_MS[r.act], BURST_MS)) {
    reactions.delete(ownerId);
    return null;
  }
  return {
    act: r.act,
    at: r.at,
    age,
    pose: playPose(r.act, age / PLAY_MS[r.act]),
    emojis: PET_ACT_EMOJI[r.act],
  };
}

/** The tile my pet stands on (from where it was last drawn), to click it. */
export function myPetTile(): [number, number] | null {
  const pet = pets.get(world.selfId);
  return pet && pet.room === world.room
    ? [Math.floor((pet.x + PET_W / 2) / TILE), Math.floor((pet.y + PET_H - 1) / TILE)]
    : null;
}
