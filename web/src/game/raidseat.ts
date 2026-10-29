import { canSit, ownSeatAt } from "@tokenmaxxing/core/raidseat.ts";
import type { Facing, StepResult } from "@tokenmaxxing/core/world.ts";
import { conn } from "../net.ts";
import { hud } from "../store.ts";
import { seatTile } from "./raid.ts";
import { self, world } from "./world.ts";

/** The pet's location for its raid shots, in 3D world coordinates. */
export const raidPet = { at: null as [number, number] | null };

export function mySeat(): [number, number] | null {
  return world.room === "dungeon" ? seatTile(world.selfId) : null;
}

export function seated(): boolean {
  return world.room === "dungeon" && self()?.state === "sit";
}

export function seatedAt(): [number, number] | null {
  const me = self();
  return seated() && me ? [me.x, me.y] : null;
}

/** Apply the server's correction; the same state is broadcast to the rest of the room. */
function apply(result: Promise<StepResult>): void {
  void result
    .then((r) => {
      if (!r) return;
      if ("notice" in r) return void hud.set({ dialog: r.notice });
      const me = self();
      if (me && r.room === world.room)
        Object.assign(me, { x: r.x, y: r.y, facing: r.facing, state: r.state, from: null });
    })
    .catch(() => {});
}

export function standUp(): void {
  if (seated()) apply(conn.step("up"));
}

export function sitsAt(x: number, y: number): boolean {
  const me = self();
  const seat = mySeat();
  return (
    !!me &&
    canSit(world.room, seat, me.state) &&
    ownSeatAt(seat, x, y) &&
    !!seat &&
    Math.abs(me.x - seat[0]) + Math.abs(me.y - seat[1]) === 1
  );
}

export function sit(x: number, y: number): boolean {
  if (!sitsAt(x, y)) return false;
  const me = self()!;
  const seat = mySeat()!;
  const dx = seat[0] - me.x;
  const dy = seat[1] - me.y;
  const dir: Facing = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
  apply(conn.sit(dir));
  return true;
}
