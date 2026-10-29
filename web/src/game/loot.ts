/**
 * Raid loot as it drops (`world` sends `loot`, core/src/loot.ts). In the dungeon each item pops out of
 * the falling boss in a beam of its rarity's colour and flies to its winner's desk, landing in a burst
 * with their name on it. A legendary floods the screen with gold and puts up a banner wherever you are;
 * an epic does it in violet, smaller.
 */
import { type LootNews, lootById, oddsText, RARITIES, type Rarity } from "@tokenmaxxing/core/loot.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { lerp, sortBy, typedSwitch } from "hanzio";
import { itemFrame } from "../art/characters.ts";
import { trophyAt } from "../art/loot.ts";
import { C } from "../art/palette.ts";
import { petFrame } from "../art/pets.ts";
import type { Frame } from "./frame.ts";
import { FONT, pill } from "./labels.ts";
import { deskOf, TARGET } from "./raid.ts";
import { world } from "./world.ts";

/** After the news, while the boss slumps: then the loot comes out. */
const DELAY_MS = 1300;
/** One after another, not all at once. */
const STAGGER_MS = 350;
const POP_MS = 700;
const FLY_MS = 1100;
const LAND_MS = 1400;
const FLASH_MS = 1500;
const BANNER_MS = 6000;
const MAX_FLYING = 16;

interface Flying {
  news: LootNews;
  rarity: Rarity;
  at: number;
  /** Where it pops up to over the boss, off to one side. */
  dx: number;
  /** Where it lands, kept from the moment it set off: a raider who leaves doesn't move it. */
  to: { x: number; y: number } | null;
}

const fx = {
  flying: [] as Flying[],
  /** The rarest drop of the last batch, if it was epic or better: a flash and a banner. */
  big: null as { news: LootNews; rarity: Rarity; at: number } | null,
};

const rarityOf = (item: string): Rarity => lootById(item)?.rarity ?? "common";
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

const listeners = new Set<(news: readonly LootNews[]) => void>();
/** Calls `fn` with every batch of drops (the 3D dungeon's); returns the way to stop. */
export function onLoot(fn: (news: readonly LootNews[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A batch of drops from the world: queued to fly, the rarest first. */
export function noteLoot(news: readonly LootNews[]): void {
  for (const fn of listeners) fn(news);
  const now = performance.now();
  const sorted = sortBy(news, { by: (n) => RANK[rarityOf(n.item)], order: "desc" });
  const room = MAX_FLYING - fx.flying.length;
  sorted.slice(0, Math.max(0, room)).forEach((n, i) => {
    fx.flying.push({
      news: n,
      rarity: rarityOf(n.item),
      at: now + DELAY_MS + i * STAGGER_MS,
      dx: (i % 2 ? 1 : -1) * (10 + ((i * 7) % 18)),
      to: null,
    });
  });
  const best = sorted[0];
  if (best && RANK[rarityOf(best.item)] >= RANK.epic)
    fx.big = { news: best, rarity: rarityOf(best.item), at: now + DELAY_MS };
}

/** The item's own sprite: as it lies in the bag. */
function lootSprite(id: string): HTMLCanvasElement | null {
  const it = itemById(id);
  if (!it) return null;
  return typedSwitch(
    it.slot,
    {
      pet: () => petFrame(it.index, false, false),
      furniture: () => trophyAt(id.slice(5))?.canvas ?? null,
    },
    () => itemFrame(it),
  );
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** The flying loot (dungeon only) and the big-drop flash and banner (anywhere), for this frame. */
export function drawLoot(frame: Frame): void {
  const { now } = frame;
  if (fx.flying.length) {
    fx.flying = fx.flying.filter((f) => now - f.at < POP_MS + FLY_MS + LAND_MS);
    if (world.room === "dungeon") for (const f of fx.flying) drawOne(frame, f);
    else fx.flying = fx.flying.filter((f) => f.at > now);
  }
  drawBig(frame);
}

function drawOne({ g, items, labels, toScreen, now, dpr }: Frame, f: Flying): void {
  const t = now - f.at;
  if (t < 0) return;
  const color = RARITIES[f.rarity].color;
  const sprite = lootSprite(f.news.item);
  f.to ??= deskOf(f.news.userId) ?? { x: TARGET.x + f.dx * 3, y: TARGET.y + 140 };
  const top = { x: TARGET.x + f.dx, y: TARGET.y - 34 };
  let x: number;
  let y: number;
  let scale = 1;
  if (t < POP_MS) {
    // Up out of the boss, growing.
    const u = ease(t / POP_MS);
    x = lerp(TARGET.x, top.x, u);
    y = lerp(TARGET.y, top.y, u);
    scale = 0.4 + 0.8 * u;
  } else if (t < POP_MS + FLY_MS) {
    // An arc down to the desk.
    const u = ease((t - POP_MS) / FLY_MS);
    const cx = (top.x + f.to.x) / 2;
    const cy = Math.min(top.y, f.to.y) - 40;
    x = (1 - u) ** 2 * top.x + 2 * (1 - u) * u * cx + u * u * f.to.x;
    y = (1 - u) ** 2 * top.y + 2 * (1 - u) * u * cy + u * u * f.to.y;
    scale = 1.2 - 0.3 * u;
  } else {
    x = f.to.x;
    y = f.to.y - 6;
    scale = 0.9;
  }
  const landed = t >= POP_MS + FLY_MS;
  const fade = landed ? 1 - (t - POP_MS - FLY_MS) / LAND_MS : 1;
  const rank = RANK[f.rarity];
  items.push({
    y: Number.POSITIVE_INFINITY,
    draw: () => {
      // The beam: a pillar of its colour up from the boss while it's popping out.
      if (t < POP_MS + 300) {
        const a = Math.min(1, t / 150) * (1 - Math.max(0, t - POP_MS) / 300);
        const w = 4 + rank * 2;
        g.globalAlpha = 0.35 * a;
        g.fillStyle = color;
        g.fillRect(Math.round(top.x - w), top.y - 120, w * 2, 120 + (TARGET.y - top.y));
        g.globalAlpha = 0.8 * a;
        g.fillStyle = C.white;
        g.fillRect(Math.round(top.x - 1), top.y - 120, 2, 120 + (TARGET.y - top.y));
      }
      // A glow behind it, pulsing.
      g.globalAlpha = (0.35 + 0.15 * Math.sin(now / 90)) * fade;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, (7 + rank * 2) * scale, 0, Math.PI * 2);
      g.fill();
      // The landing: a ring spreading out from the desk.
      if (landed) {
        const u = (t - POP_MS - FLY_MS) / LAND_MS;
        g.globalAlpha = 1 - u;
        g.strokeStyle = color;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(f.to!.x, f.to!.y - 4, 4 + u * (14 + rank * 6), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = fade;
      if (sprite) {
        const w = sprite.width * scale;
        const h = sprite.height * scale;
        g.drawImage(sprite, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
      }
      g.globalAlpha = 1;
    },
  });
  if (!landed) return;
  const [sx, sy] = toScreen(f.to.x, f.to.y - 14);
  const name = lootById(f.news.item)?.name ?? f.news.item;
  labels.push(() => {
    g.globalAlpha = Math.min(1, fade * 2);
    pill(g, sx, sy, `✨ ${f.news.name}: ${name}`, dpr, color, C.ink);
    g.globalAlpha = 1;
  });
}

/** A legendary (gold) or an epic (violet): the screen flashes, and a banner says who got what. */
function drawBig({ g, labels, now, dpr }: Frame): void {
  const big = fx.big;
  if (!big) return;
  const t = now - big.at;
  if (t > BANNER_MS) {
    fx.big = null;
    return;
  }
  if (t < 0) return;
  const legendary = big.rarity === "legendary";
  const color = RARITIES[big.rarity].color;
  labels.push(() => {
    const { width: w, height: h } = g.canvas;
    if (t < FLASH_MS) {
      // A white-gold burst, fading out from the middle.
      const a = (1 - t / FLASH_MS) * (legendary ? 0.75 : 0.4);
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, legendary ? "#fff6c8" : "#efe0ff");
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.globalAlpha = a;
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    // The banner, sliding in, then fading.
    const inT = Math.min(1, t / 400);
    const outT = Math.min(1, (BANNER_MS - t) / 600);
    g.globalAlpha = outT;
    // Mid-screen, clear of the HUD's toasts up top.
    const by = h * 0.5 - (1 - ease(inT)) * 40 * dpr;
    const title = legendary ? "🌟 LEGENDARY DROP 🌟" : "💜 EPIC DROP 💜";
    const item = lootById(big.news.item);
    const who = big.news.userId === world.selfId ? "You" : big.news.name;
    const line = `${who} got the ${item?.name ?? big.news.item} (${oddsText(big.news.odds)})`;
    g.font = `800 ${22 * dpr}px ${FONT}`;
    const tw = g.measureText(title).width;
    g.font = `700 ${13 * dpr}px ${FONT}`;
    const lw = g.measureText(line).width;
    const bw = Math.max(tw, lw) + 48 * dpr;
    const bh = 64 * dpr;
    g.fillStyle = "rgba(20, 16, 28, 0.92)";
    g.beginPath();
    g.roundRect(w / 2 - bw / 2, by - bh / 2, bw, bh, 10 * dpr);
    g.fill();
    g.lineWidth = 3 * dpr;
    g.strokeStyle = color;
    g.stroke();
    // A shine sweeping across it.
    const sweep = ((t / 1400) % 1) * (bw + 60 * dpr) - 30 * dpr;
    g.save();
    g.beginPath();
    g.roundRect(w / 2 - bw / 2, by - bh / 2, bw, bh, 10 * dpr);
    g.clip();
    g.globalAlpha = outT * 0.18;
    g.fillStyle = C.white;
    g.fillRect(w / 2 - bw / 2 + sweep, by - bh / 2, 18 * dpr, bh);
    g.restore();
    g.globalAlpha = outT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${22 * dpr}px ${FONT}`;
    g.fillStyle = color;
    g.fillText(title, w / 2, by - 11 * dpr);
    g.font = `700 ${13 * dpr}px ${FONT}`;
    g.fillStyle = C.white;
    g.fillText(line, w / 2, by + 15 * dpr);
    // The item itself, big, either side of the title.
    const sprite = lootSprite(big.news.item);
    if (sprite) {
      const s = 3 * dpr;
      const bob = Math.sin(t / 200) * 2 * dpr;
      for (const side of [-1, 1])
        g.drawImage(
          sprite,
          w / 2 + side * (bw / 2 - 4 * dpr) - (sprite.width * s) / 2,
          by - (sprite.height * s) / 2 + bob,
          sprite.width * s,
          sprite.height * s,
        );
    }
    g.globalAlpha = 1;
  });
}
