/**
 * The statue of the #1 model on the square (`core/src/statue.ts`, `♛` on the map). `world` sends what's on
 * the plinth (the `statue` event): the leader, under a drape until one has been read, and when it took the
 * plinth, which is when its drape comes off. E on it reads the plaque; stand near it and its sign shows.
 * `?statue=grok:Grok 5` puts one up for screenshots (unveiled as the page loads), `?statue=none` drapes it.
 */
import {
  forcedStatue,
  plaqueOf,
  STATUE_TILE,
  type Statue,
  sameLeader,
  unveiling,
} from "@tokenmaxxing/core/statue.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { drapeSprite, STATUE_H, statueSprite } from "../art/statue.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { pill } from "./labels.ts";
import { self, serverNow, world } from "./world.ts";

const forced = forcedStatue(new URLSearchParams(location.search).get("statue"), Date.now());

let fromServer: Statue = { leader: null, since: 0, pinned: false };
/** Whether the server has said anything yet: its first word is just what's up, not news. */
let heard = false;

export function setStatue(s: Statue): void {
  const was = fromServer;
  fromServer = s;
  if (heard && s.leader && !sameLeader(was.leader, s.leader))
    hud.set({
      notice: {
        text: `🗿 Unveiled on the square: ${s.leader.model}, #1 on ${s.leader.ranking}.`,
        at: Date.now(),
      },
    });
  heard = true;
}

/** What's on the plinth now. */
export const statueNow = (): Statue => forced ?? fromServer;

/** Its sign, colour and plaque, worked out again only when the statue changes. */
let plaque = { for: null as Statue | null, of: plaqueOf(fromServer) };
export function plaqueNow(): ReturnType<typeof plaqueOf> {
  const s = statueNow();
  if (plaque.for !== s) plaque = { for: s, of: plaqueOf(s) };
  return plaque.of;
}

/** The plaque, read out (E facing the statue). */
export const statueText = (): string => plaqueNow().text;

/** How close you stand for its sign to show, in tiles. */
const NEAR = 3;

export function drawStatue({ g, items, labels, toScreen, dpr }: Frame): void {
  if (world.room !== "town") return;
  const tiles = world.map.find(STATUE_TILE);
  if (!tiles.length) return;
  const s = statueNow();
  const { sign, accent } = plaqueNow();
  const k = unveiling(s, serverNow());
  const sprite = statueSprite(accent, !s.leader);
  const me = self();
  for (const [x, y] of tiles) {
    const left = x * TILE;
    const top = (y + 1) * TILE - STATUE_H;
    items.push({
      y: (y + 1) * TILE - 1,
      draw: () => {
        g.drawImage(sprite, left, top);
        if (!s.leader) g.drawImage(drapeSprite(), left, top);
        else if (k !== null) {
          // The drape lifts off and fades, and gold sparkles round the figure.
          g.globalAlpha = 1 - k;
          g.drawImage(drapeSprite(), left, top - Math.round(k * k * 28));
          g.globalAlpha = 1;
          g.fillStyle = "#f7dc7a";
          for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + k * 9;
            g.fillRect(left + 8 + Math.round(Math.cos(a) * 9), top + 9 + Math.round(Math.sin(a) * 8), 1, 1);
          }
        }
      },
    });
    const near = !!me && Math.max(Math.abs(me.x - x), Math.abs(me.y - y)) <= NEAR;
    if (!near && k === null) continue;
    const [sx, sy] = toScreen(left + TILE / 2, top);
    labels.push(() => pill(g, sx, sy - 2 * dpr, sign, dpr, accent, "#fbf7ef", 240 * dpr));
  }
}
