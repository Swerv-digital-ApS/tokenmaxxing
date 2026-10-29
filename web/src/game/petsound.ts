import type { PetAct } from "@tokenmaxxing/core/pets.ts";
import { audio, tone, wakeOnInput } from "./jukebox.ts";

/** Each reaction's chirp: [pitch in Hz, seconds from the start, length] on a soft voice. */
const CHIRPS: Record<PetAct, [number, number, number][]> = {
  pet: [
    [660, 0, 0.09],
    [880, 0.1, 0.14],
  ],
  treat: [
    [220, 0.25, 0.05],
    [240, 0.37, 0.05],
    [220, 0.49, 0.05],
    [784, 0.65, 0.12],
    [1047, 0.77, 0.18],
  ],
  trick: [
    [523, 0, 0.08],
    [659, 0.08, 0.08],
    [784, 0.16, 0.08],
    [1047, 0.24, 0.2],
  ],
};

/** Whether the next click or key is already set to wake the audio. */
let armed = false;

/** A small cue for a pet's reaction, on the music's master (so "Music off" mutes it); `soft` for someone else's. */
export function petSound(act: PetAct, soft: boolean): void {
  const c = audio();
  if (!c) return;
  // Browsers keep audio asleep until the page has had a click or key: this one is lost, the next input wakes it.
  if (c.state !== "running") {
    if (!armed) wakeOnInput(c);
    armed = true;
    return;
  }
  const now = c.currentTime;
  for (const [hz, at, secs] of CHIRPS[act])
    tone(c, now + at, secs, hz, act === "treat" && hz < 400 ? "square" : "triangle", soft ? 0.12 : 0.4);
}
