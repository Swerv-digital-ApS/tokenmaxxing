import { canTurn, type Rot, rotOf, turnedAround, wallRowOf } from "@tokenmaxxing/core/office.ts";
import {
  DIRS,
  type Drop,
  ownerOfOffice,
  ownPieceAt,
  pieceOfDrop,
  type RoomId,
} from "@tokenmaxxing/core/world.ts";
import { conn, refreshMe, refreshWallet, town } from "../net.ts";
import { hud } from "../store.ts";
import { viewHooks } from "./camera.ts";
import { ghostFits, UndoStack } from "./furniture-logic.ts";
import { send } from "./input.ts";
import type { Tile } from "./renderer.ts";
import { pickTile } from "./stage.ts";
import { roomName, self, world } from "./world.ts";

/**
 * Putting furniture down: moving a piece you may take (M), or placing one from the bag or the storeroom. All
 * of it is one mode: a see-through copy of the piece follows the pointer, or the tile you face as you walk
 * (green where it can stand, red where it cannot); a click or E puts it down, Esc leaves things as they were.
 * F turns a piece you are moving, or one you face, a quarter turn clockwise (four presses to come full circle).
 * Nothing is spent until the server says so. Both renderers draw it: 3D through `viewHooks.ghost`, 2D from `ghost`.
 */
export type GhostMode = { kind: "move"; drop: Drop } | { kind: "place"; item: string; company: boolean };

export const ghost: {
  mode: GhostMode | null;
  aim: Tile | null;
  fits: boolean;
  /** The pose (tile and facing) last seen, so walking aims it at the tile you face. */
  pose: string;
  /** How far it is turned while moving it (F): quarter turns clockwise. */
  rot: Rot;
  /** A piece to place once we are in our own office. */
  pending: string | null;
  room: RoomId | null;
} = { mode: null, aim: null, fits: false, pose: "", rot: 0, pending: null, room: null };

/** The last furnishing steps of this session (Ctrl/Cmd+Z). */
export const undoStack = new UndoStack();

const itemOf = (m: GhostMode) => (m.kind === "move" ? m.drop.item : m.item);

/** Whether a piece of furniture could stand with its top-left tile on `t` (turned as the ghost is), as the client sees the room. */
export function fitsHere(mode: GhostMode, t: Tile): boolean {
  return ghostFits(
    world.room,
    itemOf(mode),
    mode.kind === "move" ? mode.drop : null,
    t,
    [...world.avatars.values()],
    mode.kind === "move" ? ghost.rot : 0,
  );
}

function show(): void {
  const m = ghost.mode;
  viewHooks.ghost?.(m ? { item: itemOf(m), tile: ghost.aim, fits: ghost.fits, rot: ghost.rot } : null);
}

function begin(mode: GhostMode, first: Tile, text: string): void {
  ghost.mode = mode;
  ghost.room = world.room;
  ghost.pose = "";
  ghost.rot = mode.kind === "move" ? rotOf(mode.drop.rot) : 0;
  hud.set({ panel: null, dialog: text });
  aim(first);
}

/** M on (or facing) a piece of mine: carry a ghost of it about until it is put down. */
export function startMove(): void {
  const me = self();
  if (!me || me.state !== "idle" || ghost.mode) return;
  const drop = ownPieceAt(world.room, me, world.drops, world.selfId, me.info.companyId);
  if (!drop) {
    hud.set({ dialog: "Face one of your own pieces of furniture, then press M to move it." });
    return;
  }
  begin(
    { kind: "move", drop },
    { x: drop.x, y: drop.y },
    `Moving it: point or walk to a spot (green fits).${canTurn(drop.item.slice(5)) ? " F turns it." : ""} Click or E puts it down, Esc keeps it here.`,
  );
}

/**
 * F: the piece you are moving turns a quarter, or else the piece of yours you are on or facing does, where it stands:
 * about its middle tile, so four turns bring it back. Wall pieces hang as they are.
 */
export function rotate(): void {
  const m = ghost.mode;
  if (m) {
    if (m.kind !== "move" || !canTurn(m.drop.item.slice(5))) return;
    ghost.rot = rotOf(ghost.rot + 1);
    // Green or red for the new shape, at once.
    if (ghost.aim) ghost.fits = fitsHere(m, ghost.aim);
    show();
    return;
  }
  const me = self();
  if (!me || me.state !== "idle") return;
  const drop = ownPieceAt(world.room, me, world.drops, world.selfId, me.info.companyId);
  if (!drop || !canTurn(drop.item.slice(5))) return;
  const was = rotOf(drop.rot);
  const next = rotOf(was + 1);
  const at = turnedAround(drop.x, drop.y, pieceOfDrop(drop)?.w ?? 1, was, next);
  void conn.move(drop.id, at.x, at.y, next).then(
    (r) => {
      hud.set({ dialog: r.notice });
      if (r.drop && rotOf(r.drop.rot) !== was)
        undoStack.push({ kind: "move", room: drop.room, id: drop.id, x: drop.x, y: drop.y, rot: was });
    },
    (e: unknown) => hud.set({ dialog: e instanceof Error ? e.message : "That didn't work." }),
  );
}

/**
 * Places `item` (`furn.<ch>`) from the bag, or from the company's storeroom (`company`). An office piece takes
 * you to your office first. False when it can't start (nothing happens but a line of text).
 */
export function startPlace(item: string, company = false): boolean {
  const me = self();
  if (!me || !pieceOfDrop({ item })) return false;
  if (company) {
    const id = me.info.companyId;
    if (id === null || (world.room !== `hq:${id}` && world.room !== `common:${id}`)) {
      hud.set({
        panel: null,
        dialog: "Walk into your building, or its common room upstairs, to put it out.",
      });
      return false;
    }
  } else if (ownerOfOffice(world.room) !== world.selfId) {
    ghost.pending = item;
    hud.set({ panel: null, dialog: "Taking you to your Office to put it down." });
    send(conn.visit(world.selfId));
    return true;
  }
  const [dx, dy] = DIRS[me.facing];
  begin(
    { kind: "place", item, company },
    { x: me.x + dx, y: me.y + dy },
    "Placing it: point or walk to a spot (green fits). Click or E puts it down, Esc keeps it.",
  );
  return true;
}

export function aim(tile: Tile): void {
  const m = ghost.mode;
  if (!m) return;
  // A poster or a frame hangs on the wall row: pointing at the wall, or the floor in front of it (where a pointer
  // in 3D lands), is pointing at the wall.
  const wallRow = pieceOfDrop({ item: itemOf(m) })?.wall ? wallRowOf(world.map) : null;
  const t = wallRow !== null && tile.y <= wallRow + 1 ? { x: tile.x, y: wallRow } : tile;
  ghost.aim = t;
  ghost.fits = fitsHere(m, t);
  show();
}

export function cancel(say = false): void {
  const was = ghost.mode;
  ghost.pending = null;
  if (!was) return;
  ghost.mode = null;
  ghost.aim = null;
  ghost.fits = false;
  ghost.rot = 0;
  show();
  hud.set({ dialog: say ? (was.kind === "move" ? "Left where it was." : "Kept it.") : null });
}

/** Puts it down where the ghost is green; the server decides (and keeps things as they were if not). */
export function confirm(): void {
  const m = ghost.mode;
  const t = ghost.aim;
  if (!m || !t) return;
  if (!fitsHere(m, t)) {
    hud.set({ dialog: "It doesn't fit there. Pick a green spot." });
    return;
  }
  const turned = ghost.rot;
  cancel();
  const fail = (e: unknown) => hud.set({ dialog: e instanceof Error ? e.message : "That didn't work." });
  if (m.kind === "move") {
    const from = m.drop;
    const was = rotOf(from.rot);
    void conn.move(from.id, t.x, t.y, turned).then((r) => {
      hud.set({ dialog: r.notice });
      if (r.drop && (r.drop.x !== from.x || r.drop.y !== from.y || rotOf(r.drop.rot) !== was))
        undoStack.push({ kind: "move", room: from.room, id: from.id, x: from.x, y: from.y, rot: was });
    }, fail);
    return;
  }
  const put = m.company ? town.placePiece(m.item, t) : town.drop(m.item, t);
  put.then(async (r) => {
    hud.set({ dialog: r.notice });
    if (!r.drop) return;
    if (!m.company) hud.set((s) => ({ wallet: s.wallet && { ...s.wallet, items: s.wallet.items - 1 } }));
    undoStack.push({
      kind: "place",
      room: r.drop.room,
      id: r.drop.id,
      item: m.item,
      ...(r.drop.co !== undefined && { co: r.drop.co }),
    });
    await Promise.all([refreshMe(), refreshWallet()]);
  }, fail);
}

/** Remembers a piece of mine taken off the floor (G), so Ctrl/Cmd+Z can put it back. */
export function recordTake(d: Drop): void {
  const mine = d.co !== undefined || ownerOfOffice(d.room) === world.selfId;
  if (!mine || !pieceOfDrop(d)) return;
  undoStack.push({
    kind: "take",
    room: d.room,
    id: d.id,
    item: d.item,
    x: d.x,
    y: d.y,
    ...(d.co !== undefined && { co: d.co }),
  });
}

let undoing = false;

/** Ctrl/Cmd+Z: takes back the last furnishing step in this room. The server checks it all again. */
export async function undo(): Promise<void> {
  if (undoing) return;
  const step = undoStack.peek();
  if (!step) return void hud.set({ dialog: "Nothing to undo." });
  if (step.room !== world.room)
    return void hud.set({ dialog: `Go back to ${roomName(step.room)} to undo that.` });
  undoStack.pop();
  undoing = true;
  try {
    let r: { notice: string; drop?: Drop } | null;
    if (step.kind === "move") r = await conn.move(step.id, step.x, step.y, step.rot);
    else if (step.kind === "place") r = await conn.putBack(step.id);
    else {
      const at = { x: step.x, y: step.y };
      r = step.co === undefined ? await town.drop(step.item, at) : await town.placePiece(step.item, at);
    }
    if (step.kind === "take" && r?.drop) undoStack.remap(step.id, r.drop.id);
    hud.set({ dialog: r ? `Undo: ${r.notice}` : "Undo: that's gone." });
    await Promise.all([refreshMe(), refreshWallet()]);
  } catch (e) {
    hud.set({ dialog: e instanceof Error ? e.message : "That didn't work." });
  } finally {
    undoing = false;
  }
}

/** Every frame: a change of room ends the mode, an Office we were taken to starts a waiting one, and walking aims it. */
export function tickGhost(): void {
  const me = self();
  if (ghost.mode && ghost.room !== world.room) cancel();
  if (ghost.pending && me && ownerOfOffice(world.room) === world.selfId) {
    const item = ghost.pending;
    ghost.pending = null;
    startPlace(item);
  }
  if (!ghost.mode || !me) return;
  const pose = `${me.x},${me.y},${me.facing}`;
  if (ghost.pose === pose) return;
  const first = ghost.pose === "";
  ghost.pose = pose;
  if (first) return;
  const [dx, dy] = DIRS[me.facing];
  aim({ x: me.x + dx, y: me.y + dy });
}

const typing = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

/** The mode's keys, clicks and pointer, ahead of the game's own (walking, interacting). Both renderers. */
export function bindGhost(canvas: HTMLElement): void {
  window.addEventListener(
    "keydown",
    (e) => {
      if (typing(e) || hud.get().panel) return;
      const k = e.key.toLowerCase();
      if (k === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (ghost.mode) {
        if (k === "escape" || k === "e" || k === "enter" || k === "m" || k === "f") {
          e.stopImmediatePropagation();
          e.preventDefault();
          if (k === "escape" || k === "m") cancel(true);
          else if (k === "f") rotate();
          else confirm();
        }
        return;
      }
      if (k === "m") startMove();
      if (k === "f") rotate();
    },
    true,
  );
  canvas.addEventListener(
    "click",
    (e) => {
      if (!ghost.mode || hud.get().panel) return;
      e.stopImmediatePropagation();
      const t = pickTile(e.clientX, e.clientY);
      if (t) aim(t);
      confirm();
    },
    true,
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!ghost.mode) return;
      const t = pickTile(e.clientX, e.clientY);
      if (t) aim(t);
    },
    { passive: true },
  );
}
