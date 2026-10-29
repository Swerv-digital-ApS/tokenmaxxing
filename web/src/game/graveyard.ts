/**
 * The model graveyard in town (`core/src/graveyard.ts`): a tombstone for each model that dropped off
 * OpenRouter's list, on the lawn east of the Tavern. `world` keeps them and sends them (the `graveyard`
 * event). Walk onto the tile in front of a stone and its epitaph opens (once a stone, remembered in this
 * browser); E facing it opens it again. `?graveyard=on` (or a number) fills the plots for screenshots,
 * `?graveyard=off` empties them.
 */
import {
  forcedStones,
  GRAVES,
  GRAVEYARD,
  type Stone,
  signOf,
  stoneAt,
  stoneFaced,
  stoneInFront,
} from "@tokenmaxxing/core/graveyard.ts";
import { providerOf } from "@tokenmaxxing/core/launch.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { STONE_H, STONE_W, stoneSprite } from "../art/graveyard.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { pill } from "./labels.ts";
import { self, world } from "./world.ts";

const forced = forcedStones(new URLSearchParams(location.search).get("graveyard"), Date.now());

let fromServer: Stone[] = [];

export function setGraves(list: Stone[]): void {
  fromServer = list;
}

/** The stones in the graveyard, newest burial first. */
export const currentStones = (): Stone[] => forced ?? fromServer;

/** The stone with this OpenRouter id, if it's still in the graveyard. */
export const stoneById = (id: string): Stone | undefined => currentStones().find((s) => s.id === id);

/** Stones this browser has read (their ids). */
const READ = "tokenmaxxing.graves";
const read = new Set<string>(
  (() => {
    try {
      return JSON.parse(storage.getItem(READ) ?? "[]") as string[];
    } catch {
      return [];
    }
  })(),
);

const open = (s: Stone): void => hud.set({ panel: { kind: "tombstone", id: s.id } });

/**
 * Someone walks up to a stone: its epitaph opens, once a stone. Whichever renderer draws the town calls
 * this every frame.
 */
export function readStones(): void {
  const me = self();
  if (!me || world.room !== "town" || hud.get().panel) return;
  const s = stoneInFront(currentStones(), me.x, me.y);
  if (!s || read.has(s.id)) return;
  read.add(s.id);
  storage.setItem(READ, JSON.stringify([...read].slice(-50)));
  open(s);
}

/** A stone takes a step off you. */
export const blocksGrave = (x: number, y: number): boolean =>
  world.room === "town" && stoneAt(currentStones(), x, y) !== undefined;

/** E facing a stone: its epitaph. False when there's none there. */
export function graveInteract(me: { x: number; y: number; facing: Facing }): boolean {
  if (world.room !== "town") return false;
  const s = stoneFaced(currentStones(), me.x, me.y, me.facing);
  if (!s) return false;
  open(s);
  return true;
}

/** The graveyard's sign: over the middle of its top row, a stone's height up. */
export const SIGN_AT = { x: GRAVEYARD.x + 0.5, y: GRAVEYARD.y } as const;

export function drawGraveyard({ g, items, labels, toScreen, dpr }: Frame): void {
  readStones();
  if (world.room !== "town") return;
  const stones = currentStones();
  if (stones.length === 0) return;
  for (const s of stones) {
    const [x, y] = GRAVES[s.plot]!;
    const sprite = stoneSprite(providerOf(s.provider).accent);
    const left = x * TILE + (TILE - STONE_W) / 2;
    const bottom = (y + 1) * TILE;
    items.push({ y: bottom - 1, draw: () => g.drawImage(sprite, left, bottom - STONE_H) });
  }
  const [sx, sy] = toScreen(SIGN_AT.x * TILE, SIGN_AT.y * TILE - STONE_H / 2);
  labels.push(() => pill(g, sx, sy, signOf(stones), dpr, "#4a4458", "#fbf7ef", 240 * dpr));
}
