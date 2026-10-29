import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { mapOf } from "@tokenmaxxing/core/world.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { C } from "../art/palette.ts";
import { viewHooks, zoom } from "../game/camera.ts";
import { buildings, companyOnPlot } from "../game/houses.ts";
import { walkTo } from "../game/input.ts";
import { roomName, world } from "../game/world.ts";
import { graphics } from "../settings/graphics.ts";
import { useHud } from "../store.ts";

/** Widest the map may be, in CSS pixels; each tile gets a whole number of pixels. */
const MAX_WIDTH = 200;

const COLORS: Record<string, string> = {
  T: C.leafDark,
  "^": C.leaf,
  "~": C.water,
  ",": C.path,
  ":": C.plaza,
  F: C.waterLight,
  W: C.wallTop,
  _: C.floor,
  "=": C.rug,
  x: C.rugLight,
  R: C.rugLight,
  // The raid: its gate in town, and the dungeon's stone, dais, desks and torches.
  G: C.ink,
  q: "#2f2b3a",
  Z: "#5d5670",
  l: C.metalLight,
  r: C.metal,
  j: "#e9733d",
};

/** An office's wallpaper and floor by id (`decor.ts`): one colour for the whole tile, near the art's. */
const WALL_COLORS: Record<string, string> = {
  hygge: "#f5e3bd",
  nyhavn: "#d9a642",
  rundetaarn: "#a14d3b",
  jacobsen: "#9fb59a",
  tivoli: "#1f2a54",
};
const FLOOR_COLORS: Record<string, string> = {
  linoleum: "#7fa88a",
  parquet: "#6f4326",
  fiskebenet: "#dcc08e",
  checker: "#a9a7a6",
  bornholm: "#7c828c",
};

const bases = new WeakMap<GameMap, HTMLCanvasElement>();

/** The map's tiles, one block per tile, drawn once per map. */
function base(map: GameMap, scale: number): HTMLCanvasElement {
  const cached = bases.get(map);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = map.width * scale;
  canvas.height = map.height * scale;
  const g = canvas.getContext("2d")!;
  const colors: Record<string, string> = {
    ...COLORS,
    ...(map.decor?.wall && WALL_COLORS[map.decor.wall] && { W: WALL_COLORS[map.decor.wall]! }),
    ...(map.decor?.floor && FLOOR_COLORS[map.decor.floor] && { _: FLOOR_COLORS[map.decor.floor]! }),
  };
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const ch = map.at(map.x0 + x, map.y0 + y);
      // Only a wall's face has the wallpaper (the game's own rule); its top stays plain.
      const face =
        ch !== "W" ||
        (!"WR".includes(map.at(map.x0 + x, map.y0 + y + 1)) && map.contains(map.x0 + x, map.y0 + y + 1));
      g.fillStyle = (face ? colors[ch] : COLORS[ch]) ?? (map.id === "town" ? C.grass : C.woodDark);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  bases.set(map, canvas);
  return canvas;
}

/** Always in the bottom-right corner: the room you're in, everyone in it, and you. Click to walk there. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const room = useHud((s) => s.room);
  const myCompany = useHud((s) => s.me?.company?.id);
  useHud((s) => s.companies); // the town grows with them
  // Turning the view is the 3D renderer's.
  const turnable = useSyncExternalStore(graphics.subscribe, () => graphics.effective().renderer === "3d");
  const map = mapOf(room);
  const scale = Math.max(1, Math.floor(MAX_WIDTH / map.width));

  useEffect(() => {
    // What the last drawing showed: it's only drawn again when one of them changed.
    let drawn: { map: GameMap; companies: typeof world.companies; avatars: string } | null = null;
    const draw = () => {
      const g = ref.current?.getContext("2d");
      if (!g) return;
      // As it is now: a drop or a take makes the room a new map.
      const now = mapOf(room);
      const avatars = `${world.selfId}:${[...world.avatars.values()]
        .map((a) => `${a.info.id} ${a.x} ${a.y} ${a.info.online}`)
        .join()}`;
      if (drawn?.map === now && drawn.companies === world.companies && drawn.avatars === avatars) return;
      drawn = { map: now, companies: world.companies, avatars };
      g.drawImage(base(now, scale), 0, 0);
      for (const b of buildings(map)) {
        const company = b.plot === null ? null : companyOnPlot(b.plot);
        g.fillStyle = b.plot === null ? C.leaf : company?.id === myCompany ? C.flowerYellow : C.roofRed;
        g.fillRect((b.x - map.x0) * scale, (b.y - map.y0) * scale, b.w * scale, b.h * scale);
      }
      for (const a of world.avatars.values()) {
        const me = a.info.id === world.selfId;
        const r = me ? scale + 2 : scale;
        const cx = (a.x - map.x0) * scale + scale / 2;
        const cy = (a.y - map.y0) * scale + scale / 2;
        g.fillStyle = me ? C.ink : C.white;
        g.fillRect(cx - r / 2 - 1, cy - r / 2 - 1, r + 2, r + 2);
        g.fillStyle = me ? C.flowerRed : a.info.online ? C.screen : C.stoneLight;
        g.fillRect(cx - r / 2, cy - r / 2, r, r);
      }
    };
    draw();
    const id = setInterval(draw, 200);
    return () => clearInterval(id);
  }, [room, map, scale, myCompany]);

  return (
    <section className="panel minimap" aria-label="Map">
      <header>
        <span>🗺 {roomName(room)}</span>
        <span className="zoom">
          {turnable && (
            <>
              <button
                type="button"
                aria-label="Turn the view left"
                title="Turn the view left (Q)"
                onClick={() => viewHooks.rotate?.(-1)}
              >
                ⟲
              </button>
              <button
                type="button"
                aria-label="Turn the view right"
                title="Turn the view right (R)"
                onClick={() => viewHooks.rotate?.(1)}
              >
                ⟳
              </button>
            </>
          )}
          <button type="button" aria-label="Zoom out" title="Zoom out (−)" onClick={() => zoom(-1)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoom(1)}>
            +
          </button>
        </span>
      </header>
      <canvas
        ref={ref}
        width={map.width * scale}
        height={map.height * scale}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          // As a fraction of the canvas shown: CSS can draw it bigger or smaller than its pixels.
          walkTo(
            map.x0 + Math.floor(((e.clientX - rect.left) / rect.width) * map.width),
            map.y0 + Math.floor(((e.clientY - rect.top) / rect.height) * map.height),
          );
        }}
      />
    </section>
  );
}
