import type { JukeboxNow } from "@tokenmaxxing/core/jukebox.ts";
import { drumHits, type Note, notes, STEPS, TUNES, type Tune } from "@tokenmaxxing/core/tunes.ts";
import { storage } from "../storage.ts";
import { hud, JUKE_KEY, type JukeSettings } from "../store.ts";

/**
 * Plays the Tavern's jukebox with WebAudio: square, triangle and saw voices and a noise drum kit, made
 * in code (no audio files). The server says which track and how far in; everything else is local.
 * ponytail: the clocks of two tabs agree to within the network delay, not to the sample.
 */

/** The master gain at full volume: chiptune is loud. */
const LEVEL = 0.22;
/** How far ahead the scheduler queues notes, and how often it wakes. */
const AHEAD_MS = 400;
const EVERY_MS = 100;

/** Mutes or sets the volume, remembered on this device. */
export function setSettings(next: JukeSettings): void {
  storage.setItem(JUKE_KEY, JSON.stringify(next));
  hud.set({ jukeSettings: next });
  if (master) master.gain.value = next.muted ? 0 : next.volume * LEVEL;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  const s = hud.get().jukeSettings;
  master.gain.value = s.muted ? 0 : s.volume * LEVEL;
  master.connect(ctx.destination);
  // The room's background music sits under the jukebox, on the same master (so one mute covers both).
  music = ctx.createGain();
  music.gain.value = 0.55;
  music.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  // A backgrounded tab or app (the Android WebView included) must go quiet: audio keeps playing there.
  const c = ctx;
  document.addEventListener("visibilitychange", () => void (document.hidden ? c.suspend() : c.resume()));
  return ctx;
}

/** Browsers keep audio asleep until the page has had a click or key; the next one wakes it. */
export function wakeOnInput(c: AudioContext): void {
  if (c.state === "running") return;
  const go = () => {
    void c.resume();
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
}

/** Where the background music goes: quieter than the jukebox, on the same master. */
export const musicOut = (): GainNode | null => music;

export function tone(
  c: AudioContext,
  at: number,
  secs: number,
  hz: number,
  wave: OscillatorType,
  peak: number,
  out: AudioNode = master!,
): void {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = wave;
  osc.frequency.value = hz;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, secs * 0.95));
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + secs + 0.05);
}

export function drum(c: AudioContext, at: number, hit: "k" | "s" | "h", out: AudioNode = master!): void {
  const env = c.createGain();
  env.connect(out);
  if (hit === "k") {
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.12);
    env.gain.setValueAtTime(0.9, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    osc.connect(env);
    osc.start(at);
    osc.stop(at + 0.16);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hit === "h" ? 7000 : 1800;
  const len = hit === "h" ? 0.04 : 0.12;
  env.gain.setValueAtTime(hit === "h" ? 0.25 : 0.5, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(env);
  src.start(at);
  src.stop(at + len + 0.02);
}

interface Score {
  tune: Tune;
  lead: Map<number, Note>;
  bass: Map<number, Note>;
  drums: Map<number, "k" | "s" | "h">;
}

const byStep = (list: Note[]) => new Map(list.map((n) => [n.step, n]));

function scoreOf(tune: Tune): Score {
  return {
    tune,
    lead: byStep(notes(tune.lead)),
    bass: byStep(notes(tune.bass)),
    drums: new Map(drumHits(tune.drums).map((d) => [d.step, d.hit])),
  };
}

let playing: string | null = null;

/** Stops the music now. */
export function stopJukebox(): void {
  if (timer) clearInterval(timer);
  timer = null;
  playing = null;
}

/**
 * Plays what the room is hearing (or stops, for null): `now.elapsed` ms into the track, looped until
 * `now.ms`. The same track already playing is left alone, so a vote count coming in doesn't restart it.
 */
export function playJukebox(now: JukeboxNow | null): void {
  const key = now ? `${now.track}:${now.by}:${now.ms}` : null;
  if (key === playing) return;
  stopJukebox();
  const tune = now ? TUNES.find((t) => t.id === now.track) : undefined;
  const c = tune ? audio() : null;
  if (!now || !tune || !c) return;
  playing = key;
  wakeOnInput(c);
  const score = scoreOf(tune);
  const stepMs = 30_000 / tune.bpm;
  const startedAt = performance.now() - now.elapsed;
  // The next step to queue: the first one still ahead.
  let n = Math.ceil(now.elapsed / stepMs);
  const queue = () => {
    const elapsed = performance.now() - startedAt;
    // Asleep (hidden, or no click yet): drop the steps that pass rather than playing them all at once on waking.
    if (c.state !== "running") {
      n = Math.max(n, Math.ceil(elapsed / stepMs));
      return;
    }
    while (n * stepMs < elapsed + AHEAD_MS) {
      if (n * stepMs >= now.ms) return stopJukebox();
      const at = c.currentTime + Math.max(0, (n * stepMs - elapsed) / 1000);
      const i = n % STEPS;
      const secs = stepMs / 1000;
      const lead = score.lead.get(i);
      const bass = score.bass.get(i);
      const hit = score.drums.get(i);
      if (lead) tone(c, at, lead.len * secs, lead.hz, tune.wave, 0.5);
      if (bass) tone(c, at, bass.len * secs, bass.hz, "triangle", 0.8);
      if (hit) drum(c, at, hit);
      n++;
    }
  };
  queue();
  timer = setInterval(queue, EVERY_MS);
}
