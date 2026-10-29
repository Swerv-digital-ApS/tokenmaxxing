/**
 * The town outside, drawn from the same tile map as the 2D game (`data/town.ts`, a snapshot of
 * `core/src/maps.ts`): every tile character becomes ground or a prop, every `H` block a building (the
 * Tavern at `I`, a company house at each `D`), the arcade sits in the first park. Doors are exposed as
 * `TownDoor`s so the portal system can walk you in (`inn`, `hq`, `arcade`, the raid's `dungeon` gate).
 * World units are tiles: tile (tx, ty) covers x from `tx - x0 + MARGIN`, z from `ty - y0 + MARGIN`.
 */
import { bakedLook, type SeasonLook } from "@tokenmaxxing/core/seasons.ts";
import { CALM, type Weather } from "@tokenmaxxing/core/sky.ts";
import { CART, SNAIL } from "@tokenmaxxing/core/street.ts";
import { WINDMILL } from "@tokenmaxxing/core/windmill.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { C } from "../../art/palette.ts";
import { seasonGrass, seasonLitter, seasonLookNow } from "../../game/seasons.ts";
import {
  BLOCK_H,
  BLOCK_W,
  blockOf,
  CORE_BLOCKS,
  type Company,
  doorOf,
  HOUSE_TIER_NAMES,
  houseTier,
  PLAZA,
  plotBlock,
  plotId,
  TOWN_SPAWN,
  TownMap,
  townMap,
} from "../data/town.ts";
import type { Asset } from "../furniture/furniture.ts";
import { canvasTexture, glass, Model, painted, seeded, textureCap, ticks, tint, toon } from "../kit/kit.ts";
import { SHOP_DOOR_CHAR, SHOP_IDS, SHOP_SPECS, type ShopId } from "../shops/catalog.ts";
import { ICE } from "./cold3d.ts";
import {
  arcadeBuilding,
  bush,
  grandFountain,
  LEAF,
  lanternPillar,
  nightGlow,
  parkBench,
  type Species,
  seasonalTree,
  streetLamp,
  tree,
} from "./props.ts";
import { companyHouse, tavernBuilding } from "./town3d-houses.ts";
import {
  type Board,
  buildSnail,
  type Chalkboard,
  chalkboard,
  coffeeStand,
  dungeonGate,
  goalFlag,
  leaderboard,
  openOfficesBoard,
  paperBike,
  paperRoll,
  polseCart,
  type StarCounter,
  starCounter,
} from "./town3d-props.ts";
import { type Windmill, windmill } from "./windmill3d.ts";

/** Grass tiles round the map's tree ring. */
export const MARGIN = 3;

export interface TownDoor {
  /** `inn`, `arcade`, `dungeon`, or `hq:<plot>`. */
  id: string;
  kind: "inn" | "hq" | "arcade" | "dungeon" | "shop";
  label: string;
  plot?: number;
  shop?: ShopId;
  companyId?: number;
  /** The tile you step on to go through, and its middle in world units (x, z). */
  tile: [number, number];
  at: [number, number];
}

export interface TownSpots {
  /** Paths walked back and forth or round (world x, z). */
  routes: { points: [number, number][]; loop: boolean }[];
  /** Benches' seats: where, how high, which way they face. */
  seats: { at: [number, number]; y: number; turn: number }[];
  start: [number, number];
}

export interface Town3d {
  group: THREE.Group;
  /** World size, margin included. */
  size: [number, number];
  /** The tiles drawn (the map with the arcade's door and path written in). */
  map: TownMap;
  doors: TownDoor[];
  /** A company's door by plot. */
  doorOf: (plot: number) => TownDoor | undefined;
  /** Tile -> world (middle of the tile) and back. */
  toWorld: (tx: number, ty: number) => [number, number];
  toTile: (x: number, z: number) => [number, number];
  spots: TownSpots;
  boards: { leaderboard: Board; chalkboard: Chalkboard; stars: StarCounter };
  /** The houses by plot, so a caller can wave at a window or restyle one. */
  houses: Map<number, Model>;
  /** Street life, worked out from the clock (minutes since midnight in Aarhus). */
  setClock: (minutes: () => number) => void;
  /** The crowns of the broadleaf trees (world x, height, z): where autumn's leaves fall from. */
  canopies: readonly (readonly [number, number, number])[];
  /** The windmills' wind (the game's weather); calm until it is set. */
  setWeather: (weather: () => Weather) => void;
  /** The windmills, by their top-left tile ("x,y"). */
  windmills: Map<string, Windmill>;
}

// MARK: Ground

const hash = (x: number, y: number, k: number): number => seeded(x * 7919 + y * 104729 + k * 31)();

type Ground = "grass" | "path" | "plaza" | "flowers" | "water";
const GROUND: Record<string, Ground> = {
  ".": "grass",
  ",": "path",
  ":": "plaza",
  '"': "flowers",
  "~": "water",
};

function groundAt(map: TownMap, x: number, y: number): Ground {
  const own = GROUND[map.at(x, y)];
  if (own) return own;
  if ("IDA".includes(map.at(x, y)) || Object.values(SHOP_DOOR_CHAR).includes(map.at(x, y))) return "path";
  const counts = new Map<Ground, number>();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
  ] as const) {
    const g = GROUND[map.at(x + dx, y + dy)];
    if (g && g !== "water") counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "grass";
}

/** The whole ground in one canvas: grass, paths, plaza paving, flower meadows and the pond's water. */
function groundTexture(map: TownMap, px: number): THREE.CanvasTexture {
  const { look } = seasonLookNow();
  const l = bakedLook(look);
  const grassColors = [seasonGrass(0, l, "#86c35e"), seasonGrass(0, l, "#80bd58")];
  const blades = [seasonGrass(1, l), seasonGrass(2, l)];
  const W = map.width + MARGIN * 2;
  const D = map.height + MARGIN * 2;
  return canvasTexture(
    W * px,
    D * px,
    (g) => {
      const rnd = seeded(5);
      const leaves = (tx: number, ty: number, ox: number, oy: number, most: number) => {
        const n = Math.round(l.litter * most * hash(tx, ty, 60) * 2);
        for (let k = 0; k < n; k++) {
          g.fillStyle = seasonLitter(hash(tx, ty, 61 + k));
          g.fillRect(
            ox + hash(tx, ty, 70 + k) * px * 0.9,
            oy + hash(tx, ty, 80 + k) * px * 0.9,
            Math.max(1, px / 10),
            Math.max(1, px / 14),
          );
        }
      };
      for (let cy = 0; cy < D; cy++)
        for (let cx = 0; cx < W; cx++) {
          const tx = cx - MARGIN + map.x0;
          const ty = cy - MARGIN + map.y0;
          const inside = map.contains(tx, ty);
          const kind = inside ? groundAt(map, tx, ty) : "grass";
          const ox = cx * px;
          const oy = cy * px;
          const grass = () => {
            g.fillStyle = grassColors[(cx + cy) % 2]!;
            g.fillRect(ox, oy, px, px);
            for (let i = 0; i < px * 0.7; i++) {
              g.fillStyle = blades[rnd() < 0.5 ? 0 : 1]!;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, Math.max(1, px / 14), Math.max(2, px / 8));
            }
            // Fallen leaves, more on the lawns than on the swept paths (the 2D ground's litter).
            leaves(tx, ty, ox, oy, 3);
          };
          if (kind === "grass" || kind === "flowers") {
            grass();
            if (kind === "flowers" && hash(tx, ty, 9) >= l.dormant) {
              for (let k = 0; k < 4; k++) {
                const fx = ox + (2 + Math.floor(hash(tx, ty, 10 + k) * 11)) * (px / 16);
                const fy = oy + (2 + Math.floor(hash(tx, ty, 20 + k) * 11)) * (px / 16);
                g.fillStyle = [C.flowerRed, C.flowerYellow, C.flowerWhite][
                  Math.floor(hash(tx, ty, 30 + k) * 3)
                ]!;
                g.fillRect(fx - px / 16, fy, (px * 3) / 16, px / 16);
                g.fillRect(fx, fy - px / 16, px / 16, (px * 3) / 16);
              }
            }
          } else if (kind === "path") {
            g.fillStyle = C.path;
            g.fillRect(ox, oy, px, px);
            for (let i = 0; i < px * 0.8; i++) {
              g.fillStyle = rnd() < 0.5 ? C.pathDark : C.pathLight;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, Math.max(1, px / 14), Math.max(1, px / 14));
            }
            // A darker lip where it meets the lawn.
            const lawn = (dx: number, dy: number) => {
              const k = groundAt(map, tx + dx, ty + dy);
              return k === "grass" || k === "flowers";
            };
            g.fillStyle = C.pathDark;
            const e = Math.max(1, px / 12);
            if (lawn(0, -1)) g.fillRect(ox, oy, px, e);
            if (lawn(0, 1)) g.fillRect(ox, oy + px - e, px, e);
            if (lawn(-1, 0)) g.fillRect(ox, oy, e, px);
            if (lawn(1, 0)) g.fillRect(ox + px - e, oy, e, px);
            leaves(tx, ty, ox, oy, 1);
          } else if (kind === "plaza") {
            g.fillStyle = C.plaza;
            g.fillRect(ox, oy, px, px);
            const b = px / 2;
            g.fillStyle = C.plazaDark;
            for (let r = 0; r < 2; r++) {
              g.fillRect(ox, oy + r * b, px, Math.max(1, px / 16));
              const off = r % 2 ? b / 2 : 0;
              g.fillRect(ox + off, oy + r * b, Math.max(1, px / 16), b);
              g.fillRect(ox + off + b, oy + r * b, Math.max(1, px / 16), b);
            }
            g.fillStyle = C.plazaLight;
            g.fillRect(ox, oy + 1, px, Math.max(1, px / 20));
          } else {
            g.fillStyle = "#3f89c9";
            g.fillRect(ox, oy, px, px);
            g.fillStyle = C.water;
            g.fillRect(ox + 1, oy + 1, px - 2, px - 2);
            for (let i = 0; i < 4; i++) {
              g.fillStyle = C.waterDark;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, px / 5, px / 16);
            }
          }
        }
    },
    true,
  );
}

// MARK: Building the town

/**
 * The bushes' green on the day: bronzing a little in autumn, dull in winter. Only a little: the Voxel style draws a
 * bush as a cube, and a brown one reads as a cardboard box.
 */
function hedgeColour(l: SeasonLook): string {
  const c = new THREE.Color(LEAF[1]!);
  c.lerp(new THREE.Color("#8f8a35"), l.turn * 0.5);
  c.lerp(new THREE.Color("#5b7f4c"), l.dormant * (1 - l.turn) * 0.7);
  return `#${c.getHexString()}`;
}

/** The town's trees, picked by tile: two in six blossom in spring, two are evergreen. */
const SPECIES: Species[] = ["round", "cherry", "pine", "oak", "apple", "pine"];

/** Strips the point lights from a model: lamps dotted round the town only glow. */
function dim(m: THREE.Object3D): void {
  const lights: THREE.Object3D[] = [];
  m.traverse((o) => {
    if (o instanceof THREE.PointLight) lights.push(o);
  });
  for (const l of lights) l.parent?.remove(l);
}

/** Aarhus's wall clock, in minutes since midnight (`?clock=HH:MM` moves it). */
export function aarhusMinutes(): number {
  const forced = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get("clock") ?? "");
  if (forced) return Number(forced[1]) * 60 + Number(forced[2]);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0) % 24;
  return n("hour") * 60 + n("minute") + n("second") / 60;
}

/**
 * Sample companies for the town the headless room counts build (`world-rooms.ts`, `perf/headless.ts`): one of each
 * house tier, round the square, with parks in the gaps.
 */
export const SAMPLE_COMPANIES: Company[] = [
  {
    id: 1,
    name: "Nightshift Labs",
    plot: plotId(2, 0),
    members: 4,
    tokens30d: 400e9,
    brand: {
      roof: "#3f7a78",
      wall: "#f6ecd6",
      trim: "#d4a93a",
      plaque: "#1f2a3c",
      logo: logo("N", "#d4a93a", "#1f2a3c"),
    },
  },
  {
    id: 2,
    name: "Pixel Forge",
    plot: plotId(2, 1),
    members: 6,
    tokens30d: 150e9,
    brand: {
      roof: "#4f8fe0",
      wall: "#fbf4e6",
      trim: "#8a6d3b",
      plaque: "#ffffff",
      logo: logo("P", "#4f8fe0", "#ffffff"),
    },
    deskFleet: 3,
  },
  {
    id: 3,
    name: "Rubber Duck",
    plot: plotId(-1, 0),
    members: 3,
    tokens30d: 30e9,
    brand: {
      roof: "#e25d5d",
      wall: "#ffffff",
      trim: "#3b62a8",
      plaque: "#f5d14a",
      logo: logo("D", "#e25d5d", "#f5d14a"),
    },
    deskFleet: 1,
  },
  { id: 4, name: "Solo", plot: plotId(-1, 1), members: 1, tokens30d: 3e9, brand: null },
  { id: 5, name: "Hobby Hackers", plot: plotId(0, 2), members: 5, tokens30d: 1e9, brand: null },
  {
    id: 6,
    name: "Cellar Dwellers",
    plot: plotId(3, 0),
    members: 9,
    tokens30d: 0.2e9,
    brand: {
      roof: "#7a5a9a",
      wall: "#d49c67",
      trim: "#5b3fbf",
      plaque: "#e4f5fd",
      logo: logo("C", "#5b3fbf", "#e4f5fd"),
    },
  },
];

/** A little SVG monogram as a data URL, so the sample companies have logos without any files. */
function logo(letter: string, fg: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="18" fill="${bg}"/><circle cx="48" cy="48" r="34" fill="${fg}"/><text x="48" y="64" font-family="system-ui,sans-serif" font-weight="900" font-size="46" text-anchor="middle" fill="${bg}">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Builds the town for these companies. */
export function buildTown3d(
  companies: readonly Company[],
  /** `arcade: false`: the real game's town, which has no arcade (its games are tables on the square). */
  opts: { arcade?: boolean } = {},
): Town3d {
  const plain = townMap(companies.map((c) => c.plot));
  // The arcade has no tile in the 2D map: it takes the park nearest the square (if the town has one),
  // with its door tile `A` and a path down to the road.
  const rows = plain.rows.map((r) => [...r]);
  const park = (opts.arcade === false ? [] : [...plain.parks]).sort(
    (a, b) => Math.hypot(a[0] - 0.5, a[1] - 0.5) - Math.hypot(b[0] - 0.5, b[1] - 0.5),
  )[0];
  const set = (tx: number, ty: number, ch: string) => {
    rows[ty - plain.y0]![tx - plain.x0] = ch;
  };
  if (park) {
    const [bx, by] = park;
    for (let dy = 1; dy <= 6; dy++)
      for (let dx = 1; dx <= 9; dx++) {
        const tx = bx * BLOCK_W + dx;
        const ty = by * BLOCK_H + dy;
        if ('T^"'.includes(plain.at(tx, ty))) set(tx, ty, ".");
      }
    set(bx * BLOCK_W + 5, by * BLOCK_H + 6, "A");
    for (const dy of [7, 8]) set(bx * BLOCK_W + 5, by * BLOCK_H + dy, ",");
  }
  // The shops stand where the game's town has them (`shopBlocks`): the map already has each 5x4 front (`Ħ`)
  // with its door tile (5, 6 in its block) and the path down to the road.
  const shopSlots: { id: ShopId; bx: number; by: number }[] = SHOP_IDS.flatMap((id) => {
    const door = plain.find(SHOP_DOOR_CHAR[id])[0];
    return door ? [{ id, bx: Math.floor(door[0] / BLOCK_W), by: Math.floor(door[1] / BLOCK_H) }] : [];
  });
  const map = new TownMap(
    rows.map((r) => r.join("")),
    plain.x0,
    plain.y0,
    plain.parks,
  );
  const W = map.width + MARGIN * 2;
  const D = map.height + MARGIN * 2;
  const wx = (tx: number) => tx - map.x0 + MARGIN;
  const wz = (ty: number) => ty - map.y0 + MARGIN;
  const toWorld = (tx: number, ty: number): [number, number] => [wx(tx) + 0.5, wz(ty) + 0.5];
  const toTile = (x: number, z: number): [number, number] => [
    Math.floor(x) + map.x0 - MARGIN,
    Math.floor(z) + map.y0 - MARGIN,
  ];

  // The street in front of each shop door stays clear of trees, so the storefront shows.
  const clearOf = (x: number, z: number): boolean =>
    shopSlots.some((q) => {
      const [cx, cz] = toWorld(q.bx * BLOCK_W + 5, q.by * BLOCK_H + 6);
      return x - cx > -3.2 && x - cx < 7 && z > cz + 1.6;
    });
  const g = new THREE.Group();
  const px = Math.max(8, Math.min(32, Math.floor(textureCap() / Math.max(W, D))));
  const dirt = toon("#7a5638");
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, D), [
    dirt,
    dirt,
    painted(groundTexture(map, px)),
    dirt,
    dirt,
    dirt,
  ]);
  ground.position.set(W / 2, -0.3, D / 2);
  ground.receiveShadow = true;
  g.add(ground);

  const add = (m: THREE.Object3D, x: number, z: number, turn = 0, scale = 1) => {
    m.position.set(x, 0, z);
    m.rotation.y = turn;
    m.scale.setScalar(scale);
    g.add(m);
    return m;
  };
  // The season's look, as baked (`core/src/seasons.ts`): the town is built again when it changes.
  const season = bakedLook(seasonLookNow().look);
  const hedge = hedgeColour(season);
  const canopies: [number, number, number][] = [];
  /** A tree for the season; a broadleaf's crown is where leaves fall from. */
  const plant = (species: Species, seed: number, size: number, x: number, z: number) => {
    add(seasonalTree(species, seed, size, season), x, z);
    if (species !== "pine") canopies.push([x, 1.35 * size * (species === "oak" ? 1.6 : 1), z]);
  };
  const doors: TownDoor[] = [];
  const seats: TownSpots["seats"] = [];
  const houses = new Map<number, Model>();
  const papers: Model[] = [];
  const byPlot = new Map(companies.map((c) => [c.plot, c]));

  // —— Tile props ——
  const flowers: [number, number, string][] = [];
  const stones: [number, number, number][] = [];
  const water: [number, number][] = [];
  const mills: [number, number][] = [];
  const fountains = map.find("F");
  const fxs = fountains.map(([x]) => x);
  const fys = fountains.map(([, y]) => y);
  // The middle of its 2x2 tiles.
  const fountainX = wx((Math.min(...fxs) + Math.max(...fxs) + 1) / 2);
  const fountainZ = wz((Math.min(...fys) + Math.max(...fys) + 1) / 2);
  const boards = { leaderboard: leaderboard(), chalkboard: chalkboard(), stars: starCounter() };
  let lampIndex = 0;
  for (let ty = map.y0; ty < map.y0 + map.height; ty++)
    for (let tx = map.x0; tx < map.x0 + map.width; tx++) {
      const ch = map.at(tx, ty);
      const [cx, cz] = toWorld(tx, ty);
      const r = hash(tx, ty, 77);
      const border =
        tx === map.x0 || ty === map.y0 || tx === map.x0 + map.width - 1 || ty === map.y0 + map.height - 1;
      switch (ch) {
        case "T": {
          if (clearOf(cx, cz)) break;
          plant(
            SPECIES[Math.floor(hash(tx, ty, 3) * SPECIES.length)]!,
            Math.floor(r * 1e6),
            (border ? 1.1 : 1) + hash(tx, ty, 4) * 0.3,
            cx + (r - 0.5) * 0.5,
            cz + (hash(tx, ty, 5) - 0.5) * 0.5,
          );
          break;
        }
        case "^":
          add(bush(Math.floor(r * 1e6), hedge), cx, cz, 0, 1.3);
          break;
        case "L":
          add(lanternPillar(), cx, cz);
          lampIndex++;
          break;
        case "B": {
          // Benches face the fountain square-on, along whichever axis it lies further.
          const [dx, dz] = fountains.length ? [fountainX - cx, fountainZ - cz] : [0, 1];
          const turn = Math.abs(dx) > Math.abs(dz) ? (Math.sign(dx) * Math.PI) / 2 : dz < 0 ? Math.PI : 0;
          add(parkBench(), cx, cz, turn);
          seats.push({ at: [cx + Math.sin(turn) * 0.05, cz + Math.cos(turn) * 0.05], y: 0.38, turn });
          break;
        }
        case "N":
          add(boards.leaderboard, cx, cz + 0.2);
          break;
        case "★":
          add(boards.stars, cx, cz + 0.2);
          break;
        case "K":
          add(boards.chalkboard, cx, cz);
          break;
        case "o":
          add(coffeeStand(), cx, cz + 0.1);
          break;
        case WINDMILL:
          if (map.at(tx - 1, ty) !== ch && map.at(tx, ty - 1) !== ch) mills.push([tx, ty]);
          break;
        case "G":
          add(dungeonGate(), cx, cz + 0.25);
          doors.push({ id: "dungeon", kind: "dungeon", label: "Raid dungeon", tile: [tx, ty], at: [cx, cz] });
          break;
        case '"':
          flowers.push([cx, cz, `${tx},${ty}`]);
          break;
        case "~":
          water.push([cx, cz]);
          for (const [dx, dy, a] of [
            [0, -1, 0],
            [0, 1, 1],
            [-1, 0, 2],
            [1, 0, 3],
          ] as const)
            if (map.at(tx + dx, ty + dy) !== "~") stones.push([cx + dx * 0.5, cz + dy * 0.5, a]);
          break;
        default:
      }
    }
  void lampIndex;

  // The fountain, over its 2x2 tiles.
  if (fountains.length) add(grandFountain(), fountainX, fountainZ, 0, 0.62);

  // The windmills, each in the middle of its 2x2 tiles, turning with the weather's wind.
  const windmills = new Map<string, Windmill>();
  for (const [tx, ty] of mills)
    windmills.set(`${tx},${ty}`, add(windmill(), wx(tx) + 1, wz(ty) + 1) as Windmill);
  let weather: () => Weather = () => CALM;
  let windAt: number | null = null;
  if (windmills.size)
    ticks.push((t) => {
      const dt = windAt === null ? 0 : Math.min(0.5, Math.max(0, t - windAt));
      windAt = t;
      const w = weather();
      for (const mill of windmills.values()) mill.update(dt, w);
    });

  // Flower meadows: a few blossoms on every flower tile, one instanced mesh.
  if (flowers.length) {
    const colours = ["#e8584f", "#f5d14a", "#fbf7ef", "#c86bd8", "#ff8a5c", "#ff7ab6", "#8fb8ff"];
    const per = 6;
    const blossoms = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 6, 5),
      toon("#ffffff"),
      flowers.length * per,
    );
    const tufts = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 6, 5),
      toon(C.leaf),
      flowers.length * per,
    );
    const m4 = new THREE.Matrix4();
    flowers.forEach(([x, z], i) => {
      const rnd = seeded(i * 97 + 3);
      for (let k = 0; k < per; k++) {
        const fx = x + (rnd() - 0.5) * 0.85;
        const fz = z + (rnd() - 0.5) * 0.85;
        const n = i * per + k;
        // In winter the meadows rest: the blossoms go, a tile at a time, and the tufts stay.
        m4.makeTranslation(fx, 0.2, fz);
        if (hash(i, 0, 9) < season.dormant) m4.scale(new THREE.Vector3(0, 0, 0));
        blossoms.setMatrixAt(n, m4);
        blossoms.setColorAt(n, new THREE.Color(colours[Math.floor(rnd() * colours.length)]!));
        m4.makeScale(1, 0.7, 1).setPosition(fx, 0.08, fz);
        tufts.setMatrixAt(n, m4);
      }
    });
    blossoms.castShadow = tufts.castShadow = false;
    g.add(tufts, blossoms);
  }

  // The pond: shallow water with a sparkle that drifts, a rim of stones, lily pads.
  if (water.length) {
    const glint = canvasTexture(64, 64, (c) => {
      const rnd = seeded(8);
      for (let i = 0; i < 14; i++) {
        c.fillStyle = "rgba(255,255,255,0.7)";
        c.fillRect(Math.floor(rnd() * 60), Math.floor(rnd() * 64), 3 + Math.floor(rnd() * 5), 1);
      }
    });
    glint.wrapS = glint.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({
      map: glint,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });
    ticks.push((t) => glint.offset.set((t * 0.05) % 1, (t * 0.02) % 1));
    const sheet = glass("#58a9e2", 0.55);
    for (const [x, z] of water) {
      const tint2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheet);
      tint2.rotation.x = -Math.PI / 2;
      tint2.position.set(x, 0.03, z);
      g.add(tint2);
    }
    // The sparkle drifts, so the batching leaves it alone: one mesh for the whole pond rather than one per tile. It sits
    // in the middle of the pond (blended things sort by where they are), drawn after the water sheet as the tiles were.
    const [cx, cz] = water.reduce(([a, b], [x, z]) => [a + x / water.length, b + z / water.length], [0, 0]);
    const glints = new THREE.Mesh(
      mergeGeometries(
        water.map(([x, z]) =>
          new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(x - cx, 0.035, z - cz),
        ),
      )!,
      mat,
    );
    glints.position.set(cx, 0, cz);
    glints.renderOrder = 1;
    g.add(glints);
    // Ice, below freezing (`cold3d.ts`): a pale sheet over the water with glare and cracks, the sparkle gone under it.
    const cracks = canvasTexture(96, 96, (c) => {
      const rnd = seeded(12);
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, 96, 96);
      c.fillStyle = "#f2f9fd";
      for (let i = 0; i < 6; i++) c.fillRect(0, Math.floor(rnd() * 96), 96, 2);
      c.strokeStyle = "#8fb8d6";
      c.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        let [x, y] = [rnd() * 96, rnd() * 96];
        c.beginPath();
        c.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rnd() - 0.5) * 30;
          y += (rnd() - 0.5) * 30;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    });
    cracks.wrapS = cracks.wrapT = THREE.RepeatWrapping;
    const iceMat = glass("#a9d4ee", 0);
    iceMat.map = cracks;
    const sheetOfIce = mergeGeometries(
      water.map(([x, z]) =>
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(x - cx, 0.04, z - cz),
      ),
    )!;
    // Texture by where it is, not per tile, so the cracks run on across the pond.
    const at = sheetOfIce.attributes.position!;
    const uv = sheetOfIce.attributes.uv!;
    for (let i = 0; i < at.count; i++) uv.setXY(i, (at.getX(i) + cx) / 3, (at.getZ(i) + cz) / 3);
    const ice = new THREE.Mesh(sheetOfIce, iceMat);
    ice.position.set(cx, 0, cz);
    ice.renderOrder = 2;
    ice.userData.nobatch = true;
    ice.visible = false;
    g.add(ice);
    ticks.push(() => {
      ice.visible = ICE.value > 0.01;
      iceMat.opacity = 0.85 * ICE.value;
      mat.opacity = 0.8 * (1 - ICE.value);
    });
    const rock = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.17, 8, 6),
      toon(C.stoneLight),
      stones.length * 2,
    );
    const m4 = new THREE.Matrix4();
    stones.forEach(([x, z, side], i) => {
      for (let k = 0; k < 2; k++) {
        const along = (k - 0.5) * 0.5 + (hash(i, k, 9) - 0.5) * 0.1;
        const horizontal = side < 2;
        m4.makeScale(horizontal ? 1.5 : 0.9, 0.55, horizontal ? 0.9 : 1.5).setPosition(
          horizontal ? x + along : x,
          0.06,
          horizontal ? z : z + along,
        );
        rock.setMatrixAt(i * 2 + k, m4);
        rock.setColorAt(i * 2 + k, new THREE.Color((i + k) % 3 ? C.stoneLight : C.stone));
      }
    });
    rock.castShadow = rock.receiveShadow = true;
    g.add(rock);
    for (let i = 0; i < Math.min(5, water.length); i++) {
      const [x, z] = water[Math.floor(hash(i, 1, 2) * water.length)]!;
      const pad = new Model();
      pad.cyl(0.18, 0.012, "#58b36a", [0, 0.045, 0], 0.18, 12);
      if (i % 2) pad.ball(0.05, "#ff9ac4", [0, 0.09, 0]);
      add(pad, x + (hash(i, 3, 3) - 0.5) * 0.5, z + (hash(i, 4, 4) - 0.5) * 0.5);
    }
  }

  // —— The forest beyond the tree ring ——
  const rnd = seeded(21);
  for (let cy = 0; cy < D; cy++)
    for (let cx = 0; cx < W; cx++) {
      const ring = Math.min(cx, cy, W - 1 - cx, D - 1 - cy);
      if (ring >= MARGIN) continue;
      if (rnd() < 0.5 + ring * 0.15) continue;
      const species = SPECIES[Math.floor(rnd() * SPECIES.length)]!;
      const seed = Math.floor(rnd() * 1e6);
      const size = 1 + rnd() * 0.4;
      const tx = cx + 0.5 + (rnd() - 0.5) * 0.6;
      const tz = cz0(cy) + (rnd() - 0.5) * 0.6;
      if (!clearOf(tx, tz)) plant(species, seed, size, tx, tz);
    }
  function cz0(cy: number): number {
    return cy + 0.5;
  }

  // —— The Tavern (tile I) ——
  const inn = map.find("I")[0];
  if (inn) {
    const [ix, iy] = inn;
    const [cx] = toWorld(ix, iy);
    add(tavernBuilding(), cx, wz(iy) + 0.4);
    doors.push({ id: "inn", kind: "inn", label: "The Tavern", tile: [ix, iy], at: toWorld(ix, iy) });
  }

  // —— Company houses (tile D) ——
  for (const [dx, dy] of map.find("D")) {
    const plot = plotId(...blockOf(dx, dy));
    const c = byPlot.get(plot);
    const tier = c ? houseTier(c.tokens30d, c.members) : 0;
    const model = companyHouse(tier, c?.name ?? "Vacant", c?.brand ?? null);
    const [cx] = toWorld(dx, dy);
    add(model, cx, wz(dy) + 0.25);
    houses.set(plot, model);
    doors.push({
      id: `hq:${plot}`,
      kind: "hq",
      label: c ? `${c.name} (${HOUSE_TIER_NAMES[tier]})` : "Vacant lot",
      plot,
      companyId: c?.id,
      tile: [dx, dy],
      at: toWorld(dx, dy),
    });
    // The morning paper's spot, on the grass right of the path below.
    const paper = paperRoll();
    paper.visible = false;
    paper.userData.door = [dx, dy];
    add(paper, wx(dx + 1) + 0.5, wz(dy + 1) + 0.5, 0.5);
    papers.push(paper);
  }

  // —— The arcade (in a park) ——
  const arcade = map.find("A")[0];
  if (arcade) {
    const [ax, ay] = arcade;
    add(arcadeBuilding(), wx(ax) + 0.5, wz(ay) - 2.2);
    doors.push({ id: "arcade", kind: "arcade", label: "Arcade", tile: [ax, ay], at: toWorld(ax, ay) });
  }

  // —— The shops (tiles ƒ ç ß π) ——
  for (const slot of shopSlots) {
    const dx = slot.bx * BLOCK_W + 5;
    const dy = slot.by * BLOCK_H + 6;
    const [cx] = toWorld(dx, dy);
    add(SHOP_SPECS[slot.id].exterior(), cx, wz(dy) + 0.95);
    doors.push({
      id: `shop:${slot.id}`,
      kind: "shop",
      label: SHOP_SPECS[slot.id].name,
      shop: slot.id,
      tile: [dx, dy],
      at: toWorld(dx, dy),
    });
  }

  // —— Street lamps at every lot and park corner ——
  for (let by = Math.floor(plain.y0 / BLOCK_H); by * BLOCK_H < plain.y0 + plain.height; by++)
    for (let bx = Math.floor(plain.x0 / BLOCK_W); bx * BLOCK_W < plain.x0 + plain.width; bx++) {
      if (CORE_BLOCKS.some(([cx, cy]) => cx === bx && cy === by)) continue;
      if (!map.contains(bx * BLOCK_W + 1, by * BLOCK_H + 1)) continue;
      const lamp = streetLamp();
      dim(lamp);
      add(lamp, wx(bx * BLOCK_W) + 0.5, wz(by * BLOCK_H + 1) + 0.5, Math.PI);
    }

  // —— Street life ——
  const cart = polseCart();
  add(cart, wx(CART[0]![0]) + 1, wz(CART[0]![1]) + 0.5);
  const snail = buildSnail();
  g.add(snail);
  const flag = goalFlag();
  add(flag, wx(SNAIL.to) + 0.5, wz(SNAIL.y) + 0.5);
  const bike = paperBike();
  bike.visible = false;
  g.add(bike);
  let clock = aarhusMinutes;
  const rides = rideList(
    doors.filter((d) => d.kind === "hq").map((d) => d.tile),
    map.x0,
    map.x0 + map.width,
  );
  let lastOpen: boolean | null = null;
  ticks.push((t) => {
    const m = clock();
    const open = m >= 11 * 60 && m < 14 * 60;
    if (open !== lastOpen) {
      lastOpen = open;
      cart.setOpen(open);
    }
    // The snail: 07:00 to 17:00 along its row.
    const p = Math.min(1, Math.max(0, (m - SNAIL.leaves) / (SNAIL.arrives - SNAIL.leaves)));
    snail.position.set(wx(SNAIL.from + (SNAIL.to - SNAIL.from) * p) + 0.5, 0, wz(SNAIL.y) + 0.5);
    snail.inch(t);
    // The paperboy.
    const ride = rides.find((r) => m >= r.at && m < r.at + (r.to - r.from) / 4 / 60);
    bike.visible = !!ride;
    if (ride) {
      bike.position.set(wx(ride.from + (m - ride.at) * 4 * 60) + 0.5, 0, wz(ride.y) + 0.5);
      bike.pedal(t);
    }
    for (const paper of papers) {
      const [dx, dy] = paper.userData.door as [number, number];
      const road = (Math.floor(dy / BLOCK_H) + 1) * BLOCK_H;
      const r = rides.find((q) => q.y === road);
      paper.visible = !!r && m >= r.at + Math.max(0, dx + 1 - r.from) / 4 / 60;
    }
  });

  // —— Where people go ——
  const ringW = PLAZA.right - PLAZA.left;
  const ringH = PLAZA.bottom - PLAZA.top;
  const ring: [number, number][] = [
    toWorld(PLAZA.left, PLAZA.top),
    toWorld(PLAZA.right, PLAZA.top),
    toWorld(PLAZA.right, PLAZA.bottom),
    toWorld(PLAZA.left, PLAZA.bottom),
  ];
  void ringW;
  void ringH;
  const spots: TownSpots = {
    routes: [{ points: ring, loop: true }],
    seats,
    start: toWorld(...TOWN_SPAWN),
  };

  return {
    group: g,
    size: [W, D],
    map,
    doors,
    doorOf: (plot) => doors.find((d) => d.plot === plot),
    toWorld,
    toTile,
    spots,
    boards,
    houses,
    setClock: (f) => {
      clock = f;
    },
    canopies,
    setWeather: (f) => {
      weather = f;
    },
    windmills,
  };
}

/** The paperboy's rounds (`paperRides`): along the road below each row of blocks that has a door. */
function rideList(doors: readonly [number, number][], left: number, right: number) {
  const roads = [...new Set(doors.map(([, y]) => (Math.floor(y / BLOCK_H) + 1) * BLOCK_H))].sort(
    (a, b) => a - b,
  );
  const minutes = (right - left) / 4 / 60;
  return roads.map((y, i) => ({ y, from: left, to: right, at: 7 * 60 + i * minutes }));
}

// MARK: Assets

const footprint = (m: Model, w: number, d: number, dz: number): Model => {
  const out = new Model();
  m.position.set(0, 0, dz);
  out.add(m);
  void w;
  void d;
  return out;
};

const tileAsset = (
  id: string,
  name: string,
  build: () => Model,
  w = 1,
  d = 1,
  extra: Partial<Asset> = {},
): Asset => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
  ...extra,
});

/** The town's props and buildings as catalog assets (ids are the 2D tile characters, `tile:<char>`). */
export const TOWN3D_ASSETS: readonly Asset[] = [
  tileAsset("tile:T", "Tree", () => tree("oak", 6, 1)),
  tileAsset("tile:^", "Bush", () => bush(5)),
  tileAsset("tile:L", "Lamp", lanternPillar),
  tileAsset(
    "tile:F",
    "Fountain",
    () => {
      const m = new Model();
      m.add(grandFountain());
      m.scale.setScalar(0.62);
      return m;
    },
    2,
    2,
  ),
  tileAsset("tile:B", "Bench", parkBench, 1, 1, { seat: { at: [0, 0.38, 0.05], turn: 0 } }),
  tileAsset("tile:N", "Leaderboard", leaderboard),
  tileAsset("tile:★", "Star counter", starCounter),
  tileAsset("tile:K", "Chalkboard", chalkboard),
  tileAsset("tile:w", "Open offices board", openOfficesBoard),
  tileAsset("tile:o", "Coffee stand", coffeeStand),
  tileAsset("tile:G", "Dungeon gate", dungeonGate),
  tileAsset(`tile:${WINDMILL}`, "Windmill", windmill, 2, 2),
  tileAsset("building:inn", "The Tavern", () => footprint(tavernBuilding(), 7, 4, 1.6), 7, 4),
  tileAsset("building:arcade", "Arcade", () => footprint(arcadeBuilding(), 7, 5, 0), 7, 5),
  ...HOUSE_TIER_NAMES.map((n, i) =>
    tileAsset(
      `building:house-${i}`,
      `${n} house`,
      () => footprint(companyHouse(i, n, null), 7, 5, 1.75),
      7,
      5,
    ),
  ),
  tileAsset("street:polse-cart", "Pølsevogn", polseCart, 2, 1),
  tileAsset("street:snail", "Build snail", buildSnail),
  tileAsset("street:goal-flag", "Goal flag", goalFlag),
  tileAsset("street:paperboy", "Paperboy's bike", paperBike, 2, 1),
  tileAsset("street:paper", "Morning paper", paperRoll),
];

void plotBlock;
void doorOf;
void nightGlow;
void tint;
