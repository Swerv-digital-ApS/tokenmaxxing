import type { Rot } from "@tokenmaxxing/core/office.ts";
import { type Drop, furnitureFits, pieceOfDrop, type RoomId } from "@tokenmaxxing/core/world.ts";

// MARK: Where a piece can stand

/**
 * Whether a piece (`item`, `furn.<ch>`) turned `rot` could stand with its top-left tile on `t` in `room` (whose floor is
 * `setDrops`'s): the very rules the server checks (`furnitureFits`), so the green and the red are what it will
 * say. `moving` is the drop being moved (its own tile is free for it); `people` are everyone in the room.
 */
export function ghostFits(
  room: RoomId,
  item: string,
  moving: Drop | null,
  t: { x: number; y: number },
  people: readonly { x: number; y: number }[],
  rot: Rot = 0,
): boolean {
  const piece = pieceOfDrop({ item });
  if (!piece) return false;
  const d: Drop = moving ?? { id: -1, item, room, x: t.x, y: t.y, by: 0, at: 0 };
  return furnitureFits(room, d, piece, t.x, t.y, people, rot);
}

// MARK: Undo

/** What one step of furnishing did, with what is needed to take it back. */
export type Undoable =
  /** Took a piece off the floor: undo puts it down on the same tile (`co`: from the storeroom). */
  | { kind: "take"; room: RoomId; id: number; item: string; x: number; y: number; co?: number }
  /** Moved or turned a piece from `(x, y)`, turned as `rot` says: undo puts it back so. */
  | { kind: "move"; room: RoomId; id: number; x: number; y: number; rot: Rot }
  /** Put a piece down (`id`): undo takes it back. */
  | { kind: "place"; room: RoomId; id: number; item: string; co?: number };

export const UNDO_DEPTH = 10;

/** The last few furnishing steps of this session, newest last. */
export class UndoStack {
  private steps: Undoable[] = [];

  get size(): number {
    return this.steps.length;
  }

  push(step: Undoable): void {
    this.steps.push(step);
    if (this.steps.length > UNDO_DEPTH) this.steps.shift();
  }

  peek(): Undoable | undefined {
    return this.steps.at(-1);
  }

  pop(): Undoable | undefined {
    return this.steps.pop();
  }

  /** A piece taken and put down again is a new row: the steps that name the old one now mean the new one. */
  remap(from: number, to: number): void {
    this.steps = this.steps.map((s) => (s.id === from ? { ...s, id: to } : s));
  }

  clear(): void {
    this.steps = [];
  }
}
