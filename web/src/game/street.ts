/**
 * Street life in town (`core/src/street.ts`), all of it worked out from the clock: the paperboy and the
 * papers by every door, the pølsevogn, and the build snail. A sausage over the head of anyone who just
 * had a pølse.
 *
 * Dev: `/play?clock=12:30` (or `07:00:05`) sets this page's Copenhagen clock to that time and lets it
 * run from there, to see each of them without waiting. The server keeps its own clock: buying a pølse
 * outside 11 to 14 still says it's closed.
 */
import { BLOCK_H, type GameMap } from "@tokenmaxxing/core/maps.ts";
import {
  CART,
  cartOpen,
  clockMinutes,
  deliveredAt,
  facesCart,
  hasPolse,
  isCart,
  PAPER,
  paperboyAt,
  paperRides,
  paperSpot,
  parseClock,
  type Ride,
  SNAIL,
  snailAt,
  snailTile,
} from "@tokenmaxxing/core/street.ts";
import { type Facing, type PlayerInfo, type StepResult, TILE } from "@tokenmaxxing/core/world.ts";
import { lerp, typedSwitch } from "hanzio";
import {
  bikeSprite,
  CART_H,
  CART_W,
  cartSprite,
  goalFlag,
  paperSprite,
  SNAIL_H,
  sausageIcon,
  snailSprite,
} from "../art/street.ts";
import { conn } from "../net.ts";
import { hud } from "../store.ts";
import { camera } from "./camera.ts";
import type { Frame } from "./frame.ts";
import { burst, FONT, nearPill, pill } from "./labels.ts";
import { world } from "./world.ts";

const forced = parseClock(new URLSearchParams(location.search).get("clock") ?? "");
/** How far the dev clock (`?clock=`) is from the real one. */
const offset = forced === null ? 0 : (forced - clockMinutes(Date.now())) * 60_000;

/** Now, on the street's clock: the real one, unless `?clock=` moved it. */
const streetNow = (): number => Date.now() + offset;

/** Whether the pølsevogn is open, asked once a minute: it opens and shuts on the minute. */
let cartAt = { minute: Number.NaN, open: false };
function cartOpenAt(at: number): boolean {
  const minute = Math.floor(at / 60_000);
  if (minute !== cartAt.minute) cartAt = { minute, open: cartOpen(at) };
  return cartAt.open;
}

/** What the snail says on E. The rare ones come up now and then. */
const SNAIL_LINES = [
  "🐌 still building...",
  "🐌 still building...",
  "🐌 installing dependencies (1,204 of 1,377)...",
  "🐌 waiting for a runner...",
  "🐌 tests flaky, retrying...",
  "🐌 linting. It found a missing semicolon in 2019.",
  "🐌 restoring cache... cache miss. Of course.",
];
const SNAIL_RARE = [
  "🐌 It works on my machine. My machine is a shell.",
  "🐌 Have you tried turning the pipeline off and on again?",
  "🐌 Docker layer 37 of 38. Layer 38 is the big one.",
];
const SNAIL_QUEUED = "🐌 Queued. Builds start at 07:00. The snail is having its coffee.";
const SNAIL_DONE = "🐌 ✓ Build succeeded. Deploying again tomorrow at 07:00.";

/** Doors that get a paper (company houses and the Inn), and the paperboy's round, per town map. */
const rounds = new WeakMap<GameMap, { doors: [number, number][]; rides: Ride[] }>();
function roundOf(map: GameMap) {
  let r = rounds.get(map);
  if (!r) {
    const doors = [...map.find("D"), ...map.find("I")];
    r = { doors, rides: paperRides(doors, map.x0 + 1, map.x0 + map.width - 1) };
    rounds.set(map, r);
  }
  return r;
}

/** The papers lying by each door at minute `m` (from the paperboy passing until midnight), with throws in flight. */
function papersAt(map: GameMap, m: number): { x: number; y: number; lift: number }[] {
  const { doors, rides } = roundOf(map);
  const out: { x: number; y: number; lift: number }[] = [];
  for (const door of doors) {
    const at = deliveredAt(rides, door);
    if (at === null || m < at) continue;
    const [x, y] = paperSpot(door);
    const road = (Math.floor(door[1] / BLOCK_H) + 1) * BLOCK_H;
    // A throw: a short arc from the road to the grass.
    const t = Math.min(1, ((m - at) * 60) / 0.6);
    out.push({ x, y: lerp(road, y, t), lift: Math.sin(t * Math.PI) * 10 });
  }
  return out;
}

/** The 17:00 burst over the snail, once, if this page saw the build finish. */
let finishedAt: number | null = null;
let lastMinute: number | null = null;

export function drawStreet({ g, items, labels, toScreen, now, dpr }: Frame): void {
  if (world.room !== "town") {
    lastMinute = null;
    return;
  }
  const at = streetNow();
  const m = clockMinutes(at);
  const map = world.map;

  // The pølsevogn.
  const open = cartOpenAt(at);
  const [cx, cy] = CART[0]!;
  const cart = cartSprite(open);
  const left = cx * TILE;
  const bottom = (cy + 1) * TILE;
  items.push({ y: bottom - 1, draw: () => g.drawImage(cart, left, bottom - CART_H) });
  const [sx, sy] = toScreen(left + CART_W / 2, bottom - CART_H);
  labels.push(() =>
    nearPill(
      g,
      sx,
      sy - 2 * dpr,
      open ? "🌭 Gratis pølser" : "🌭 Lukket · 11-14",
      dpr,
      open ? "rgba(216, 52, 60, 0.95)" : "rgba(43, 36, 51, 0.7)",
      "#fbf7ef",
    ),
  );

  // The build snail, its silver trail, and the goal flag.
  const snail = snailAt(at);
  const flagX = (SNAIL.to + 1) * TILE;
  const rowY = (SNAIL.y + 1) * TILE;
  items.push({ y: rowY - 2, draw: () => g.drawImage(goalFlag(), flagX + 2, rowY - 22) });
  const px = Math.round(snail.x * TILE);
  const inch = snail.phase === "deploying" && Math.floor(now / 900) % 2 === 0;
  const sprite = snailSprite(inch);
  items.push({
    y: rowY - 3,
    draw: () => {
      if (snail.x > SNAIL.from) {
        g.fillStyle = "rgba(235, 240, 250, 0.55)";
        g.fillRect(SNAIL.from * TILE + 2, rowY - 4, px - SNAIL.from * TILE, 1);
      }
      g.drawImage(sprite, px, rowY - SNAIL_H - 8);
    },
  });
  const [nx, ny] = toScreen(px + 6.5, rowY - SNAIL_H - 8);
  const text = typedSwitch(snail.phase, {
    queued: () => "queued",
    deploying: () => "deploying...",
    deployed: () => "✓ deployed",
  });
  labels.push(() => woodSign(g, nx, ny, text, dpr, snail.phase === "deployed"));
  // The build finishing while you watch: a toast, and confetti over the snail.
  if (lastMinute !== null && lastMinute < SNAIL.arrives && m >= SNAIL.arrives) {
    finishedAt = now;
    hud.set({
      notice: { text: "🐌 Build succeeded. The snail has deployed to production.", at: Date.now() },
    });
  }
  lastMinute = m;
  if (finishedAt !== null && now - finishedAt < 2_000) {
    const t = now - finishedAt;
    labels.push(() => burst(g, nx, ny, ["🎉", "✨", "✅"], t, dpr));
  }

  // The paperboy on his round, and the papers he's left.
  const { rides } = roundOf(map);
  const boy = paperboyAt(rides, m);
  if (boy) {
    const bike = bikeSprite(Math.floor(now / 160) % 2 === 0);
    const bx = Math.round(boy.x * TILE);
    const by = (boy.y + 1) * TILE;
    items.push({ y: by - 1, draw: () => g.drawImage(bike, bx - 4, by - bike.height) });
    const [lx, ly] = toScreen(bx + 8, by - bike.height);
    labels.push(() => pill(g, lx, ly - 2 * dpr, "📰 Paper!", dpr, "rgba(251, 247, 239, 0.95)", "#2b2433"));
  }
  if (m >= PAPER.at)
    for (const p of papersAt(map, m)) {
      const paper = paperSprite();
      const ox = p.x * TILE + 2;
      const oy = Math.round((p.y + 1) * TILE - paper.height - 2 - p.lift);
      items.push({ y: (p.y + 1) * TILE - 4, draw: () => g.drawImage(paper, ox, oy) });
    }
}

/** A small wooden sign with the snail's status on it. */
function woodSign(
  g: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  text: string,
  dpr: number,
  done: boolean,
) {
  g.font = `600 ${9 * dpr}px ${FONT}`;
  const w = g.measureText(text).width + 8 * dpr;
  const h = 12 * dpr;
  g.fillStyle = "#5e3d28";
  g.fillRect(cx - w / 2 - dpr, bottom - h - dpr, w + 2 * dpr, h + 2 * dpr);
  g.fillStyle = done ? "#58b36a" : "#d49c67";
  g.fillRect(cx - w / 2, bottom - h, w, h);
  g.fillStyle = done ? "#fbf7ef" : "#2b2433";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, cx, bottom - h / 2 + 0.5 * dpr);
}

/** The sausage over the head of anyone with a pølse in them. Returns where the next label goes. */
export function polseTag(
  g: CanvasRenderingContext2D,
  info: PlayerInfo,
  cx: number,
  y: number,
  now: number,
): number {
  if (!hasPolse(info.polseUntil, Date.now())) return y;
  const icon = sausageIcon();
  const s = camera.scale;
  const bob = Math.round(Math.sin(now / 250)) * s * 0.5;
  g.imageSmoothingEnabled = false;
  g.drawImage(
    icon,
    cx - (icon.width * s) / 2,
    y - icon.height * s - 2 * s + bob,
    icon.width * s,
    icon.height * s,
  );
  return y - (icon.height + 3) * s;
}

/** The cart takes up its tiles: a step onto it is no step. */
export const blocksStep = (x: number, y: number): boolean => world.room === "town" && isCart(x, y);

/**
 * E on street things: the pølsevogn (buys a pølse), the snail, or a paper (in front of you or under
 * your feet). False when it's none of them.
 */
export function streetInteract(
  me: { x: number; y: number; facing: Facing },
  x: number,
  y: number,
  send: (r: Promise<StepResult>) => void,
): boolean {
  if (world.room !== "town") return false;
  const at = streetNow();
  if (facesCart(me.x, me.y, me.facing)) {
    send(conn.eat(me.facing));
    return true;
  }
  const [sx, sy] = snailTile(at);
  if (x === sx && y === sy) {
    const phase = snailAt(at).phase;
    const lines = Math.random() < 0.15 ? SNAIL_RARE : SNAIL_LINES;
    const line = typedSwitch(phase, {
      queued: () => SNAIL_QUEUED,
      deploying: () => lines[Math.floor(Math.random() * lines.length)]!,
      deployed: () => SNAIL_DONE,
    });
    hud.set({ dialog: line });
    return true;
  }
  const m = clockMinutes(at);
  const papers = m >= PAPER.at ? papersAt(world.map, m) : [];
  if (
    papers.some((p) => p.x === x && Math.round(p.y) === y) ||
    papers.some((p) => p.x === me.x && p.y === me.y)
  ) {
    hud.set({ panel: { kind: "paper" } });
    return true;
  }
  return false;
}
