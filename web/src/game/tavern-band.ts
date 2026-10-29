import { MUSICIANS } from "@tokenmaxxing/core/tavern-band.ts";
import { defaultLook, TILE } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "../art/characters.ts";
import { graphics } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { nearPill } from "./labels.ts";
import { bandCaption, bandPlaying, bandText, currentBandSet } from "./tavern-performance.ts";
import { world } from "./world.ts";

const LOOKS = MUSICIANS.map((_, i) => ({
  ...defaultLook(40 + i),
  hat: 0,
  hair: i ? 3 : 1,
  outfit: i ? 5 : 2,
}));
export function bandInteract(x: number, y: number): boolean {
  if (world.room !== "inn" || world.map.at(x, y) !== "e") return false;
  hud.set({ dialog: bandText() });
  return true;
}
export function drawTavernBand({ g, items, labels, now, toScreen, dpr }: Frame): void {
  if (world.room !== "inn") return;
  const present = currentBandSet() !== null;
  const playing = bandPlaying();
  const calm = graphics.effective().reduceMotion;
  if (present)
    MUSICIANS.forEach((m, i) => {
      const x = m.x * TILE,
        y = (m.y + 1) * TILE;
      items.push({
        y: y - 1,
        draw: () => {
          const sway = playing && !calm ? Math.round(Math.sin(now / 300 + i)) : 0;
          g.drawImage(characterFrame(LOOKS[i]!, "right", "stand"), x, y - 19 + sway);
          if (m.instrument === "lute") {
            g.fillStyle = "#d69e56";
            g.fillRect(x + 10, y - 11 + sway, 5, 6);
            g.fillRect(x + 13, y - 15 + sway, 2, 7);
            g.fillStyle = "#503726";
            g.fillRect(x + 11, y - 9 + sway, 2, 2);
            g.fillStyle = "#fff0ca";
            g.fillRect(x + 13, y - 9 + sway + (playing && !calm ? Math.floor(now / 130) % 2 : 0), 3, 1);
          } else {
            g.fillStyle = "#e9cb83";
            g.fillRect(x + 10, y - 13 + sway, 9, 2);
            g.fillStyle = "#6c4d32";
            for (const dx of [13, 16]) g.fillRect(x + dx, y - 13 + sway, 1, 1);
          }
        },
      });
    });
  const [sx, sy] = toScreen(2 * TILE, 10 * TILE - 14);
  labels.push(() => nearPill(g, sx, sy, bandCaption(), dpr, "rgba(58,38,31,0.9)", "#ffe9a8"));
}
