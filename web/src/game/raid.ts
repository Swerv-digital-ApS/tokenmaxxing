/**
 * The raid dungeon: the week's boss on its dais, and everyone with agents running at a war desk facing
 * it, wherever they really are. Their laptops fire magic missiles as fast as they burn tokens, and each
 * agent beyond their own is a robot minion firing too. The missiles only show the burn: the real damage
 * is every synced token (core/src/raid.ts), floated off the boss as each poll lands it. A kill drops
 * the boss with a trophy, puts a plaque on the wall and brings up the next rung's. In town, a sign over
 * the dungeon's gate. Before the first raid the gate is boarded up with a countdown, and the dungeon is
 * dark and empty but for the first boss's shadow; at the launch the boards burst off.
 */
import { compact, countdown } from "@tokenmaxxing/core/format.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type RungBoss, seatFor } from "@tokenmaxxing/core/raid.ts";
import type { Raiders } from "@tokenmaxxing/core/world.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import { clamp, sortBy } from "hanzio";
import { BOSS_SIZE, bossSilhouette, bossSprite, trophySprite } from "../art/bosses.ts";
import { characterFrame } from "../art/characters.ts";
import { MINION_H, MINION_W, minionFrame } from "../art/minions.ts";
import { boardedGate, chairBack, dangerSign, plank } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { gradient, hash } from "../art/pixels.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { gameHits } from "./games.ts";
import { bubble, FONT, nearPill, pill, sign } from "./labels.ts";
import { world } from "./world.ts";

const HURT_MS = 450;
const FLOAT_MS = 1800;
const TAUNT_EVERY = 25_000;
const TAUNT_MS = 4500;
/** The boss is drawn twice its size on the dais. */
const BOSS_SCALE = 2;
/** Minions drawn per raider; past it, "+N". */
const MINIONS_SHOWN = 8;
/** Everything in flight at once, so a busy dungeon stays smooth. */
const MAX_MISSILES = 150;
const MAX_SPARKS = 160;
const MISSILE_MS = 750;
const SPARK_MS = 320;
/** A kill: the boss slumps and fades, then the next rung's drops onto the dais under a banner. */
const FALL_MS = 2200;
const ARRIVE_MS = 700;
const BANNER_MS = 3500;
/** The launch: the gate's boards burst off. */
const BURST_MS = 2600;
/** Before the launch the boarded gate rumbles every so often, and something inside talks. */
const RUMBLE_EVERY = 7000;
const RUMBLE_MS = 700;
const LURK_EVERY = 18_000;
const LURK_MS = 4500;
/** What's behind the boards says, before the first raid. */
const LURKING = [
  "Your rate limit is coming.",
  "Try again Monday at 08:00.",
  "429 Too Early.",
  "I can hear your agents…",
  "Enjoy your tokens. While you can.",
];

/** Missiles a second from a laptop burning `burn` tokens a minute: 1 at 100k, ~3 at 1M, at most 6. */
const fireRate = (burn: number): number => (burn > 0 ? Math.min(6, Math.sqrt(burn / 1e5)) : 0);
/** Agents running with nothing synced lately: the odd sputter. */
const SPUTTER = 0.08;

const map = MAPS.dungeon;
const dais = map.find("Z");
/** The middle of the dais, where the boss stands, in world pixels. */
const AT = {
  x: ((Math.min(...dais.map(([x]) => x)) + Math.max(...dais.map(([x]) => x)) + 1) / 2) * TILE,
  y: (Math.max(...dais.map(([, y]) => y)) + 0.6) * TILE,
};
const BOSS_W = BOSS_SIZE * BOSS_SCALE;
/** What the missiles aim at: the boss's middle. Loot pops out of it too (game/loot.ts). */
export const TARGET = { x: AT.x, y: AT.y - BOSS_W / 2 };

/** Seats nearest the boss first: the busiest raiders get them when they arrive. */
const SEATS = [...map.find("r")].sort(
  ([ax, ay], [bx, by]) =>
    Math.hypot(ax + 0.5 - AT.x / TILE, ay - AT.y / TILE) -
      Math.hypot(bx + 0.5 - AT.x / TILE, by - AT.y / TILE) || ax - bx,
);
/** Seats are handed out from the front, in bands this big (see `setRaiders`). */
const SEAT_BAND = 10;
const TORCHES = map.find("j");
/** This week's kills hang on the back wall, either side of the boss, between the torches. */
const PLAQUES = [4, 5, 6, 7, 19, 20, 21, 22].map((x) => [x, 1] as const);

interface Missile {
  x0: number;
  y0: number;
  /** The arc's control point. */
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  at: number;
  ms: number;
  minion: boolean;
}

const fx = {
  hurtUntil: 0,
  zapUntil: 0,
  floats: [] as { text: string; at: number; dx: number }[],
  missiles: [] as Missile[],
  sparks: [] as { x: number; y: number; vx: number; vy: number; at: number; ms: number; color: string }[],
  /** The boss that just fell, and the next rung's coming up after it. */
  fell: null as { boss: RungBoss; at: number } | null,
  next: null as { boss: RungBoss; at: number } | null,
  /** When the gate burst open at the launch. */
  launch: null as number | null,
  /** Shots owed per shooter (`shooter`), so slow rates still fire now and then. */
  owed: new Map<number, number>(),
  last: 0,
};

/** A shooter's key in `fx.owed`: a raider's laptop (`minion` -1) or one of their minions. */
const shooter = (id: number, minion = -1) => id * 16 + minion + 1;

/**
 * Who's raiding, and which seat each has: kept as they come and go, so nobody jumps around. A newcomer
 * gets the seat their id hashes to (or the next free one) among the front `zone` seats, so the same
 * person has the same desk after a reload too, and a half-full room still fills from the boss out.
 */
const dungeon = {
  raiders: null as Raiders | null,
  seats: new Map<number, number>(),
};

/** Where `userId`'s laptop is, if they're at a desk: their loot flies there (game/loot.ts). */
export function deskOf(userId: number): { x: number; y: number } | null {
  const seat = SEATS[dungeon.seats.get(userId) ?? -1];
  return seat ? { x: seat[0] * TILE + 8, y: seat[1] * TILE - TILE + 2 } : null;
}

/** Who is raiding right now, and the tile of the seat each has (`setRaiders`): the 3D dungeon seats the same people. */
export const raidersNow = (): Raiders | null => dungeon.raiders;
export function seatTile(userId: number): [number, number] | null {
  const seat = SEATS[dungeon.seats.get(userId) ?? -1];
  return seat ? [seat[0], seat[1]] : null;
}

export function setRaiders(r: Raiders | null): void {
  dungeon.raiders = r;
  if (!r) {
    dungeon.seats.clear();
    fx.owed.clear();
    return;
  }
  const ids = new Set(r.top.map((p) => p.id));
  for (const id of dungeon.seats.keys()) if (!ids.has(id)) dungeon.seats.delete(id);
  for (const key of fx.owed.keys()) if (!ids.has(Math.floor(key / 16))) fx.owed.delete(key);
  const taken = new Set(dungeon.seats.values());
  // The front seats, in bands of 10, so the zone (and with it everyone's seat) only moves when the
  // crowd crosses a band; past it (people kept from a bigger crowd), the whole room.
  let zone = Math.min(SEATS.length, Math.ceil(r.top.length / SEAT_BAND) * SEAT_BAND);
  if ([...taken].some((s) => s >= zone)) zone = SEATS.length;
  // In id order, so who wins a contested seat doesn't depend on who's busiest right now.
  for (const p of sortBy(r.top, "id")) {
    if (dungeon.seats.has(p.id)) continue;
    if (taken.size >= zone) zone = SEATS.length;
    if (taken.size >= zone) break;
    const seat = seatFor(p.id, taken, zone);
    dungeon.seats.set(p.id, seat);
    taken.add(seat);
  }
}

/** A fresh raid from the server: what it did since the last one, shown as hits, and any kill. */
export function noteRaid(before: Raid | null, after: Raid): void {
  const now = performance.now();
  if (before?.prelaunch && !after.prelaunch) {
    // The launch: the boards burst off the gate and rung 1 drops onto its dais.
    fx.launch = now;
    fx.next = { boss: after.boss, at: now };
    spark(TARGET.x, TARGET.y, now, "#ffd35c", 40, 1400);
    return;
  }
  if (!before || before.week !== after.week) return;
  const kill = after.kills.slice(before.kills.length).at(-1);
  if (kill) {
    fx.fell = { boss: kill.boss, at: now };
    // The last one stays down: there's no next rung till Monday.
    if (!after.cleared) fx.next = { boss: after.boss, at: now + FALL_MS };
    spark(TARGET.x, TARGET.y, now, "#ffd35c", 40, 1400);
  }
  // `damage` starts again on each rung: the week's total is what landed.
  const hit = after.totalDamage - before.totalDamage;
  if (hit <= 0) return;
  fx.hurtUntil = now + HURT_MS;
  fx.floats.push({ text: `-${compact(hit)}`, at: now, dx: (Math.random() - 0.5) * 30 });
  // Mine on its own, in gold, when I'm in it.
  const mine = (after.me?.damage ?? 0) - (before.me?.damage ?? 0);
  if (mine > 0) fx.floats.push({ text: `-${compact(mine)} you`, at: now + 250, dx: 18 });
}

export const left = (r: Raid): number => Math.max(0, r.hp - r.damage);
/** "08:00": when a closed week's next ladder opens. */
export const opensAt = (r: Raid): string => `${String(r.rules.opensHour).padStart(2, "0")}:00`;
const pct = (r: Raid) => (r.hp > 0 ? Math.ceil((left(r) / r.hp) * 100) : 0);

const openRaid = () => hud.set({ panel: { kind: "raid" } });

/** Where the boss's name goes, and its body (which opens the raid too), in canvas pixels. */
function bossBox(f: Frame) {
  const [sx, sy] = f.toScreen(AT.x, AT.y - BOSS_W - 4);
  const [x0, y0] = f.toScreen(AT.x - BOSS_W / 2, AT.y - BOSS_W);
  const [x1, y1] = f.toScreen(AT.x + BOSS_W / 2, AT.y);
  return { sx, sy, x0, y0, x1, y1 };
}

/** Now and then a line from what's behind the boards, in a bubble over `bottom`. */
function lurking(g: CanvasRenderingContext2D, cx: number, bottom: number, dpr: number): void {
  const lurk = Date.now() % LURK_EVERY;
  if (lurk < LURK_MS) {
    const line = LURKING[Math.floor(Date.now() / LURK_EVERY) % LURKING.length]!;
    bubble(g, cx, bottom, line, dpr, LURK_MS - lurk);
  }
}

export function drawRaid(f: Frame): void {
  const { g, items, labels, toScreen, now, dpr } = f;
  const r = hud.get().raid;
  if (world.room === "town" && r) drawGate(f, r);
  if (world.room !== "dungeon") return;
  const dt = Math.min(100, now - (fx.last || now));
  fx.last = now;
  // Before the first raid: dark, nobody at the desks, and only the first boss's shadow on the dais.
  if (r?.prelaunch) {
    drawLair(f, r);
    return;
  }
  // The week is over, or its ladder is cleared: nobody fires till the next gate opens.
  const down = r?.closed === true || r?.cleared === true;

  for (const [x, y] of TORCHES) {
    // A flickering glow over each flame.
    const flicker = 0.1 + 0.04 * Math.sin(now / 90 + x * 3) + 0.03 * Math.sin(now / 37 + y);
    items.push({
      y: Number.POSITIVE_INFINITY,
      draw: () => {
        g.globalAlpha = flicker;
        g.fillStyle = "#ffb347";
        g.beginPath();
        g.arc(x * TILE + 8, y * TILE - 6, 9, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      },
    });
  }

  for (const p of dungeon.raiders?.top ?? []) {
    const seat = SEATS[dungeon.seats.get(p.id) ?? -1];
    if (!seat) continue;
    const px = seat[0] * TILE;
    const py = seat[1] * TILE;
    const rate = down ? 0 : fireRate(p.burn) || SPUTTER;
    const firing = shoot(shooter(p.id), rate, dt, now, px + 8, py - TILE + 1, false);
    // The laptop lights up, brighter as it fires.
    items.push({
      y: py - 0.9,
      draw: () => {
        g.fillStyle = firing ? C.white : C.screen;
        g.fillRect(px + 5, py - TILE - 1, 6, 5);
        g.fillStyle = "#5fc6e8";
        g.fillRect(px + 5, py - TILE + 1 + (Math.floor(now / 300) % 3), 4, 1);
      },
    });
    const typing = Math.floor(now / 180 + p.id) % 2 === 0 ? 1 : 0;
    const occupied = [...world.avatars.values()].some(
      (a) => a.state === "sit" && (a.info.id === p.id || (a.x === seat[0] && a.y === seat[1])),
    );
    if (!occupied)
      items.push({
        y: py + TILE - 0.5,
        draw: () => {
          g.drawImage(characterFrame(p.look, "up", "sit"), px, py - 6 + typing);
          g.drawImage(chairBack(), px, py);
        },
      });

    // Minions: up to two rows of four behind the chair.
    const minions = Math.min(MINIONS_SHOWN, p.agents - 1);
    for (let i = 0; i < minions; i++) {
      const mx = px - 8 + (i % 4) * MINION_W;
      const my = py + TILE - 2 + Math.floor(i / 4) * 5;
      const fired = shoot(
        shooter(p.id, i),
        // Smaller guns: a minion fires a third as fast, and only sputters when its raider does.
        rate && (fireRate(p.burn) ? Math.max(0.25, rate / 3) : rate / 2),
        dt,
        now,
        mx + 7,
        my + 6,
        true,
      );
      const frame = fired || Math.floor((now + i * 137) / 400) % 4 === 0 ? 1 : 0;
      items.push({
        y: my + MINION_H,
        draw: () => g.drawImage(minionFrame(frame), mx, my - (Math.floor((now + i * 90) / 260) % 2)),
      });
    }

    const extra = p.agents - 1 - minions;
    const [sx, sy] = toScreen(px + TILE / 2, py - TILE - 3);
    const [ex, ey] = toScreen(px + TILE + 10, py + TILE + 6);
    labels.push(() => {
      pill(
        g,
        sx,
        sy,
        p.name,
        dpr,
        p.id === world.selfId ? "rgba(233, 183, 61, 0.95)" : "rgba(27, 31, 42, 0.78)",
        p.id === world.selfId ? C.ink : C.white,
      );
      if (extra > 0) pill(g, ex, ey, `+${extra}`, dpr, "rgba(157, 255, 138, 0.9)", C.ink);
    });
  }

  const more = dungeon.raiders?.more ?? 0;
  if (more > 0) {
    const [sx, sy] = toScreen((map.width / 2) * TILE, (map.height - 1) * TILE - 2);
    labels.push(() => sign(g, sx, sy, `⚔️ +${more} more raiding`, dpr, false));
  }
  if (!dungeon.raiders?.top.length) {
    const [sx, sy] = toScreen(AT.x, AT.y + TILE * 2.5);
    labels.push(() => sign(g, sx, sy, "No agents running right now. Start one and take a desk.", dpr, false));
  }

  if (r) drawPlaques(f, r);
  // A week with kills ends in gold sparkles instead of missiles.
  if (down && r.kills.length > 0 && fx.sparks.length < MAX_SPARKS && Math.random() < dt / 60)
    spark(TARGET.x + (Math.random() - 0.5) * 70, TARGET.y + (Math.random() - 0.5) * 50, now, "#ffd35c", 1);

  if (r) drawBoss(f, r);
  drawShots(f);
}

/** Fires from (`fromX`, `fromY`) at `rate` a second: true for a moment after each shot, for the art to react. */
function shoot(
  key: number,
  rate: number,
  dt: number,
  now: number,
  fromX: number,
  fromY: number,
  minion: boolean,
) {
  if (rate <= 0) return false;
  let owed = (fx.owed.get(key) ?? Math.random()) + (rate * dt) / 1000;
  let fired = false;
  while (owed >= 1) {
    owed -= 1;
    if (fx.missiles.length >= MAX_MISSILES) continue;
    const x1 = TARGET.x + (Math.random() - 0.5) * BOSS_W * 0.6;
    const y1 = TARGET.y + (Math.random() - 0.5) * BOSS_W * 0.5;
    const lift = 30 + Math.random() * 40;
    fx.missiles.push({
      x0: fromX,
      y0: fromY,
      cx: (fromX + x1) / 2 + (Math.random() - 0.5) * 60,
      cy: Math.min(fromY, y1) - lift,
      x1,
      y1,
      at: now,
      ms: MISSILE_MS * (0.8 + Math.random() * 0.5),
      minion,
    });
    fired = true;
  }
  fx.owed.set(key, owed);
  return fired;
}

function spark(x: number, y: number, now: number, color: string, n: number, ms = SPARK_MS): void {
  for (let i = 0; i < n && fx.sparks.length < MAX_SPARKS; i++) {
    const a = Math.random() * Math.PI * 2;
    // A long burst spreads slower, so it stays round the boss.
    const v = (0.02 + Math.random() * 0.04) * (SPARK_MS / ms);
    fx.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: now, ms, color });
  }
}

/** Where a missile is `t` of the way along its arc. */
const alongX = (m: Missile, t: number) => {
  const u = 1 - t;
  return u * u * m.x0 + 2 * u * t * m.cx + t * t * m.x1;
};
const alongY = (m: Missile, t: number) => {
  const u = 1 - t;
  return u * u * m.y0 + 2 * u * t * m.cy + t * t * m.y1;
};

/** Missiles and sparks, over everything else in the room. */
function drawShots({ g, items, now }: Frame): void {
  if (fx.missiles.length)
    fx.missiles = fx.missiles.filter((m) => {
      if (now - m.at < m.ms) return true;
      spark(m.x1, m.y1, now, m.minion ? "#9dff8a" : "#e0b3ff", m.minion ? 2 : 4);
      // The boss flinches, not more than a few times a second.
      if (now > fx.zapUntil + 120) fx.zapUntil = now + 60;
      return false;
    });
  if (fx.sparks.length) fx.sparks = fx.sparks.filter((s) => now - s.at < s.ms);
  if (!fx.missiles.length && !fx.sparks.length) return;
  items.push({
    y: Number.POSITIVE_INFINITY,
    draw: () => {
      for (const m of fx.missiles) {
        const t = (now - m.at) / m.ms;
        const glow = m.minion ? "#9dff8a" : "#b98cff";
        // A short trail, then the bolt: a bright core in a glow.
        for (let k = 3; k >= 1; k--) {
          const tk = Math.max(0, t - k * 0.035);
          g.globalAlpha = 0.5 - k * 0.12;
          g.fillStyle = glow;
          g.fillRect(Math.round(alongX(m, tk)) - 1, Math.round(alongY(m, tk)) - 1, 2, 2);
        }
        g.globalAlpha = 1;
        const bx = Math.round(alongX(m, t));
        const by = Math.round(alongY(m, t));
        // A little star: a plus of glow round a white heart (a dot for a minion's).
        g.fillStyle = glow;
        if (m.minion) g.fillRect(bx - 1, by - 1, 2, 2);
        else {
          g.fillRect(bx - 2, by, 5, 1);
          g.fillRect(bx, by - 2, 1, 5);
          g.fillRect(bx - 1, by - 1, 3, 3);
          g.fillStyle = C.white;
          g.fillRect(bx, by, 1, 1);
        }
      }
      for (const s of fx.sparks) {
        const age = now - s.at;
        g.globalAlpha = 1 - age / s.ms;
        g.fillStyle = s.color;
        g.fillRect(Math.round(s.x + s.vx * age * 10), Math.round(s.y + s.vy * age * 10), 1, 1);
      }
      g.globalAlpha = 1;
    },
  });
}

/**
 * The boss on its dais: its rung and HP under its name, the town's hits floating off it, a taunt now and
 * then. Just after a kill, the fallen one slumps by a trophy, then the next drops in.
 */
function drawBoss(f: Frame, r: Raid): void {
  const { g, items, labels, now, dpr } = f;
  const fell = fx.fell && now - fx.fell.at < FALL_MS ? fx.fell : null;
  const next = fx.next && now - fx.next.at < BANNER_MS ? fx.next : null;
  const arriving = next && !fell ? clamp((now - next.at) / ARRIVE_MS, 0, 1) : 1;
  const closed = r.closed || r.cleared;
  // A real hit (the poll) flashes it white; a missile only makes it glow for a moment.
  const hurt = !fell && !closed && now < fx.hurtUntil && Math.floor(now / 70) % 2 === 0;
  const zap = !fell && !closed && now < fx.zapUntil;
  const boss = fell?.boss ?? r.boss;
  const sprite = bossSprite(boss.id, hurt);
  const bob = fell || closed ? 0 : Math.round(Math.sin(now / 420) * 2);
  const shake = now < fx.hurtUntil && !fell ? Math.round(Math.random() * 2 - 1) : 0;
  // Fallen: slumping and fading. Arriving: dropping onto the dais.
  const t = fell ? (now - fell.at) / FALL_MS : 0;
  const h = fell ? Math.round(BOSS_W * (1 - 0.45 * Math.min(1, t * 2))) : BOSS_W;
  const x = AT.x - BOSS_W / 2 + shake;
  const y = AT.y - h + bob - Math.round((1 - arriving) * 60);
  items.push({
    y: AT.y,
    draw: () => {
      g.fillStyle = C.shadow;
      g.fillRect(AT.x - 14, AT.y - 2, 28, 3);
      // Before Monday's opening the one that got away dozes, dim.
      g.globalAlpha = fell ? Math.max(0.15, 1 - t) : closed ? 0.55 : arriving;
      g.drawImage(sprite, x, y, BOSS_W, h);
      if (zap) {
        g.globalAlpha = 0.35;
        g.drawImage(bossSprite(r.boss.id, true), x, y, BOSS_W, h);
      }
      g.globalAlpha = 1;
      if (fell)
        g.drawImage(trophySprite(), AT.x + BOSS_W / 2 - 4, AT.y - 13 - Math.round(Math.min(1, t * 3) * 6));
    },
  });

  const { sx, sy, x0: bx, y0: byTop, x1: bx2, y1: byBottom } = bossBox(f);
  labels.push(() => {
    const share = fell ? 0 : r.hp > 0 ? left(r) / r.hp : 0;
    const title = fell
      ? `🏆 ${fell.boss.name} fell!`
      : closed
        ? `🏁 ${r.cleared ? "Ladder cleared" : "Week over"} · ${r.kills.length} fell · opens ${opensAt(r)} Mon`
        : `${r.boss.emoji} ${r.boss.name} · Rung ${r.boss.rung}`;
    const top = sy - 14 * dpr;
    const gold = !!fell || (closed && r.kills.length > 0);
    const { w, h } = pill(
      g,
      sx,
      top,
      title,
      dpr,
      gold ? "rgba(233, 183, 61, 0.95)" : "rgba(20, 24, 34, 0.9)",
      gold ? C.ink : "#ffd35c",
    );
    // The HP bar, under its name.
    const bw = Math.max(w, 110 * dpr);
    const bh = 7 * dpr;
    const by = top + 3 * dpr;
    g.fillStyle = "rgba(20, 24, 34, 0.9)";
    g.fillRect(sx - bw / 2 - dpr, by - dpr, bw + 2 * dpr, bh + 2 * dpr);
    g.fillStyle = "#5b1f1a";
    g.fillRect(sx - bw / 2, by, bw, bh);
    g.fillStyle = share > 0.5 ? "#72bf52" : share > 0.2 ? "#e9b73d" : "#e06c5f";
    g.fillRect(sx - bw / 2, by, bw * share, bh);
    g.font = `700 ${8 * dpr}px ${FONT}`;
    g.fillStyle = C.white;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(fell ? "0 HP" : `${compact(left(r))} / ${compact(r.hp)}`, sx, by + bh / 2 + 0.5 * dpr);
    gameHits.push({ x: sx - bw / 2, y: top - h, w: bw, h: h + bh + 6 * dpr, open: openRaid });
    // Its body opens the raid too.
    gameHits.push({ x: bx, y: byTop, w: bx2 - bx, h: byBottom - byTop, open: openRaid });

    // The next rung's, as it comes up.
    if (next && now >= next.at) {
      g.globalAlpha = Math.min(1, (BANNER_MS - (now - next.at)) / 600);
      sign(
        g,
        sx,
        byBottom + 26 * dpr,
        `⚔️ Rung ${next.boss.rung}: ${next.boss.emoji} ${next.boss.name}`,
        dpr,
        false,
      );
      g.globalAlpha = 1;
    }

    // Hits float up off it and fade.
    if (fx.floats.length) fx.floats = fx.floats.filter((fl) => now - fl.at < FLOAT_MS);
    for (const fl of fx.floats) {
      const t = (now - fl.at) / FLOAT_MS;
      if (t < 0) continue;
      g.globalAlpha = 1 - t;
      g.font = `800 ${14 * dpr}px ${FONT}`;
      g.lineWidth = 3 * dpr;
      g.strokeStyle = C.ink;
      g.fillStyle = fl.text.endsWith("you") ? "#ffd35c" : "#ff8a7a";
      const fy = byTop + (byBottom - byTop) * 0.4 - t * 40 * dpr;
      g.strokeText(fl.text, (bx + bx2) / 2 + fl.dx * dpr, fy);
      g.fillText(fl.text, (bx + bx2) / 2 + fl.dx * dpr, fy);
      g.globalAlpha = 1;
    }

    // A taunt now and then, while it's up and fighting.
    const phase = Date.now() % TAUNT_EVERY;
    if (!fell && !next && !closed && phase < TAUNT_MS) {
      const taunts = r.boss.taunts;
      const text = taunts[Math.floor(Date.now() / TAUNT_EVERY) % taunts.length]!;
      bubble(g, sx, top - h - 2 * dpr, text, dpr, TAUNT_MS - phase);
    }
  });
}

/** This week's kills on the back wall: a gold-framed plaque of each boss, its rung under it. */
function drawPlaques({ g, items, labels, toScreen, dpr }: Frame, r: Raid): void {
  const kills = r.kills.slice(-PLAQUES.length);
  kills.forEach((k, i) => {
    const [tx, ty] = PLAQUES[i]!;
    const x = tx * TILE + 1;
    const y = ty * TILE + 1;
    items.push({
      y: ty * TILE,
      draw: () => {
        g.fillStyle = C.ink;
        g.fillRect(x, y, 14, 14);
        g.fillStyle = "#e9b73d";
        g.fillRect(x + 1, y + 1, 12, 12);
        g.fillStyle = "#2a2533";
        g.fillRect(x + 2, y + 2, 10, 10);
        g.drawImage(bossSprite(k.boss.id, false), x + 2, y + 2, 11, 11);
      },
    });
    const [sx, sy] = toScreen(x + 7, y + 22);
    labels.push(() => pill(g, sx, sy, `${k.rung}`, dpr, "rgba(233, 183, 61, 0.95)", C.ink));
  });
}

/** Over the gate in town: which boss is down there, its rung and how it's doing. Shut till the week opens. */
function drawGate(f: Frame, r: Raid) {
  const { g, items, labels, toScreen, dpr } = f;
  const at = MAPS.town.find("G")[0];
  if (!at) return;
  const [gx, gy] = at;
  const now = performance.now();
  if (r.prelaunch) {
    drawBoarded(f, r, gx, gy, now);
    return;
  }
  if (fx.launch !== null && now - fx.launch < BURST_MS) drawBurst(f, gx, gy, now - fx.launch);
  if (r.closed)
    // A portcullis over the way down.
    items.push({
      y: (gy + 1) * TILE - 0.25,
      draw: () => {
        g.fillStyle = C.ink;
        for (let i = 0; i < 4; i++) g.fillRect(gx * TILE + 3 + i * 3, gy * TILE - 5, 1, 21);
        g.fillRect(gx * TILE + 2, gy * TILE + 1, 12, 1);
        g.fillRect(gx * TILE + 2, gy * TILE + 9, 12, 1);
      },
    });
  const [sx, sy] = toScreen((gx + 0.5) * TILE, gy * TILE - 12);
  const text = r.closed
    ? `⚔️ Raid Dungeon · shut · opens ${opensAt(r)}`
    : r.cleared
      ? `⚔️ Raid Dungeon · cleared · back Monday ${opensAt(r)}`
      : `⚔️ Raid Dungeon · ${r.boss.emoji} ${r.boss.name} · rung ${r.boss.rung} · ${pct(r)}%`;
  labels.push(() => {
    const { w, h } = nearPill(g, sx, sy, text, dpr, "rgba(20, 24, 34, 0.9)", "#ffd35c");
    gameHits.push({ x: sx - w / 2, y: sy - h, w, h, open: openRaid });
  });
}

/** Where the gate's sprite is drawn (24×28, from game/objects' `gate`), in world pixels. */
const gateBox = (gx: number, gy: number) => ({ x: gx * TILE - 4, y: gy * TILE + TILE - 28 });

/**
 * The gate before the first raid: boarded up and taped off with a danger sign, a purple glow leaking
 * through the gaps, a rumble now and then, the odd line from inside, and the countdown over it.
 */
function drawBoarded(
  { g, items, labels, toScreen, dpr }: Frame,
  r: Raid,
  gx: number,
  gy: number,
  now: number,
) {
  const { x, y } = gateBox(gx, gy);
  const phase = Date.now() % RUMBLE_EVERY;
  const rumbling = phase < RUMBLE_MS;
  const shake = rumbling ? Math.round(Math.sin(now / 25) * 1.2) : 0;
  const glow = 0.35 + 0.2 * Math.sin(now / 500) + (rumbling ? 0.25 : 0);
  items.push({
    y: (gy + 1) * TILE - 0.25,
    draw: () => {
      // The glow through the boards, and a little spilling out round the arch.
      g.globalAlpha = glow * 0.35;
      g.fillStyle = "#b98cff";
      g.beginPath();
      g.arc(x + 12, y + 16, 15, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = glow;
      g.fillStyle = "#8f5fe0";
      g.fillRect(x + 6, y + 8, 13, 20);
      g.globalAlpha = 1;
      g.drawImage(boardedGate(), x + shake, y);
      g.drawImage(dangerSign(), x + 7 + shake, y + 11);
      // Dust shaken off the arch.
      if (rumbling)
        for (let i = 0; i < 6; i++) {
          const t = (phase / RUMBLE_MS + i / 6) % 1;
          g.globalAlpha = 1 - t;
          g.fillStyle = C.stoneLight;
          g.fillRect(x + 3 + Math.floor(hash(i, 1, 3) * 18), y + 3 + Math.round(t * 22), 1, 1);
        }
      g.globalAlpha = 1;
    },
  });
  const [sx, sy] = toScreen((gx + 0.5) * TILE, gy * TILE - 12);
  const [bx, by] = toScreen(x, y);
  const [bx2, by2] = toScreen(x + 24, y + 28);
  labels.push(() => {
    const text =
      Date.now() < r.launchAt
        ? `⚠️ Something is coming… ${countdown(r.launchAt)}`
        : "⚔️ The gate is opening…";
    const { w, h } = pill(g, sx, sy, text, dpr, "rgba(20, 24, 34, 0.92)", "#f5d14a");
    gameHits.push({ x: sx - w / 2, y: sy - h, w, h, open: openRaid });
    gameHits.push({ x: bx, y: by, w: bx2 - bx, h: by2 - by, open: openRaid });
    lurking(g, sx, sy - h - 2 * dpr, dpr);
  });
}

/** The launch, in town: the boards fly off the gate in a burst of gold and violet. */
function drawBurst({ g, items }: Frame, gx: number, gy: number, age: number) {
  const { x, y } = gateBox(gx, gy);
  const t = age / BURST_MS;
  items.push({
    y: Number.POSITIVE_INFINITY,
    draw: () => {
      const s = age / 1000;
      // The planks, end over end, falling.
      for (let i = 0; i < 4; i++) {
        const vx = (i % 2 === 0 ? -1 : 1) * (30 + hash(i, 2, 9) * 40);
        const vy = -70 - hash(i, 3, 9) * 50;
        const px = x + 8 + vx * s;
        const py = y + 10 + i * 4 + vy * s + 160 * s * s;
        g.save();
        g.globalAlpha = Math.max(0, 1 - t);
        g.translate(Math.round(px), Math.round(py));
        g.rotate((i % 2 === 0 ? -1 : 1) * s * 7);
        g.drawImage(plank(), -5, -2);
        g.restore();
      }
      // Sparks out of the way down.
      for (let i = 0; i < 40; i++) {
        const a = hash(i, 4, 9) * Math.PI * 2;
        const v = 20 + hash(i, 5, 9) * 60;
        g.globalAlpha = Math.max(0, 1 - t * 1.2);
        g.fillStyle = i % 3 === 0 ? "#ffd35c" : "#c9a2ff";
        g.fillRect(
          Math.round(x + 12 + Math.cos(a) * v * s),
          Math.round(y + 16 + Math.sin(a) * v * s + 20 * s * s),
          1,
          1,
        );
      }
      g.globalAlpha = 1;
    },
  });
}

/** The dungeon before the first raid: dark and empty, the first boss only a shadow with eyes, waiting. */
function drawLair(f: Frame, r: Raid) {
  const { g, items, labels, now, dpr } = f;
  const breathe = Math.sin(now / 900);
  const blink = Math.floor(Date.now() / 300) % 17 === 0;
  const w = Math.round(BOSS_W * (1 + breathe * 0.02));
  items.push({
    y: AT.y,
    draw: () => {
      g.globalAlpha = 0.35 + 0.1 * breathe;
      g.fillStyle = "#6b3fb8";
      g.beginPath();
      g.arc(TARGET.x, TARGET.y, BOSS_W * 0.75, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = blink ? 0.6 : 1;
      g.drawImage(bossSilhouette(r.boss.id), AT.x - w / 2, AT.y - w, w, w);
      g.globalAlpha = 1;
    },
  });
  // The dark: over the whole room, a little less of it round the dais.
  items.push({
    y: Number.POSITIVE_INFINITY,
    draw: () => {
      g.fillStyle = gradient(g, "dungeon dark", () => {
        const dark = g.createRadialGradient(
          TARGET.x,
          TARGET.y,
          BOSS_W * 0.6,
          TARGET.x,
          TARGET.y,
          map.width * TILE * 0.6,
        );
        dark.addColorStop(0, "rgba(8, 6, 14, 0.25)");
        dark.addColorStop(1, "rgba(8, 6, 14, 0.82)");
        return dark;
      });
      g.fillRect(map.x0 * TILE, map.y0 * TILE, map.width * TILE, map.height * TILE);
    },
  });
  const { sx, sy, x0, y0, x1, y1 } = bossBox(f);
  labels.push(() => {
    const top = sy - 6 * dpr;
    const { w, h } = pill(
      g,
      sx,
      top,
      `⚠️ ??? · wakes in ${countdown(r.launchAt)}`,
      dpr,
      "rgba(20, 24, 34, 0.92)",
      "#f5d14a",
    );
    gameHits.push({ x: sx - w / 2, y: top - h, w, h, open: openRaid });
    gameHits.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, open: openRaid });
    sign(g, sx, y1 + 30 * dpr, "The desks are empty. For now. Monday 08:00, every agent fights.", dpr, false);
    lurking(g, sx, top - h - 2 * dpr, dpr);
  });
}
