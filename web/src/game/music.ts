import { THEME_STEPS, type Theme, themeOf } from "@tokenmaxxing/core/themes.ts";
import { drumHits, type Note, notes } from "@tokenmaxxing/core/tunes.ts";
import type { RoomId } from "@tokenmaxxing/core/world.ts";
import { audio, drum, musicOut, tone, wakeOnInput } from "./jukebox.ts";
import { tavernNow } from "./tavern-clock.ts";

/**
 * The background music: each kind of room has a looping 8-bit theme (`core/src/themes.ts`), played with
 * the jukebox's WebAudio voices. The Tavern's jukebox takes over while it's on (`duck`).
 */

const AHEAD_MS = 400;
const EVERY_MS = 100;

const byStep = (list: Note[]) => new Map(list.map((n) => [n.step, n]));

let watcher: ReturnType<typeof setInterval> | null = null;
let voice: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let room: RoomId | null = null;
let ducked = false;
let current: Theme["id"] | null = null;

function halt(): void {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
  voice?.disconnect();
  voice = null;
}

function sync(): void {
  const theme = room && !ducked ? themeOf(room, tavernNow()) : null;
  // Moving between two rooms with the same theme (a house to another house) keeps it playing.
  if ((theme?.id ?? null) === current) return;
  halt();
  const c = theme ? audio() : null;
  const parent = musicOut();
  if (!theme || !c || !parent) return;
  const out = c.createGain();
  out.connect(parent);
  voice = out;
  current = theme.id;
  wakeOnInput(c);
  const lead = byStep(notes(theme.lead));
  const bass = byStep(notes(theme.bass));
  const drums = new Map(drumHits(theme.drums).map((d) => [d.step, d.hit]));
  const stepMs = 30_000 / theme.bpm;
  const startedAt = performance.now();
  let n = 0;
  const queue = () => {
    const elapsed = performance.now() - startedAt;
    // Asleep (hidden, or no click yet): drop the steps that pass rather than playing them all at once on waking.
    if (c.state !== "running") {
      n = Math.max(n, Math.ceil(elapsed / stepMs));
      return;
    }
    while (n * stepMs < elapsed + AHEAD_MS) {
      const at = c.currentTime + Math.max(0, (n * stepMs - elapsed) / 1000);
      const i = n % THEME_STEPS;
      const secs = stepMs / 1000;
      const l = lead.get(i);
      const b = bass.get(i);
      const hit = drums.get(i);
      if (l) tone(c, at, l.len * secs, l.hz, theme.wave, 0.4, out);
      if (b) tone(c, at, b.len * secs, b.hz, "triangle", 0.7, out);
      if (hit) drum(c, at, hit, out);
      n++;
    }
  };
  queue();
  timer = setInterval(queue, EVERY_MS);
}

/** Plays the theme for the room I'm in (it starts over only when the theme changes). */
export function playRoomMusic(next: RoomId): void {
  room = next;
  if (!watcher) watcher = setInterval(sync, 1000);
  sync();
}

/** Quiets the background while the jukebox plays, and brings it back after. */
export function duckMusic(on: boolean): void {
  ducked = on;
  sync();
}

/** Stops the music (the connection dropped). */
export function stopRoomMusic(): void {
  room = null;
  if (watcher) clearInterval(watcher);
  watcher = null;
  halt();
}
