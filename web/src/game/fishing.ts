import { DIRS, TILE } from "@tokenmaxxing/core/world.ts";
import { drawFish, FISH_H, FISH_W } from "../art/fish.ts";
import { Pen } from "../art/pixels.ts";
import { biting, held, type Line, leap, lines } from "./fishing-line.ts";
import type { Frame } from "./frame.ts";
import { nearPill } from "./labels.ts";
import { serverNow, world } from "./world.ts";

const ROD = "#815b37";
const ROD_TIP = "#c9a26b";

/** Everyone fishing at the pond: a rod in hand, the line, the bobber (under when it bites), and any catch held up. */
export function drawFishing({ g, items, labels, now, toScreen, dpr }: Frame): void {
  if (world.room === "town") {
    const [sx, sy] = toScreen(4.5 * TILE, 11.5 * TILE);
    labels.push(() =>
      nearPill(g, sx, sy, "🎣 Pond fishing · E at the bank", dpr, "rgba(36,64,69,0.9)", "#fff0d1"),
    );
  }
  const server = serverNow();
  for (const l of lines()) drawLine(g, items, l, now, biting(l, server));
  for (const h of held(now)) {
    const { k, lift } = leap(h.t);
    const wx = (h.waterX + 0.5) * TILE;
    const wy = (h.waterY + 0.5) * TILE;
    const hx = (h.x + 0.5) * TILE;
    const hy = h.y * TILE - TILE * 0.35;
    const x = wx + (hx - wx) * k;
    const y = wy + (hy - wy) * k - lift * TILE * 0.3;
    // Nose towards the water it came out of.
    const flip = h.waterX < h.x;
    const wiggle = h.t < 0.8 ? Math.sin(now / 60) * 0.12 : 0;
    const fish = h.fish;
    items.push({
      y: h.y * TILE + TILE,
      draw: () => {
        g.save();
        g.translate(Math.round(x), Math.round(y));
        g.rotate(wiggle);
        if (flip) g.scale(-1, 1);
        drawFish(new Pen(g), fish, -FISH_W / 2, -FISH_H / 2);
        g.restore();
      },
    });
  }
}

/** One angler's tackle: a rod from their hand out over the water, the line down to the bobber. */
function drawLine(
  g: CanvasRenderingContext2D,
  items: Frame["items"],
  l: Line,
  now: number,
  bite: boolean,
): void {
  const dx = Math.sign(l.waterX - l.x);
  const dy = Math.sign(l.waterY - l.y);
  // The hand, a little out in front; the tip up and out over the water.
  const handX = (l.x + 0.5) * TILE + dx * 4;
  const handY = l.y * TILE + 9 + dy * 2;
  const tipX = handX + dx * 9 + (dx === 0 ? 3 : 0);
  const tipY = handY - 11 + dy * 5;
  const bx = (l.waterX + 0.5) * TILE;
  const by = (l.waterY + 0.5) * TILE;
  const bob = bite ? 1.2 + Math.sin(now / 45) * 0.8 : Math.sin(now / 220) * 0.7;
  // Behind the angler when they face up, in front otherwise.
  const behind = DIRS.up[1] === dy;
  items.push({
    y: l.y * TILE + (behind ? 0 : TILE + 1),
    draw: () => {
      g.strokeStyle = ROD;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(handX, handY);
      g.lineTo(tipX, tipY);
      g.stroke();
      g.fillStyle = ROD_TIP;
      g.fillRect(Math.round(tipX) - 0.5, Math.round(tipY) - 0.5, 1, 1);
      g.strokeStyle = "#fff0c8";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 2, bx, by + bob);
      g.stroke();
      // The bobber: red over white, half under when a fish has it.
      g.fillStyle = "#fff0d1";
      g.fillRect(bx - 1, by - 2 + bob, 2, bite ? 1 : 3);
      g.fillStyle = "#db655f";
      g.fillRect(bx - 1, by - 2 + bob, 2, 1);
      if (bite) {
        g.strokeStyle = "rgba(255,255,255,0.6)";
        g.lineWidth = 0.5;
        g.beginPath();
        g.ellipse(bx, by + 1, 3 + Math.sin(now / 90), 1.2, 0, 0, Math.PI * 2);
        g.stroke();
      }
    },
  });
}
