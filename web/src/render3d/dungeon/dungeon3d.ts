/**
 * The raid dungeon and its cast, in 3D: the dais, torches, war desks, the boss HP terminal, the gate and
 * doors; the four bosses (with a hit flash, HP bar and death), robot minions; the raid's loot by rarity;
 * the merchant's numbered editions; the 26 trophies and the shelf that holds them; and the 24 badges as
 * small medals in their tier colours. The 2D pixel grids are extruded (`voxels`), so each model is the
 * same art, given depth. Data snapshots live in `data/dungeon.ts`.
 */
import { FRAMES as BADGE_FRAMES } from "@tokenmaxxing/core/badges.ts";
import { SHELF_SLOTS } from "@tokenmaxxing/core/trophies.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import {
  BADGE_DEFS,
  DUNGEON_BOSSES,
  EDITION_GLASSES,
  EDITION_HATS,
  EDITION_LIST,
  LOOT_GLASSES,
  LOOT_HATS,
  LOOT_OUTFITS,
  LOOT_TABLE,
  type Palette,
  RARITY_INFO,
  TIER_COLORS,
  TROPHY_ART,
  TROPHY_DEFS,
} from "../data/dungeon.ts";
import { type Asset, light } from "../furniture/furniture.ts";
import {
  canvasTexture,
  codeScreen,
  glass,
  glow,
  liveModel,
  Model,
  painted,
  ticks,
  tint,
  toon,
  type V3,
} from "../kit/kit.ts";
import { petFrom2D } from "../pets/pets3d.ts";
import { buildStairs } from "../rooms/exits3d.ts";
import { buildBoss, buildMinion, buildTrophy, flash, type Sculpt } from "./bossvox.ts";

// MARK: Dungeon colours (web/src/art/tiles.ts)

export const STONE = {
  floor: "#2f2b3a",
  floorDark: "#24212d",
  floorLight: "#3b3647",
  dais: "#4a4459",
  daisDark: "#2a2633",
  daisLight: "#5d5670",
  rune: "#b98cff",
  wall: "#3a3446",
  wallDark: "#2a2533",
  wallTop: "#1c1924",
} as const;

const GOLD = "#f5c842";
const GOLD_DARK = "#c9971f";
const GOLD_LIGHT = "#fff1a8";

// MARK: Pixel grids to 3D

interface Cell {
  mesh: THREE.Mesh;
  ch: string;
  mat: THREE.Material;
}

export interface Voxels {
  model: Model;
  cells: Cell[];
  /** Width and height in world units. */
  w: number;
  h: number;
}

interface VoxelOpts {
  /** Depth per colour key (default 0.2). */
  depth?: number | ((ch: string) => number);
  /** Keys that glow (eyes, flames, gems). */
  glows?: string;
  /** Rows start this far up (default 0). */
  y?: number;
  /** Flip left to right. */
  flip?: boolean;
  /** A key to colour as a ghost (translucent). */
  ghost?: boolean;
  /** A ghost drawn in dark opaque paint instead, so many of them can share a draw call (the game's shelf). */
  solidGhost?: boolean;
}

/**
 * Extrudes a string grid: each run of one colour in a row becomes one box, `px` a pixel. The model is
 * centred on x and z, its bottom row on y = 0, facing +z (the front of the grid).
 */
export function voxels(rows: readonly string[], pal: Palette, px: number, opts: VoxelOpts = {}): Voxels {
  const m = new Model();
  const cells: Cell[] = [];
  const width = Math.max(...rows.map((r) => r.length));
  const H = rows.length;
  const depthOf = (ch: string) => (typeof opts.depth === "function" ? opts.depth(ch) : (opts.depth ?? 0.2));
  if (opts.ghost && opts.solidGhost) {
    // One dark paint, so only the shape and depth matter: the biggest boxes that cover it, not one per colour.
    const paint = toon(tint("#14101c", -0.2));
    const grid = rows.map((row) =>
      [...(opts.flip ? [...row].reverse().join("") : row)].map((ch) =>
        pal[ch] === undefined || (ch === "." && !(ch in pal)) ? null : depthOf(ch),
      ),
    );
    const used = grid.map((row) => row.map(() => false));
    grid.forEach((row, r) => {
      for (let x = 0; x < row.length; x++) {
        const d = row[x];
        if (d == null || used[r]![x]) continue;
        let n = 1;
        while (x + n < row.length && row[x + n] === d && !used[r]![x + n]) n++;
        let h = 1;
        while (
          r + h < grid.length &&
          Array.from({ length: n }, (_, i) => grid[r + h]![x + i] === d && !used[r + h]![x + i]).every(
            Boolean,
          )
        )
          h++;
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < n; dx++) used[r + dy]![x + dx] = true;
        const mesh = m.box(
          [n * px, h * px, d],
          paint,
          [(x + n / 2 - width / 2) * px, (H - r - h / 2) * px + (opts.y ?? 0) - px / 2, 0],
          0,
        );
        cells.push({ mesh, ch: ".", mat: mesh.material as THREE.Material });
      }
    });
    return { model: m, cells, w: width * px, h: H * px };
  }
  rows.forEach((row, r) => {
    const line = opts.flip ? [...row].reverse().join("") : row;
    let x = 0;
    while (x < line.length) {
      const ch = line[x]!;
      let n = 1;
      while (x + n < line.length && line[x + n] === ch) n++;
      const colour = pal[ch];
      if (colour !== undefined && !(ch === "." && !(ch in pal))) {
        const d = depthOf(ch);
        const paint =
          opts.ghost && opts.solidGhost
            ? toon(tint(colour.startsWith("rgba") ? "#14101c" : colour, -0.62))
            : opts.ghost
              ? glass(colour.startsWith("rgba") ? "#14101c" : colour, 0.35)
              : opts.glows?.includes(ch)
                ? glow(colour)
                : toon(colour);
        const mesh = m.box(
          [n * px, px, d],
          paint,
          [(x + n / 2 - width / 2) * px, (H - 1 - r) * px + (opts.y ?? 0), 0],
          0,
        );
        cells.push({ mesh, ch, mat: mesh.material as THREE.Material });
      }
      x += n;
    }
  });
  return { model: m, cells, w: width * px, h: H * px };
}

/** Runs `fn` every frame while the model hangs in a scene. */
function tick(m: THREE.Object3D, fn: (t: number) => void): void {
  ticks.push((t) => {
    if (m.parent) fn(t);
  });
}

/** A few gold stars that come and go round `at`: a legendary's sparkle. */
function sparkle(m: Model, at: V3, color: string, n = 4, spread = 0.45): void {
  const stars = Array.from({ length: n }, () => m.box([0.04, 0.04, 0.04], glow(color), at, 0));
  tick(m, (t) => {
    stars.forEach((s, i) => {
      const k = (((t / 1.1 + i * 0.27) % 1) + 1) % 1;
      const a = i * 1.7 + Math.floor(t / 1.1 + i * 0.27) * 2.3;
      s.position.set(
        at[0] + Math.cos(a) * spread,
        at[1] + Math.sin(a * 1.3) * spread * 0.5 + k * 0.2,
        at[2] + Math.sin(a) * spread * 0.6,
      );
      s.scale.setScalar(k < 0.6 ? 1.6 - k * 2 : 0.001);
    });
  });
}

/** Turns a mesh group to face the camera about y, whatever turns its parents have. */
function billboard(group: THREE.Object3D, mesh: THREE.Mesh): void {
  const here = new THREE.Vector3();
  const q = new THREE.Quaternion();
  mesh.onBeforeRender = (_r, _s, camera) => {
    group.getWorldPosition(here);
    const yaw = Math.atan2(camera.position.x - here.x, camera.position.z - here.z);
    group.parent?.getWorldQuaternion(q);
    group.rotation.y = yaw - new THREE.Euler().setFromQuaternion(q, "YXZ").y;
  };
}

const compact = (n: number): string =>
  n >= 1e9
    ? `${+(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${+(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${+(n / 1e3).toFixed(1)}k`
        : String(Math.round(n));

// MARK: Bosses

const bossSculpt = (id: string, silhouette: boolean): Sculpt => buildBoss(id, silhouette);

const hpColour = (share: number) => (share > 0.5 ? "#72bf52" : share > 0.2 ? "#e9b73d" : "#e06c5f");

/** A boss on its dais: hovering, with its name and HP over it. `hit`, `kill` and `spawn` drive a fight. */
export class BossActor {
  readonly root = liveModel();
  private readonly body = new Model();
  private sc: Sculpt;
  private readonly plate: Model;
  private readonly plateTex: THREE.CanvasTexture;
  private readonly floats: { m: Model; at: number }[] = [];
  private readonly trophy: Model;
  private bossIndex: number;
  private now = 0;
  private hitAt = -10;
  private fellAt = -10;
  private arriveAt = -10;
  private attackAt = -10;
  private nextAttack = 5;
  private taunt = { text: "", at: -100 };
  private nextTaunt = 3;
  /** The real raid's words for the plate (a rung's name with its numeral, the week-over line), taunts and quiet. */
  private info: { name: string; emoji: string } | null = null;
  private banner: string | null = null;
  private taunts: readonly string[] | null = null;
  private quiet = false;
  private bar = true;
  private veil: THREE.Mesh | null = null;
  hp = 1;
  maxHp = 1;
  rung = 1;
  silhouette: boolean;
  /** The 2D constants: a hit flashes for 450 ms, a fall takes 1.6 s, an arrival 0.7 s. */
  static HURT = 0.45;
  static FALL = 1.6;
  static ARRIVE = 0.7;

  constructor(
    bossId = "rate-limit",
    opts: {
      silhouette?: boolean;
      hp?: number;
      maxHp?: number;
      rung?: number;
      taunts?: boolean;
      plate?: boolean;
    } = {},
  ) {
    this.silhouette = opts.silhouette ?? false;
    this.bossIndex = Math.max(
      0,
      DUNGEON_BOSSES.findIndex((b) => b.id === bossId),
    );
    this.maxHp = opts.maxHp ?? 2e9;
    this.hp = opts.hp ?? this.maxHp * 0.8;
    this.rung = opts.rung ?? this.bossIndex + 1;
    this.root.add(this.body);
    this.root.cyl(0.85, 0.02, "#15121b", [0, 0, 0], 0.85, 24).castShadow = false;
    this.sc = bossSculpt(this.bossId, this.silhouette);
    this.body.add(this.sc.root);
    this.trophy = new Model();
    this.trophy.add(bossTrophy());
    this.trophy.visible = false;
    this.root.add(this.trophy);

    this.plate = new Model();
    this.plate.position.y = this.sc.height + 0.55;
    this.plateTex = canvasTexture(320, 76, () => {}, true);
    const face = this.plate.plane(2.8, 0.665, glow("#fff", this.plateTex), [0, 0, 0]);
    this.plate.visible = opts.plate !== false;
    this.root.add(this.plate);
    billboard(this.plate, face);
    this.draw();
    if (opts.taunts !== false) this.nextTaunt = 3;
    else this.nextTaunt = Infinity;
    this.root.userData.boss = this;
    ticks.push((t) => this.update(t));
  }

  get bossId(): string {
    return DUNGEON_BOSSES[this.bossIndex]!.id;
  }

  get boss(): (typeof DUNGEON_BOSSES)[number] {
    return DUNGEON_BOSSES[this.bossIndex]!;
  }

  get fallen(): boolean {
    return this.now - this.fellAt < 1e5 && this.fellAt > 0;
  }

  /**
   * The real raid's state, for the plate: its name and rung, HP, the line that replaces the title when the week is
   * over, and its own taunts. Nothing floats and nothing flashes; `flinch` is a hit.
   */
  setInfo(o: {
    name: string;
    emoji: string;
    rung: number;
    hp: number;
    maxHp: number;
    banner?: string | null;
    taunts?: readonly string[];
    bar?: boolean;
  }): void {
    const same =
      this.info?.name === o.name &&
      this.info.emoji === o.emoji &&
      this.rung === o.rung &&
      this.hp === o.hp &&
      this.maxHp === o.maxHp &&
      this.banner === (o.banner ?? null) &&
      this.bar === (o.bar ?? true);
    this.info = { name: o.name, emoji: o.emoji };
    this.rung = o.rung;
    this.hp = o.hp;
    this.maxHp = o.maxHp;
    this.banner = o.banner ?? null;
    this.bar = o.bar ?? true;
    this.taunts = o.taunts ?? null;
    if (!same) this.draw();
  }

  /** Week over, or nobody fighting: no taunts, and a dark veil over the boss. */
  setQuiet(on: boolean): void {
    if (on === this.quiet) return;
    this.quiet = on;
    if (on && !this.veil) {
      this.veil = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 14, 10),
        new THREE.MeshBasicMaterial({ color: "#0b0912", transparent: true, opacity: 0.5, depthWrite: false }),
      );
      this.veil.scale.set(1, 1.15, 0.9);
      this.veil.userData.nopick = true;
      this.veil.castShadow = false;
      this.root.add(this.veil);
    }
    if (this.veil) {
      this.veil.visible = on;
      this.veil.position.y = this.sc.height * 0.5;
    }
  }

  /** A hit that landed: the boss flashes and shakes, and `text` floats off it (`gold` for the viewer's own). */
  flinch(text?: string, gold = false): void {
    if (this.fallen) return;
    this.hitAt = this.now;
    if (text) this.float(text, gold ? "#ffd35c" : "#ff8a7a");
  }

  /** A real hit: the boss flashes white, shakes, and `dmg` floats off it. */
  hit(dmg = 0): void {
    if (this.fallen) return;
    this.hitAt = this.now;
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg);
      this.float(`-${compact(dmg)}`);
      this.draw();
    }
  }

  /** The boss falls: it slumps, shrinks away, and the town's trophy rises where it stood. */
  kill(): void {
    if (this.fallen) return;
    this.hp = 0;
    this.fellAt = this.now || 0.001;
    this.trophy.visible = true;
    this.draw();
  }

  /** The next rung's boss drops onto the dais (a new `bossId` or the same one again). */
  spawn(bossId: string, rung: number, maxHp: number): void {
    this.bossIndex = Math.max(
      0,
      DUNGEON_BOSSES.findIndex((b) => b.id === bossId),
    );
    this.rung = rung;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.fellAt = -10;
    this.arriveAt = this.now;
    this.trophy.visible = false;
    this.body.remove(this.sc.root);
    this.sc = bossSculpt(this.bossId, this.silhouette);
    this.body.add(this.sc.root);
    this.plate.position.y = this.sc.height + 0.55;
    this.body.scale.set(1, 1, 1);
    this.body.rotation.z = 0;
    this.nextAttack = this.now + 3;
    this.draw();
  }

  say(text: string): void {
    this.taunt = { text, at: this.now };
    this.draw();
  }

  /** HP left, 0 to 1. */
  get share(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  private float(text: string, colour = "#ff8a7a"): void {
    const tex = canvasTexture(
      128,
      40,
      (g) => {
        g.fillStyle = "#2b2433";
        g.beginPath();
        g.roundRect(2, 2, 124, 36, 12);
        g.fill();
        g.font = "800 24px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = colour;
        g.fillText(text, 64, 21);
      },
      true,
    );
    const m = new Model();
    const face = m.plane(0.9, 0.28, glow("#fff", tex));
    billboard(m, face);
    m.position.set((Math.random() - 0.5) * 0.9, 1.4, 0.3);
    this.root.add(m);
    this.floats.push({ m, at: this.now });
  }

  private draw(): void {
    const g = (this.plateTex.image as HTMLCanvasElement).getContext("2d")!;
    const W = 320;
    g.clearRect(0, 0, W, 76);
    const fell = this.fallen;
    const talking = !this.quiet && this.now - this.taunt.at < 4.5 && this.taunt.text;
    const who = this.info ?? this.boss;
    g.fillStyle = "rgba(20, 24, 34, 0.94)";
    g.beginPath();
    g.roundRect(0, 0, W, 76, 14);
    g.fill();
    g.font = "800 22px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = fell || this.banner ? GOLD : "#ffd35c";
    g.fillText(
      fell
        ? `🏆 ${who.name} fell!`
        : this.banner
          ? this.banner
          : talking
            ? `“${this.taunt.text}”`
            : `${who.emoji} ${who.name} · Rung ${this.rung}`,
      W / 2,
      22,
      W - 16,
    );
    if (this.bar) {
      g.fillStyle = "#5b1f1a";
      g.fillRect(16, 44, W - 32, 18);
      const share = fell ? 0 : this.share;
      g.fillStyle = hpColour(share);
      g.fillRect(16, 44, Math.max(0, (W - 32) * share), 18);
      g.font = "700 15px system-ui, sans-serif";
      g.fillStyle = "#ffffff";
      g.fillText(fell ? "0 HP" : `${compact(this.hp)} / ${compact(this.maxHp)}`, W / 2, 54);
    }
    this.plateTex.needsUpdate = true;
  }

  private flash(on: boolean): void {
    flash(this.sc.root, on);
  }

  private update(t: number): void {
    if (!this.root.parent) return;
    this.now = t;
    const hurt = t - this.hitAt < BossActor.HURT && !this.fallen;
    this.flash(hurt && Math.floor(t / 0.07) % 2 === 0);
    const bob = this.fallen ? 0 : Math.sin(t * 2.4) * 0.03;
    let y = 0.1 + bob;
    const arrive = Math.min(1, Math.max(0, (t - this.arriveAt) / BossActor.ARRIVE));
    y += (1 - arrive) ** 2 * 3;
    let fall = 0;
    this.body.scale.set(1, 1, 1);
    if (this.fallen) {
      const u = (t - this.fellAt) / BossActor.FALL;
      fall = Math.min(1, u * 1.6);
      if (u > 1) this.body.scale.setScalar(Math.max(0.001, 1 - (u - 1) * 2));
      y = 0.02;
      this.trophy.position.set(1.15, 0.04 + Math.min(1, u * 3) * 0.35, 0.3);
      this.trophy.rotation.y = t * 1.2;
    }
    if (!this.fallen && t >= this.nextAttack && arrive >= 1) {
      this.attackAt = t;
      this.nextAttack = t + 6 + Math.random() * 4;
    }
    const attack = t - this.attackAt < 1.6 ? (t - this.attackAt) / 1.6 : -1;
    const landing = arrive < 1 ? 0 : 1;
    this.sc.update({
      t,
      hurt: hurt ? 1 - (t - this.hitAt) / BossActor.HURT : 0,
      attack: attack * landing,
      fall,
    });
    this.body.rotation.z = 0;
    const shake = hurt ? 0.04 : 0;
    this.body.position.set((Math.random() - 0.5) * shake * 2, y, (Math.random() - 0.5) * shake * 2);
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      const k = (t - f.at) / 1.8;
      if (k >= 1) {
        this.root.remove(f.m);
        this.floats.splice(i, 1);
        continue;
      }
      f.m.position.y = 1.4 + k * 1.1;
      f.m.scale.setScalar(k > 0.7 ? Math.max(0.01, 1 - (k - 0.7) / 0.3) : 1);
    }
    if (t >= this.nextTaunt && !this.fallen && !this.quiet) {
      const taunts = this.taunts?.length ? this.taunts : this.boss.taunts;
      this.say(taunts[Math.floor(Math.random() * taunts.length)]!);
      this.nextTaunt = t + 25;
    }
    if (this.taunt.text && t - this.taunt.at > 4.5) {
      this.taunt.text = "";
      this.draw();
    }
  }
}

function bossTrophy(): Model {
  const m = new Model();
  m.add(buildTrophy());
  return m;
}

// MARK: Minions

/** The robot minion: a voxel bot with a blinking antenna and a blaster arm that comes up as it fires. */
function minion(): Model {
  const m = new Model();
  const bot = buildMinion();
  m.add(bot.root);
  bot.root.position.y = 0.05;
  m.cyl(0.3, 0.02, "#15121b", [0, 0, 0], 0.3, 14).castShadow = false;
  tick(m, (t) => bot.update(t));
  return m;
}

// MARK: Room props

const STEP = (n: number) => `${n}`;
void STEP;

function dais(): Model {
  const m = new Model();
  m.box([5, 0.12, 3], STONE.daisDark, [0, 0, 0], 0.02);
  m.box([4.7, 0.16, 2.7], STONE.dais, [0, 0.12, 0], 0.03);
  m.box([4.7, 0.025, 0.06], STONE.daisLight, [0, 0.275, 1.32], 0);
  // Runes on the front edge.
  const runes: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const mat = glow(STONE.rune);
    runes.push(mat);
    m.box([0.22, 0.04, 0.02], mat, [-1.9 + i * 0.76, 0.18, 1.36], 0);
  }
  for (const sx of [-1, 1]) {
    m.box([0.16, 0.36, 0.16], STONE.daisLight, [sx * 2.2, 0.28, 1.2], 0.02);
    m.ball(0.07, glow(STONE.rune), [sx * 2.2, 0.7, 1.2]);
  }
  const base = new THREE.Color(STONE.rune);
  const dim = base.clone().multiplyScalar(0.45);
  tick(m, (t) =>
    runes.forEach((r, i) => {
      r.color.copy(dim).lerp(base, 0.5 + 0.5 * Math.sin(t * 2 + i * 0.9));
    }),
  );
  light(m, [0, 1.6, 0.4], STONE.rune, 5, 7);
  return m;
}

function torch(): Model {
  const m = new Model();
  // Bracket on the wall (the wall is behind, at z = 0).
  m.box([0.2, 0.34, 0.04], C.metal, [0, 1.05, 0.02], 0.01);
  m.cyl(0.03, 0.4, C.woodDark, [0, 1.1, 0.12], 0.03, 8).rotation.x = -0.25;
  m.cyl(0.05, 0.12, C.metal, [0, 1.5, 0.19], 0.09, 10);
  const outer = glow("#e9733d");
  const inner = glow("#ffd35c");
  const flame = m.ball(0.1, outer, [0, 1.7, 0.19], [1, 1.5, 1], 8);
  const core = m.ball(0.055, inner, [0, 1.66, 0.2], [1, 1.5, 1], 8);
  const tip = m.cyl(0.05, 0.14, outer, [0, 1.72, 0.19], 0.005, 8);
  const l = new THREE.PointLight("#ff9a4a", 7, 6.5, 1.5);
  l.position.set(0, 1.75, 0.5);
  l.userData.night = 7;
  m.add(l);
  tick(m, (t) => {
    const f = 0.85 + 0.15 * Math.sin(t * 17.3) * Math.sin(t * 6.1) + 0.05 * Math.sin(t * 41);
    l.intensity = 7 * f;
    flame.scale.set(1, 1.3 + 0.35 * f, 1);
    core.scale.set(1, 1.3 + 0.3 * f, 1);
    tip.scale.set(1, 0.7 + 0.8 * f, 1);
    tip.rotation.z = Math.sin(t * 9) * 0.25;
  });
  return m;
}

function warDesk(open: boolean): Model {
  const m = new Model();
  m.box([0.96, 0.08, 0.7], C.metalLight, [0, 0.62, 0], 0.02);
  m.box([0.96, 0.04, 0.7], C.metal, [0, 0.58, 0], 0.01);
  for (const sx of [-1, 1]) m.box([0.07, 0.58, 0.55], "#3b4252", [sx * 0.42, 0, 0], 0.02);
  m.box([0.8, 0.28, 0.03], "#3b4252", [0, 0.28, -0.3], 0.01);
  // The laptop: shut until a raider sits down.
  m.box([0.42, 0.02, 0.3], C.stoneDark, [0, 0.7, 0.08], 0.01);
  if (open) {
    const lid = m.part([0, 0.72, -0.07]);
    lid.rotation.x = -0.35;
    lid.box([0.42, 0.3, 0.02], "#2b2433", [0, 0, 0], 0.01);
    lid.plane(0.37, 0.25, glow("#fff", codeScreen(41, "#161b2b")), [0, 0.16, 0.011]);
    light(m, [0, 1.0, 0.5], "#8fe3ff", 1.5, 2.2);
  } else m.box([0.42, 0.025, 0.3], "#3b4252", [0, 0.72, 0.08], 0.01);
  return m;
}

function raiderSeat(): Model {
  const m = new Model();
  const seat = "#3b4252";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = m.box([0.035, 0.03, 0.2], "#2b2433", [Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.1]);
    leg.rotation.y = a;
  }
  m.cyl(0.025, 0.25, C.metalLight, [0, 0.03, 0], 0.025, 8);
  m.box([0.4, 0.07, 0.38], seat, [0, 0.28, 0], 0.03);
  // Backrest behind the sitter, who faces the boss (-z).
  m.box([0.38, 0.4, 0.07], seat, [0, 0.36, 0.17], 0.035);
  m.box([0.34, 0.04, 0.02], STONE.rune, [0, 0.66, 0.2], 0);
  return m;
}

/** Stone arch over steps going down, violet at the bottom: the dungeon's gate. */
function gate(boarded: boolean): Model {
  const m = new Model();
  const R = 0.82;
  const cy = 1.15;
  for (const sx of [-1, 1]) m.box([0.26, cy, 0.5], C.stoneDark, [sx * (R + 0.02), 0, 0], 0.03);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    const b = m.box(
      [0.26, 0.3, 0.5],
      i % 2 ? C.stone : C.stoneDark,
      [Math.cos(a) * (R + 0.02), cy + Math.sin(a) * R - 0.12, 0],
      0.03,
    );
    b.rotation.z = a - Math.PI / 2 + Math.PI;
    b.rotation.z = a + Math.PI / 2;
  }
  m.box([0.3, 0.26, 0.54], "#1c1924", [0, cy + R + 0.02, 0], 0.03);
  m.ball(0.08, glow(STONE.rune), [0, cy + R + 0.14, 0.28], [1, 1, 0.6]);
  // The way down.
  m.box([R * 2, cy, 0.3], "#1c1924", [0, 0, -0.1], 0);
  const hole = m.cyl(R - 0.02, 0.3, "#1c1924", [0, cy, -0.1], R - 0.02, 20);
  hole.rotation.x = Math.PI / 2;
  hole.position.z = -0.1;
  const glowMat = glow("#6a3fc4");
  m.box([R * 2 - 0.3, 0.05, 0.2], glowMat, [0, 0.02, 0.0], 0);
  for (let i = 0; i < 5; i++) {
    const shade = tint(C.stone, -0.15 - i * 0.14);
    m.box([R * 2 - 0.3 - i * 0.06, 0.05, 0.14], shade, [0, 0.0 + 0.0, 0.34 - i * 0.14], 0);
  }
  const base = new THREE.Color("#6a3fc4");
  tick(m, (t) => glowMat.color.copy(base).multiplyScalar(0.65 + 0.35 * Math.sin(t * 2)));
  light(m, [0, 0.4, 0.5], "#8d5bff", boarded ? 1.5 : 4, 4.5);
  if (boarded) {
    const wood = "#a8743e";
    for (const [y, z] of [
      [0.25, 0.3],
      [0.6, 0.32],
      [0.95, 0.3],
      [1.3, 0.28],
    ] as const) {
      const p = m.box([R * 2 + 0.3, 0.17, 0.05], wood, [0, y, z], 0.01);
      p.rotation.z = (y > 0.5 ? 1 : -1) * 0.06;
    }
    const tape = canvasTexture(32, 4, (g) => {
      for (let x = 0; x < 32; x += 8) {
        g.fillStyle = "#f5d14a";
        g.fillRect(x, 0, 4, 4);
        g.fillStyle = "#2b2433";
        g.fillRect(x + 4, 0, 4, 4);
      }
    });
    tape.wrapS = THREE.RepeatWrapping;
    tape.repeat.set(4, 1);
    const t = m.plane(R * 2 + 0.6, 0.14, painted(tape), [0, 0.8, 0.36]);
    t.rotation.z = -0.28;
    // Danger sign.
    const sign = canvasTexture(
      64,
      40,
      (g) => {
        g.fillStyle = "#f5d14a";
        g.fillRect(0, 0, 64, 40);
        g.fillStyle = "#2b2433";
        g.fillRect(0, 0, 64, 3);
        g.fillRect(0, 37, 64, 3);
        g.font = "800 14px system-ui, sans-serif";
        g.textAlign = "center";
        g.fillText("DANGER", 32, 17);
        g.font = "700 10px system-ui, sans-serif";
        g.fillText("OPENS MON 08:00", 32, 31, 58);
      },
      true,
    );
    m.box([0.04, 0.5, 0.04], C.woodDark, [1.15, 0, 0.45], 0);
    m.plane(0.7, 0.44, glow("#fff", sign), [1.15, 0.78, 0.48]);
  }
  return m;
}

function frameDoor(slab: string, trim: string): Model {
  const m = new Model();
  for (const sx of [-1, 1]) m.box([0.1, 1.9, 0.18], trim, [sx * 0.46, 0, 0], 0.02);
  m.box([1.02, 0.1, 0.18], trim, [0, 1.9, 0], 0.02);
  m.box([0.82, 1.9, 0.08], slab, [0, 0, -0.02], 0.02);
  m.box([0.82, 0.04, 0.1], tint(slab, -0.2), [0, 0.9, -0.02], 0);
  for (const [y, h] of [
    [0.12, 0.7],
    [1.0, 0.72],
  ] as const)
    m.box([0.6, h, 0.02], tint(slab, 0.1), [0, y, 0.03], 0.01);
  m.ball(0.045, GOLD, [0.3, 0.95, 0.07], [1, 1, 0.8]);
  return m;
}

function officeDoor(): Model {
  const m = frameDoor("#4f8fe0", C.woodDark);
  const glassPane = m.box([0.4, 0.4, 0.015], glow("#8fe3ff"), [0, 1.15, 0.045], 0);
  void glassPane;
  const tex = canvasTexture(
    64,
    20,
    (g) => {
      g.fillStyle = "#c9971f";
      g.fillRect(0, 0, 64, 20);
      g.fillStyle = "#2b2433";
      g.font = "800 12px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("OFFICE", 32, 11);
    },
    true,
  );
  m.plane(0.36, 0.11, glow("#fff", tex), [0, 0.82, 0.045]);
  return m;
}

function plainDoor(): Model {
  const m = frameDoor(C.wood, C.woodDark);
  m.box([0.9, 0.025, 0.4], "#6b4a34", [0, 0, 0.3], 0);
  return m;
}

/** The dungeon's own way out: stone stairs up into the light (the shared `buildStairs`, on the floor tile before the wall). */
function dungeonExit(): Model {
  const m = new Model();
  const stairs = buildStairs({
    dir: "up",
    wall: STONE.wallTop,
    wood: STONE.wallTop,
    tread: tint(C.stone, 0.4),
    plate: "OUT",
  });
  stairs.position.z = 0.5;
  m.add(stairs);
  return m;
}

/** The wall terminal, a green CRT whose right-hand screen is the raid boss's HP. `set(share)` moves it. */
export interface Terminal extends Model {
  set: (share: number | null) => void;
}
function terminal(): Terminal {
  const m = new Model() as Terminal;
  const W = 64;
  const H = 40;
  let share: number | null = 0.62;
  const tex = canvasTexture(W, H, () => {});
  const paint = (t: number) => {
    const g = (tex.image as HTMLCanvasElement).getContext("2d")!;
    g.fillStyle = "#0e1f17";
    g.fillRect(0, 0, W, H);
    g.font = "bold 7px monospace";
    g.fillStyle = "#3ddc84";
    g.fillText("BOSS HP", 4, 9);
    g.fillStyle = "#12301f";
    g.fillRect(4, 14, W - 8, 12);
    if (share !== null) {
      g.fillStyle = share > 0.5 ? "#3ddc84" : share > 0.2 ? "#f5d14a" : "#e8584f";
      g.fillRect(4, 14, Math.max(1, Math.round((W - 8) * share)), 12);
      g.fillStyle = "#e4f5fd";
      g.fillText(`${Math.round(share * 100)}%`, 4, 35);
    } else {
      g.fillStyle = "#2f7a4f";
      g.fillRect(4 + (Math.floor(t * 2) % (W - 8)), 19, 2, 2);
    }
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
    tex.needsUpdate = true;
  };
  paint(0);
  m.set = (s) => {
    share = s;
    paint(0);
  };
  m.box([0.78, 0.6, 0.3], C.metal, [0, 0.95, 0.15], 0.03);
  m.box([0.78, 0.04, 0.3], C.metalLight, [0, 1.514, 0.15], 0.01);
  m.box([0.34, 0.22, 0.2], C.metal, [0, 0.75, 0.1], 0.02);
  m.box([0.64, 0.46, 0.04], "#0e1f17", [0, 1.02, 0.31], 0.01);
  m.plane(0.6, 0.375, glow("#fff", tex), [0, 1.22, 0.335]);
  m.box([0.05, 0.05, 0.02], glow("#3ddc84"), [0.3, 0.98, 0.33], 0);
  tick(m, (t) => {
    if (share === null) paint(t);
  });
  return m;
}

/** A plaque on the wall for a boss that fell this week. */
function plaque(bossIndex = 0): Model {
  const b = DUNGEON_BOSSES[bossIndex]!;
  const m = new Model();
  m.box([0.86, 0.5, 0.05], C.woodDark, [0, 1.3, 0.025], 0.02);
  const tex = canvasTexture(
    96,
    52,
    (g) => {
      g.fillStyle = GOLD;
      g.fillRect(0, 0, 96, 52);
      g.fillStyle = GOLD_DARK;
      g.fillRect(0, 0, 96, 2);
      g.fillRect(0, 50, 96, 2);
      g.fillStyle = "#2b2433";
      g.font = "26px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(b.emoji, 48, 18);
      g.font = "800 10px system-ui, sans-serif";
      g.fillText(`Rung ${bossIndex + 1}`, 48, 42);
    },
    true,
  );
  m.plane(0.76, 0.41, glow("#fff", tex), [0, 1.55, 0.055]);
  return m;
}

/** The Golden Hourglass: gold frame, sand that never runs out, on a dark plinth. */
function hourglass(): Model {
  const m = new Model();
  m.box([0.5, 0.2, 0.34], "#3a3546", [0, 0, 0], 0.03);
  m.box([0.5, 0.025, 0.34], "#5a5468", [0, 0.2, 0], 0.01);
  m.box([0.46, 0.07, 0.3], GOLD, [0, 0.22, 0], 0.02);
  m.box([0.46, 0.07, 0.3], GOLD, [0, 0.98, 0], 0.02);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.cyl(0.018, 0.7, GOLD_DARK, [sx * 0.2, 0.28, sz * 0.12], 0.018, 8);
  const sand = "#f2c46b";
  m.cyl(0.18, 0.34, glass("#e9f6fb", 0.5), [0, 0.29, 0], 0.025, 16);
  m.cyl(0.025, 0.34, glass("#e9f6fb", 0.5), [0, 0.63, 0], 0.18, 16);
  m.cyl(0.15, 0.1, sand, [0, 0.3, 0], 0.08, 14);
  m.cyl(0.03, 0.14, sand, [0, 0.4, 0], 0.02, 6);
  m.cyl(0.1, 0.1, sand, [0, 0.82, 0], 0.15, 14);
  sparkle(m, [0, 0.7, 0], GOLD_LIGHT, 4, 0.4);
  return m;
}

/** The Golden Rebase: a gold cup on a plinth, with one clean line of commits across it. */
function rebase(): Model {
  const m = new Model();
  m.box([0.5, 0.2, 0.34], "#3a3546", [0, 0, 0], 0.03);
  m.box([0.5, 0.025, 0.34], "#5a5468", [0, 0.2, 0], 0.01);
  m.cyl(0.05, 0.22, GOLD_DARK, [0, 0.22, 0], 0.05, 10);
  m.cyl(0.13, 0.05, GOLD_DARK, [0, 0.42, 0], 0.13, 14);
  m.cyl(0.1, 0.38, GOLD, [0, 0.46, 0], 0.22, 18);
  m.cyl(0.095, 0.02, GOLD_LIGHT, [0, 0.83, 0], 0.215, 18);
  for (const sx of [-1, 1]) {
    m.ball(0.075, GOLD_DARK, [sx * 0.3, 0.72, 0], [0.5, 1, 1], 10);
    m.box([0.1, 0.04, 0.04], GOLD_DARK, [sx * 0.24, 0.72, 0], 0);
  }
  // One straight history: four commits on a line.
  m.box([0.34, 0.025, 0.02], "#2b2433", [0, 0.66, 0.2], 0);
  for (const x of [-0.14, -0.05, 0.05, 0.14]) m.box([0.03, 0.09, 0.03], "#2b2433", [x, 0.625, 0.2], 0);
  m.ball(0.03, glow("#5aa8ff"), [-0.14, 0.67, 0.21]);
  m.ball(0.03, glow("#5aa8ff"), [0.14, 0.67, 0.21]);
  sparkle(m, [0, 0.7, 0], GOLD_LIGHT, 4, 0.4);
  return m;
}

// MARK: Loot

type Rarity = keyof typeof RARITY_INFO;

/** A pedestal in the rarity's colour, with a beam of light; epics and legendaries twinkle. */
function pedestal(rarity: Rarity): { m: Model; top: number } {
  const colour = RARITY_INFO[rarity].color;
  const m = new Model();
  m.cyl(0.36, 0.14, "#3a3546", [0, 0, 0], 0.4, 20);
  m.cyl(0.3, 0.06, "#5a5468", [0, 0.14, 0], 0.3, 20);
  const ring = glow(colour);
  m.cyl(0.33, 0.02, ring, [0, 0.2, 0], 0.33, 24);
  const beam = new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 1.0, 18, 1, true), beam);
  cone.position.y = 0.2 + 0.5;
  m.add(cone);
  const odds = { common: 0, rare: 0, epic: 3, legendary: 6 }[rarity];
  if (odds) sparkle(m, [0, 0.8, 0], rarity === "legendary" ? GOLD : colour, odds, 0.4);
  const base = new THREE.Color(colour);
  tick(m, (t) => {
    ring.color.copy(base).multiplyScalar(0.7 + 0.3 * Math.sin(t * 2.5));
    beam.opacity = 0.12 + 0.06 * Math.sin(t * 2.5);
  });
  return { m, top: 0.2 };
}

/** The `nth` loot item of its slot, from the table's order. */
const lootItems = (() => {
  const seen: Record<string, number> = {};
  return LOOT_TABLE.filter((l) => l.slot !== "furniture").map((l) => {
    const nth = (seen[l.slot] ?? -1) + 1;
    seen[l.slot] = nth;
    return { ...l, nth };
  });
})();

function outfitDummy(nth: number): Model {
  const o = LOOT_OUTFITS[nth]!;
  const m = new Model();
  m.cyl(0.04, 0.9, "#6b4a34", [0, 0, 0], 0.04, 8);
  m.box([0.1, 0.04, 0.1], "#6b4a34", [0, 0, 0], 0.01);
  m.box([0.5, 0.52, 0.26], o.colors[0], [0, 0.45, 0], 0.05);
  m.box([0.5, 0.06, 0.27], o.colors[1], [0, 0.45, 0], 0.02);
  for (const sx of [-1, 1]) m.box([0.12, 0.42, 0.14], o.colors[1], [sx * 0.31, 0.5, 0], 0.04);
  m.box([0.4, 0.2, 0.22], o.pants, [0, 0.3, 0], 0.03);
  m.ball(0.15, "#e9d8c4", [0, 1.12, 0]);
  const px = 0.03;
  const front = voxels(o.over.down, o.pal, px, { depth: 0.04 });
  front.model.position.set(0, 0.97 - front.h, 0.14);
  m.add(front.model);
  const back = voxels(o.over.up, o.pal, px, { depth: 0.04 });
  back.model.position.set(0, 0.97 - back.h, -0.14);
  back.model.rotation.y = Math.PI;
  m.add(back.model);
  m.position.y = 0;
  return m;
}

/** The piece itself (no pedestal), standing at the origin, and the height it floats at. */
function lootBody(l: (typeof lootItems)[number], top = 0.2): { item: Model; y0: number } {
  const item = new Model();
  if (l.slot === "hat") {
    const a = LOOT_HATS[l.nth]!;
    item.add(voxels(a.rows.down, a.pal, 0.045, { depth: 0.3 }).model);
    item.position.y = top + 0.45;
  } else if (l.slot === "glasses") {
    const a = LOOT_GLASSES[l.nth]!;
    item.add(voxels(a.rows.down, a.pal, 0.05, { depth: 0.1 }).model);
    item.position.y = top + 0.5;
  } else if (l.slot === "outfit") {
    item.add(outfitDummy(l.nth));
    item.scale.setScalar(0.8);
    item.position.y = top + 0.05;
  } else {
    // The 3D pet of that species (sand golem, goldfish, forked cat, ghost), as it would walk the town.
    const pet = petFrom2D(7 + l.nth);
    pet.root.scale.setScalar(1.05);
    pet.root.rotation.y = -Math.PI / 4;
    tick(item, (t) => pet.update(t));
    item.add(pet.root);
    item.position.y = top + 0.15;
  }
  return { item, y0: item.position.y };
}

function lootItem(l: (typeof lootItems)[number]): Model {
  const m = new Model();
  const { m: ped, top } = pedestal(l.rarity);
  m.add(ped);
  const { item, y0 } = lootBody(l, top);
  m.add(item);
  tick(m, (t) => {
    item.position.y = y0 + Math.sin(t * 2 + l.nth) * 0.04;
  });
  return m;
}

/** A raid drop by its shop id (`hat.28`, `furn.Y`), as a model that stands at the origin; null for an id the raid doesn't drop. */
export function lootModel(id: string): Model | null {
  if (id === "furn.Y") return hourglass();
  if (id === "furn.V") return rebase();
  const l = lootItems.find((q) => q.id === id);
  if (!l) return null;
  const m = new Model();
  m.add(lootBody(l).item);
  return m;
}

// MARK: Editions

/** The print number shown on edition `i`: a stable "#n of supply". */
export const editionNumber = (index: number, supply: number): number => ((index * 5 + 3) % supply) + 1;

function editionItem(e: (typeof EDITION_LIST)[number]): Model {
  const m = new Model();
  const colour = RARITY_INFO[e.rarity].color;
  m.box([0.95, 0.14, 0.62], "#3b2a22", [0, 0, 0], 0.03);
  m.box([0.95, 0.025, 0.62], colour, [0, 0.14, 0], 0.01);
  const art = (e.slot === "hat" ? EDITION_HATS : EDITION_GLASSES)[e.id];
  const item = new Model();
  if (art) {
    const v = voxels(art.down, art.pal, 0.048, { depth: e.slot === "hat" ? 0.3 : 0.12 });
    item.add(v.model);
    item.position.y = 0.3;
    m.add(item);
    m.add(
      (() => {
        const dome = new Model();
        dome.box([0.84, 0.74, 0.5], glass("#cfe9ff", 0.08), [0, 0.14, 0], 0.03);
        return dome;
      })(),
    );
  }
  const n = editionNumber(e.index, e.supply);
  const tag = canvasTexture(
    96,
    32,
    (g) => {
      g.fillStyle = "#fbf7ef";
      g.fillRect(0, 0, 96, 32);
      g.fillStyle = colour;
      g.fillRect(0, 0, 96, 4);
      g.fillStyle = "#2b2433";
      g.font = "800 15px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(`#${n} of ${e.supply}`, 48, 19);
    },
    true,
  );
  const card = m.plane(0.6, 0.2, glow("#fff", tag), [0, 0.2, 0.34]);
  card.rotation.x = -0.5;
  const y0 = 0.3;
  tick(m, (t) => {
    item.position.y = y0 + Math.sin(t * 1.8 + e.index) * 0.025;
  });
  if (e.rarity === "legendary") sparkle(m, [0, 0.6, 0], GOLD, 3, 0.4);
  return m;
}

// MARK: Trophies

const PLINTH_KEYS = "kK";

/** One trophy: its 7x8 pixel art extruded, on a small base. An unearned one is a ghost of the same shape. */
export function trophy(id: string, earned = true, px = 0.1, solidGhost = false): Model {
  const art = TROPHY_ART[id];
  const m = new Model();
  if (!art) return m;
  const v = voxels(art.rows, art.pal, px, {
    depth: (ch) => (PLINTH_KEYS.includes(ch) ? 0.36 : 0.2),
    ghost: !earned,
    solidGhost,
    glows: id === "leet" || id === "zeros" ? "ga" : id === "3am" ? "w" : id === "newyear" ? "w" : "",
  });
  v.model.position.y = 0.03;
  m.add(v.model);
  m.box([TROPHY_SIZE * px + 0.12, 0.03, 0.44], earned ? "#6b4a34" : "#4a3c38", [0, 0, 0], 0.01);
  if (earned && (id === "billion" || id === "jackpot")) sparkle(m, [0, v.h * 0.6, 0], GOLD_LIGHT, 3, 0.3);
  return m;
}
const TROPHY_SIZE = 7;

/** The shelf: four tiles wide, six glass-fronted shelves of seven (`SHELF_SLOTS`). */
export function trophyShelf(earned: ReadonlySet<string>, solidGhost = false): Model {
  const m = new Model();
  const W = 3.9;
  const rowH = 0.4;
  const rows = SHELF_SLOTS / 7;
  const H = rows * rowH + 0.18;
  const D = 0.46;
  const wood = C.woodDark;
  m.box([W - 0.008, H - 0.008, 0.04], "#5e3d28", [0, 0, -D / 2 + 0.014], 0.01);
  for (const sx of [-1, 1]) m.box([0.07, H - 0.008, D - 0.008], wood, [sx * (W / 2 - 0.039), 0.004, 0], 0.02);
  m.box([W, 0.09, D], C.wood, [0, 0, 0], 0.02);
  m.box([W, 0.09, D + 0.02], C.woodLight, [0, H - 0.09, 0], 0.02);
  for (let s = 1; s < rows; s++)
    m.box([W - 0.1, 0.035, D - 0.04], C.woodLight, [0, 0.09 + s * rowH - 0.035, 0], 0.01);
  TROPHY_DEFS.forEach((t, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const tr = trophy(t.id, earned.has(t.id), 0.045, solidGhost);
    tr.position.set((col - 3) * 0.5, 0.09 + (rows - 1 - row) * rowH, 0.02);
    m.add(tr);
  });
  const pane = m.plane(W - 0.14, H - 0.2, glass("#dff3ff", 0.1), [0, H / 2, D / 2 - 0.01]);
  pane.castShadow = false;
  for (const gx of [-1.1, 1.0]) {
    const glint = m.plane(0.1, H - 0.4, glow("#ffffff"), [gx, H / 2, D / 2 - 0.005]);
    glint.rotation.z = 0.35;
    (glint.material as THREE.MeshBasicMaterial).transparent = true;
    (glint.material as THREE.MeshBasicMaterial).opacity = 0.14;
  }
  return m;
}

// MARK: Badges

const FRAME_ROWS = [
  "..oooooooo..",
  ".oaaaaaaaao.",
  "oaawwaaaaaao",
  "oawbbbbbbaao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oaabbbbbbaao",
  "oaaaaaaaaaao",
  ".oaaaaaaaao.",
  "..oooooooo..",
];
type Frame = keyof typeof TIER_COLORS;
const FRAMES = BADGE_FRAMES as readonly Frame[];

/** The frame of tier `tier` (1-based) of `count` tiers: a lone one is gold, four end in diamond, six in cosmic. */
const frameOf = (tier: number, count: number): Frame =>
  count === 1 ? "gold" : FRAMES[Math.min(Math.max(tier, 1), count) - 1]!;

const emojiTex = new Map<string, THREE.CanvasTexture>();
function emojiTexture(emoji: string): THREE.CanvasTexture {
  let t = emojiTex.get(emoji);
  if (!t) {
    t = canvasTexture(
      48,
      48,
      (g) => {
        g.fillStyle = "#1b1f2b";
        g.fillRect(0, 0, 48, 48);
        g.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(emoji, 24, 26);
      },
      true,
    );
    emojiTex.set(emoji, t);
  }
  return t;
}

/** A small medal in a tier's colour: the badge frame extruded, the emoji set in it, on a ribbon. */
export function medal(emoji: string, frame: Frame): Model {
  const px = 0.04;
  const m = new Model();
  const colour = TIER_COLORS[frame];
  const v = voxels(FRAME_ROWS, { o: C.ink, a: colour, w: C.white, b: "#1b1f2b" }, px, {
    depth: (ch) => (ch === "b" ? 0.04 : 0.09),
    glows: frame === "diamond" || frame === "mythic" || frame === "cosmic" ? "a" : "",
  });
  v.model.position.set(0, 0.28, 0);
  m.add(v.model);
  m.plane(6 * px, 6 * px, glow("#fff", emojiTexture(emoji)), [0, 0.28 + 6 * px, 0.025]);
  // Ribbon: two short tails above, crossing.
  for (const s of [-1, 1]) {
    const r = m.box([0.06, 0.17, 0.02], s < 0 ? "#e0584f" : "#4f8fe0", [s * 0.05, 0.7, -0.03], 0);
    r.rotation.z = s * 0.35;
  }
  // A stand behind.
  m.box([0.12, 0.26, 0.04], C.woodDark, [0, 0.02, -0.07], 0.01).rotation.x = -0.25;
  m.box([0.32, 0.04, 0.2], C.woodDark, [0, 0, 0.0], 0.01);
  if (frame === "gold" || frame === "diamond")
    sparkle(m, [0, 0.5, 0.1], frame === "gold" ? GOLD_LIGHT : "#bff6ff", 2, 0.3);
  return m;
}

const badgePitch = 0.55;
function badgeRow(b: (typeof BADGE_DEFS)[number]): Model {
  const m = new Model();
  const n = b.tiers.length;
  for (let i = 0; i < n; i++) {
    const md = medal(b.emoji, frameOf(i + 1, n));
    md.position.x = (i - (n - 1) / 2) * badgePitch;
    m.add(md);
  }
  return m;
}

function tierSet(): Model {
  const m = new Model();
  FRAMES.forEach((f, i) => {
    const md = medal("🏅", f);
    md.position.x = (i - 1.5) * badgePitch;
    m.add(md);
  });
  return m;
}

// MARK: Catalogue

const bossAssets: Asset[] = DUNGEON_BOSSES.map((b) => ({
  id: `boss:${b.id}`,
  name: `${b.name} (boss)`,
  price: 0,
  w: 3,
  d: 3,
  build: () => new BossActor(b.id).root,
}));

const lootAssets: Asset[] = lootItems.map((l) => ({
  id: l.id,
  name: `${l.name} (${RARITY_INFO[l.rarity].label}, drops from ${DUNGEON_BOSSES.find((b) => b.id === l.boss)!.name})`,
  price: 0,
  w: 1,
  d: 1,
  build: () => lootItem(l),
}));

const editionAssets: Asset[] = EDITION_LIST.map((e) => ({
  id: e.id,
  name: `${e.name} (#${editionNumber(e.index, e.supply)} of ${e.supply})`,
  price: e.price,
  w: 1,
  d: 1,
  build: () => editionItem(e),
}));

const trophyAssets: Asset[] = TROPHY_DEFS.map((t) => ({
  id: `trophy:${t.id}`,
  name: `${t.name}: ${t.how}`,
  price: 0,
  w: 1,
  d: 1,
  build: () => trophy(t.id),
}));

const badgeAssets: Asset[] = BADGE_DEFS.map((b) => ({
  id: `badge:${b.id}`,
  name: `${b.emoji} ${b.name} (${b.tiers.map((t) => t.label).join(" / ")})`,
  price: 0,
  w: Math.max(1, Math.ceil(b.tiers.length * badgePitch)),
  d: 1,
  build: () => badgeRow(b),
}));

export const DUNGEON_ASSETS: readonly Asset[] = [
  { id: "tile:Z", name: "Boss dais", price: 0, w: 5, d: 3, build: dais },
  { id: "tile:j", name: "Torch", price: 0, w: 1, d: 1, build: torch },
  { id: "tile:l", name: "War desk", price: 0, w: 1, d: 1, build: () => warDesk(false) },
  { id: "tile:l.open", name: "War desk (raider at work)", price: 0, w: 1, d: 1, build: () => warDesk(true) },
  {
    id: "tile:r",
    name: "Raider's seat",
    price: 0,
    w: 1,
    d: 1,
    build: raiderSeat,
    seat: { at: [0, 0.35, 0.0], turn: Math.PI },
  },
  { id: "tile:G", name: "Dungeon gate", price: 0, w: 2, d: 1, build: () => gate(false) },
  { id: "tile:G.boarded", name: "Dungeon gate (boarded up)", price: 0, w: 2, d: 1, build: () => gate(true) },
  { id: "tile:R", name: "Office door", price: 0, w: 1, d: 1, build: officeDoor },
  { id: "tile:D", name: "Door", price: 0, w: 1, d: 1, build: plainDoor },
  { id: "dungeon:exit", name: "Dungeon exit", price: 0, w: 1, d: 1, build: dungeonExit },
  { id: "tile:M", name: "Wall terminal (boss HP)", price: 0, w: 1, d: 1, build: terminal },
  { id: "dungeon:plaque", name: "Kill plaque", price: 0, w: 1, d: 1, build: () => plaque(0) },
  { id: "dungeon:trophy", name: "Boss trophy", price: 0, w: 1, d: 1, build: bossTrophy },
  { id: "tile:Y", name: "Golden Hourglass", price: 0, w: 1, d: 1, build: hourglass },
  { id: "tile:V", name: "Golden Rebase", price: 0, w: 1, d: 1, build: rebase },
  {
    id: "tile:U",
    name: "Trophy shelf",
    price: 0,
    w: 4,
    d: 1,
    build: () => trophyShelf(new Set(TROPHY_DEFS.filter((_, i) => i % 4 !== 3).map((t) => t.id))),
  },
  ...bossAssets,
  { id: "minion", name: "Robot minion", price: 0, w: 1, d: 1, build: minion },
  ...lootAssets,
  ...editionAssets,
  ...trophyAssets,
  ...badgeAssets,
  {
    id: "badge:tiers",
    name: "Badge tiers: bronze, silver, gold, diamond, mythic, cosmic",
    price: 0,
    w: 3,
    d: 1,
    build: tierSet,
  },
];

export {
  badgeRow,
  dais,
  editionItem,
  gate,
  lootItem,
  lootItems,
  minion,
  plaque,
  raiderSeat,
  terminal,
  tierSet,
  torch,
  warDesk,
};
