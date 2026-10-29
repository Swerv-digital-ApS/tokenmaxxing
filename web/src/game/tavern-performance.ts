import { BAND_NAME, tavernSet } from "@tokenmaxxing/core/tavern-band.ts";
import { THEMES, themeOf } from "@tokenmaxxing/core/themes.ts";
import { hud } from "../store.ts";
import { tavernNow } from "./tavern-clock.ts";

let cachedAt = -1;
let cachedSet: ReturnType<typeof tavernSet> = null;
export function currentBandSet(): ReturnType<typeof tavernSet> {
  const at = tavernNow();
  const second = Math.floor(at / 1000);
  if (second !== cachedAt) {
    cachedAt = second;
    cachedSet = tavernSet(at);
  }
  return cachedSet;
}
export const bandPlaying = (): boolean => currentBandSet() !== null && hud.get().jukebox === null;
export function bandCaption(): string {
  const set = currentBandSet();
  if (!set) return "Live folk music · daily 16:00–00:00";
  return hud.get().jukebox
    ? `${BAND_NAME} · jukebox break`
    : `${BAND_NAME} · ${THEMES.find((t) => t.id === set)!.name}`;
}
export function bandText(): string {
  const at = tavernNow();
  return tavernSet(at)
    ? hud.get().jukebox
      ? `${BAND_NAME} are taking a break for the jukebox.`
      : `${BAND_NAME} · ${themeOf("inn", at).name}. Lute, flute, and a little 8-bit magic.`
    : `${BAND_NAME} play medieval chiptunes here every day, 16:00–00:00.`;
}
