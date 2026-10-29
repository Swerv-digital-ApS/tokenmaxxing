import { compact, countdown } from "@tokenmaxxing/core/format.ts";
import type { LootNews } from "@tokenmaxxing/core/loot.ts";
import { lootById, RARITIES, type Rarity } from "@tokenmaxxing/core/loot.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { canSit } from "@tokenmaxxing/core/raidseat.ts";
import type { Raiders } from "@tokenmaxxing/core/world.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import * as THREE from "three";
import { onLoot } from "../../game/loot.ts";
import { raidersNow, seatTile } from "../../game/raid.ts";
import { mySeat, raidPet, seated, sit, standUp } from "../../game/raidseat.ts";
import { world } from "../../game/world.ts";
import { hud } from "../../store.ts";
import { DUNGEON_BOSSES } from "../data/dungeon.ts";
import { DESKS } from "../data/town.ts";
import { disposeObject } from "../engine/dispose.ts";
import { Figures, Swarm } from "../engine/swarm.ts";
import type { Model } from "../kit/kit.ts";
import { Avatar } from "../people/avatar.ts";
import { lookFrom2D } from "../people/gear3d.ts";
import { fleetDesk } from "../rooms/hq3d.ts";
import type { Sign } from "../rooms/rooms.ts";
import { withTicks } from "../rooms/rooms.ts";
import { BossActor, DUNGEON_ASSETS, lootModel, plaque, type Terminal } from "./dungeon3d.ts";
import { Minions } from "./minions.ts";
import {
  arc,
  beamWidth,
  type Caps,
  hpLeft,
  LOOT_DELAY_S,
  LOOT_FLY_S,
  LOOT_LAND_S,
  LOOT_POP_S,
  LOOT_STAGGER_S,
  minionRate,
  minionsOf,
  owedShots,
  peopleShown,
  petRate,
  RAID_SEAT_Y,
  raidEvents,
  raiderRate,
  resting,
  weekOverText,
} from "./raidfx.ts";

/**
 * The raid dungeon's cast, driven by the real raid (`hud.raid`) and the raiders the server says have agents running
 * (`game/raid.ts`): the week's boss on its dais with its HP plate and taunts, each raider at their war desk with their
 * laptop open (and a few robot minions), missiles from every laptop to the boss as fast as they burn tokens, hits as
 * flashes and floating numbers, the fall and the next rung's arrival, the loot's rarity beams flying to their winners,
 * the dark before the first raid and the dim after the week's last. Everything that moves is `live`.
 */

const BOSS_Y = 0.28;
/** Where the boss's middle is, above its feet. */
const BOSS_MID = 0.95;
const FALL_S = 2.2;
const BANNER_S = 3.5;
const HIT_COLOUR = new THREE.Color("#e0b3ff");
const MINION_COLOUR = new THREE.Color("#9dff8a");
const SEAT_Y = RAID_SEAT_Y;
const PET_COLOUR = new THREE.Color("#ffc46b");
const MINION_SCALE = 0.5;
const MAX_NEW_PER_FRAME = 1;

type Raider = Raiders["top"][number];

interface Missile {
  from: THREE.Vector3;
  control: THREE.Vector3;
  to: THREE.Vector3;
  at: number;
  s: number;
  /** Who fired it: a laptop, one of its robot minions, or your pet. */
  by: "laptop" | "minion" | "pet";
}

interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  at: number;
  s: number;
  colour: THREE.Color;
}

interface Seated {
  raider: Raider;
  seat: [number, number];
  idx: number;
  owed: number;
  /** Until when (clock seconds) the laptop is lit bright: it just fired. */
  lit: number;
  avatar: Avatar | null;
  /** Shirt and skin, for the stand-in a crowded room draws instead of an avatar. */
  shirt: string;
  skin: string;
  bots: { owed: number; at: THREE.Vector3; lit: number }[];
  /** The monitors they chose, standing on their war desk in place of the laptop (none for the laptop). */
  setup: { tier: number; model: Model } | null;
}

interface Flight {
  news: LootNews;
  rarity: Rarity;
  colour: THREE.Color;
  start: number;
  dx: number;
  root: THREE.Group;
  model: Model | null;
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  to: THREE.Vector3 | null;
  ticks: ((t: number) => void)[];
  label: string;
}

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const ease = (k: number): number => 1 - (1 - k) ** 3;

const LAPTOP_MAX = 64;
/** This week's kills hang on the back wall, either side of the boss, between the torches. */
const PLAQUE_X = [4, 5, 6, 7, 19, 20, 21, 22];

export class DungeonLive {
  readonly group = new THREE.Group();
  readonly boss: BossActor;
  private readonly bossAt = new THREE.Vector3();
  private readonly lids: THREE.InstancedMesh;
  private readonly screens: THREE.InstancedMesh;
  private readonly minions: Minions;
  private readonly figures: Figures;
  private readonly missiles: Swarm;
  private readonly sparks: Swarm;
  private readonly lair: THREE.Mesh;
  private readonly flying: Missile[] = [];
  private readonly burst: Spark[] = [];
  private readonly seated = new Map<number, Seated>();
  private crowd: ReturnType<typeof raidersNow> = null;
  private raid: Raid | null;
  private last = 0;
  private t = 0;
  /** The fallen boss, and the next one coming up after it. */
  private pending: { at: number; boss: Raid["boss"]; hp: number } | null = null;
  private bannerUntil = 0;
  private bannerText: string | null = null;
  private lootQueue: Flight[] = [];
  private readonly later: { at: number; text: string; gold: boolean }[] = [];
  private signList: Sign[] = [];
  private signKey = "";
  private frame = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly mat = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly unsub: () => void;
  private readonly col = new THREE.Color();
  /** The wall terminal that shows the boss's HP, and the plaques of this week's kills. */
  private readonly terminal: Terminal | null;
  private terminalShare: number | null | undefined;
  private readonly plaques = new THREE.Group();
  private plaqueKey = "";
  private plaqueSigns: Sign[] = [];

  constructor(
    private readonly map: GameMap,
    private readonly caps: Caps,
  ) {
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
    this.group.name = "dungeon-live";
    const dais = map.find("Z");
    const xs = dais.map(([x]) => x);
    const ys = dais.map(([, y]) => y);
    this.bossAt.set(
      (Math.min(...xs) + Math.max(...xs) + 1) / 2 - map.x0,
      BOSS_Y,
      (Math.min(...ys) + Math.max(...ys) + 1) / 2 - map.y0,
    );
    this.raid = hud.get().raid;
    const r = this.raid;
    this.boss = new BossActor(r?.boss.id ?? "rate-limit", {
      silhouette: r?.prelaunch === true,
      maxHp: r?.hp ?? 2e9,
      hp: r ? hpLeft(r) : 2e9,
      rung: r?.boss.rung ?? 1,
    });
    this.boss.root.position.copy(this.bossAt);
    this.group.add(this.boss.root);

    // The laptops: one lid and one screen instanced for every desk.
    const lid = new THREE.BoxGeometry(0.42, 0.3, 0.02).translate(0, 0.15, 0);
    const screen = new THREE.PlaneGeometry(0.37, 0.25).translate(0, 0.16, 0.011);
    this.lids = this.instanced(lid, new THREE.MeshToonMaterial({ color: "#2b2433" }));
    this.screens = this.instanced(
      screen,
      new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    );
    this.screens.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LAPTOP_MAX * 3), 3);
    this.group.add(this.lids, this.screens);

    this.figures = new Figures(LAPTOP_MAX);
    this.group.add(this.figures.group);
    this.minions = new Minions(caps.minionsTotal);
    this.group.add(this.minions.group);
    this.missiles = new Swarm(caps.missiles * 2, 0.08);
    this.sparks = new Swarm(caps.sparks, 0.05);
    this.group.add(this.missiles.mesh, this.sparks.mesh);

    // The dark before the first raid: over the whole room.
    this.lair = new THREE.Mesh(
      new THREE.PlaneGeometry(map.width, map.height),
      new THREE.MeshBasicMaterial({ color: "#07050c", transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.lair.rotation.x = -Math.PI / 2;
    this.lair.position.set(map.width / 2, 2.4, map.height / 2);
    this.lair.userData.nopick = true;
    this.lair.visible = r?.prelaunch === true;
    this.group.add(this.lair);

    const wall = this.map.find("j").length ? 2.0 : 2.0;
    const term = DUNGEON_ASSETS.find((a) => a.id === "tile:M")?.build() as Terminal | undefined;
    this.terminal = term ?? null;
    if (term) {
      term.position.set(1.5 - map.x0, 0, wall);
      this.group.add(term);
    }
    this.group.add(this.plaques);

    this.unsub = onLoot((news) => this.noteLoot(news));
    this.applyRaid(true);
  }

  private instanced(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geometry, material, LAPTOP_MAX);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true;
    m.userData.live = true;
    m.userData.nopick = true;
    return m;
  }

  // MARK: The raid

  /** Brings the boss up to date with `hud.raid`; `first` is the room being built, which replays nothing. */
  private applyRaid(first = false): void {
    const next = hud.get().raid;
    const before = this.raid;
    if (!first && next === before) return;
    this.raid = next;
    if (!next) return;
    const ev = first ? { launch: false, kill: null, hit: 0, mine: 0 } : raidEvents(before, next);
    const boss = this.boss;
    if (ev.launch) {
      boss.silhouette = false;
      boss.spawn(next.boss.id, next.boss.rung, next.hp);
      this.burstAt(this.bossAt.x, BOSS_Y + BOSS_MID, this.bossAt.z, "#ffd35c", 40, 1.4);
    } else if (before?.prelaunch && !next.prelaunch) {
      boss.silhouette = false;
      boss.spawn(next.boss.id, next.boss.rung, next.hp);
    }
    if (ev.kill && !boss.fallen) {
      boss.kill();
      this.pending = { at: this.t + FALL_S, boss: next.boss, hp: next.hp };
      this.burstAt(this.bossAt.x, BOSS_Y + BOSS_MID, this.bossAt.z, "#ffd35c", 40, 1.4);
    }
    if (ev.hit > 0) {
      boss.flinch(`-${compact(ev.hit)}`);
      if (ev.mine > 0) this.later.push({ at: this.t + 0.25, text: `-${compact(ev.mine)} you`, gold: true });
    }
    this.lair.visible = next.prelaunch;
  }

  /** The wall terminal's HP bar and the kill plaques on the back wall (this week's, the last eight). */
  private wall(): void {
    const r = this.raid;
    const share = r && !r.prelaunch && !r.closed && r.hp > 0 && !this.boss.fallen ? hpLeft(r) / r.hp : null;
    if (
      this.terminal &&
      share !== this.terminalShare &&
      (share === null || this.terminalShare == null || Math.abs(share - this.terminalShare) > 0.004)
    ) {
      this.terminalShare = share;
      this.terminal.set(share);
    }
    const kills = r && !r.prelaunch ? r.kills.slice(-PLAQUE_X.length) : [];
    const key = kills.map((k) => `${k.rung}:${k.boss.id}`).join();
    if (key === this.plaqueKey) return;
    this.plaqueKey = key;
    for (const c of [...this.plaques.children]) {
      c.removeFromParent();
      disposeObject(c);
    }
    this.plaqueSigns = [];
    kills.forEach((k, i) => {
      const m = plaque(
        Math.max(
          0,
          DUNGEON_BOSSES.findIndex((b) => b.id === k.boss.id),
        ),
      );
      const x = PLAQUE_X[i]! + 0.5 - this.map.x0;
      m.position.set(x, 0, 2.0);
      this.plaques.add(m);
      this.plaqueSigns.push({
        key: `plaque:${i}`,
        at: [x, 1.05, 2.2],
        kind: "label",
        text: `${k.rung}`,
        cls: "gold",
      });
    });
    this.signKey = "";
  }

  /** What the plate says and shows, every frame (it only redraws when something changed). */
  private plate(): void {
    const r = this.raid;
    if (!r) return;
    const boss = this.boss;
    if (this.pending) {
      if (this.t >= this.pending.at) {
        boss.spawn(this.pending.boss.id, this.pending.boss.rung, this.pending.hp);
        this.bannerText = `⚔️ Rung ${this.pending.boss.rung}: ${this.pending.boss.emoji} ${this.pending.boss.name}`;
        this.bannerUntil = this.t + BANNER_S;
        this.pending = null;
      } else return;
    }
    if (boss.fallen) return;
    const banner = r.prelaunch
      ? `⚠️ ??? · wakes in ${countdownOf(r.launchAt)}`
      : (weekOverText(r) ?? (this.t < this.bannerUntil ? this.bannerText : null));
    boss.setInfo({
      name: r.boss.name,
      emoji: r.boss.emoji,
      rung: r.boss.rung,
      hp: hpLeft(r),
      maxHp: r.hp,
      banner,
      taunts: r.boss.taunts,
      bar: !r.prelaunch,
    });
    boss.setQuiet(resting(r));
  }

  // MARK: Raiders

  /** Seats everyone the server says is raiding, where the 2D game seats them. */
  private syncRaiders(): void {
    const crowd = raidersNow();
    if (crowd === this.crowd) return;
    this.crowd = crowd;
    const ids = new Set<number>();
    for (const p of crowd?.top ?? []) {
      const seat = seatTile(p.id);
      if (!seat) continue;
      ids.add(p.id);
      const known = this.seated.get(p.id);
      if (known) {
        known.raider = p;
        known.seat = seat;
      } else {
        const look = lookFrom2D(p.look as never, { level: 1 });
        this.seated.set(p.id, {
          raider: p,
          seat,
          idx: 0,
          owed: Math.random(),
          lit: 0,
          avatar: null,
          shirt: look.outfit[0],
          skin: look.skin,
          bots: [],
          setup: null,
        });
      }
    }
    for (const [id, s] of this.seated)
      if (!ids.has(id)) {
        this.removeSeated(s);
        this.seated.delete(id);
      }
    this.layout();
  }

  private removeSeated(s: Seated): void {
    if (s.setup) {
      s.setup.model.removeFromParent();
      disposeObject(s.setup.model);
      s.setup = null;
    }
    if (s.avatar) {
      s.avatar.root.removeFromParent();
      disposeObject(s.avatar.root);
    }
  }

  /** The laptops on their desks, and who gets to be drawn as a person. */
  private layout(): void {
    const all = [...this.seated.values()];
    const shown = new Set(
      peopleShown(
        all.map((s) => ({ id: s.raider.id, burn: s.raider.burn })),
        this.caps.people,
      ).map((p) => p.id),
    );
    let bots = 0;
    all.forEach((s, i) => {
      s.idx = i;
      const [sx, sy] = s.seat;
      // The desk is the tile north of the seat.
      const dx = sx - this.map.x0 + 0.5;
      const dz = sy - 1 - this.map.y0 + 0.5;
      // Their chosen monitors stand on the desk where the laptop would (the laptop itself is shrunk away).
      const tier = Math.max(0, Math.min(s.raider.desk ?? 0, DESKS.length - 1));
      if (tier === 0 || s.setup?.tier !== tier) {
        if (s.setup) {
          s.setup.model.removeFromParent();
          disposeObject(s.setup.model);
          s.setup = null;
        }
        if (tier > 0) {
          const model = fleetDesk(tier, 3 + s.raider.id, false);
          this.group.add(model);
          s.setup = { tier, model };
        }
      }
      s.setup?.model.position.set(dx, 0.03, dz);
      this.mat.compose(
        this.tmp.set(dx, 0.72, dz - 0.07),
        this.quat.setFromEuler(new THREE.Euler(-0.35, 0, 0)),
        s.setup ? this.tmp2.set(0, 0, 0) : this.tmp2.set(1, 1, 1),
      );
      this.lids.setMatrixAt(i, this.mat);
      this.screens.setMatrixAt(i, this.mat);
      this.paintScreen(i, false);
      if (!shown.has(s.raider.id) && s.avatar) {
        s.avatar.root.removeFromParent();
        disposeObject(s.avatar.root);
        s.avatar = null;
      }
      // Minions behind the chair, while the crowd is small enough.
      const want = shown.has(s.raider.id)
        ? Math.min(minionsOf(s.raider.agents, this.caps.minions), Math.max(0, this.caps.minionsTotal - bots))
        : 0;
      bots += want;
      s.bots.length = Math.min(s.bots.length, want);
    });
    this.lids.count = this.screens.count = Math.min(LAPTOP_MAX, all.length);
    this.lids.instanceMatrix.needsUpdate = this.screens.instanceMatrix.needsUpdate = true;
    if (this.screens.instanceColor) this.screens.instanceColor.needsUpdate = true;
    this.signKey = "";
  }

  private paintScreen(i: number, bright: boolean): void {
    this.screens.setColorAt(i, this.col.set(bright ? "#e4f5fd" : "#4aa8cf"));
    if (this.screens.instanceColor) this.screens.instanceColor.needsUpdate = true;
  }

  /** Builds up to a couple of people and minions a frame, so a crowd arriving doesn't stall one. */
  private build(): void {
    let budget = MAX_NEW_PER_FRAME;
    const shown = new Set(
      peopleShown(
        [...this.seated.values()].map((s) => ({ id: s.raider.id, burn: s.raider.burn })),
        this.caps.people,
      ).map((p) => p.id),
    );
    let bots = [...this.seated.values()].reduce((a, s) => a + s.bots.length, 0);
    for (const s of this.seated.values()) {
      if (budget <= 0) return;
      if (!shown.has(s.raider.id)) continue;
      const x = s.seat[0] - this.map.x0 + 0.5;
      const z = s.seat[1] - this.map.y0 + 0.5;
      if (!s.avatar) {
        const av = new Avatar(lookFrom2D(s.raider.look as never, { level: 1 }), "voxel");
        av.pose = "type";
        av.root.position.set(x, SEAT_Y, z);
        av.root.rotation.y = Math.PI;
        this.group.add(av.root);
        s.avatar = av;
        budget--;
      }
      const want = Math.min(
        minionsOf(s.raider.agents, this.caps.minions),
        Math.max(0, this.caps.minionsTotal - (bots - s.bots.length)),
      );
      while (s.bots.length < want && budget > 0) {
        const i = s.bots.length;
        s.bots.push({
          owed: Math.random(),
          at: new THREE.Vector3(x + (i - (want - 1) / 2) * 0.3, 0, z + 0.62),
          lit: 0,
        });
        bots++;
      }
    }
  }

  // MARK: Shots

  private fire(from: THREE.Vector3, by: Missile["by"]): void {
    if (this.flying.length >= this.caps.missiles) return;
    const to = new THREE.Vector3(
      this.bossAt.x + (Math.random() - 0.5) * 0.9,
      BOSS_Y + BOSS_MID + (Math.random() - 0.5) * 0.7,
      this.bossAt.z + (Math.random() - 0.5) * 0.5,
    );
    const control = new THREE.Vector3(
      (from.x + to.x) / 2 + (Math.random() - 0.5) * 1.6,
      Math.max(from.y, to.y) + 1.2 + Math.random() * 1.2,
      (from.z + to.z) / 2,
    );
    this.flying.push({
      from: from.clone(),
      control,
      to,
      at: this.t,
      s: 0.75 * (0.8 + Math.random() * 0.5),
      by,
    });
  }

  private burstAt(
    x: number,
    y: number,
    z: number,
    colour: THREE.ColorRepresentation,
    n: number,
    life = 0.32,
  ): void {
    const c = new THREE.Color(colour);
    for (let i = 0; i < n && this.burst.length < this.caps.sparks; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.1;
      const v = (0.7 + Math.random() * 1.4) * (0.32 / life) ** 0.5;
      this.burst.push({
        p: new THREE.Vector3(x, y, z),
        v: new THREE.Vector3(Math.cos(a) * v, up * v * 1.4, Math.sin(a) * v),
        at: this.t,
        s: life,
        colour: c,
      });
    }
  }

  private shoot(dt: number, closed: boolean): void {
    for (const s of this.seated.values()) {
      const r = s.raider;
      const rate = raiderRate(r.burn, closed);
      const dx = s.seat[0] - this.map.x0 + 0.5;
      const dz = s.seat[1] - 1 - this.map.y0 + 0.5;
      const got = owedShots(s.owed, rate, dt * 1000);
      s.owed = got.owed;
      if (got.shots > 0) {
        s.lit = this.t + 0.12;
        for (let i = 0; i < got.shots; i++) this.fire(this.tmp.set(dx, 1.0, dz), "laptop");
      }
      const lit = this.t < s.lit;
      if (lit !== (s.idx < LAPTOP_MAX && this.litNow.has(s.idx))) {
        if (lit) this.litNow.add(s.idx);
        else this.litNow.delete(s.idx);
        if (s.idx < LAPTOP_MAX) this.paintScreen(s.idx, lit);
      }
      for (const b of s.bots) {
        const mr = minionRate(r.burn, rate);
        const g = owedShots(b.owed, mr, dt * 1000);
        b.owed = g.owed;
        if (g.shots > 0) b.lit = this.t + 0.25;
        for (let i = 0; i < g.shots; i++) this.fire(this.tmp.set(b.at.x, 0.55, b.at.z), "minion");
      }
    }
    this.shootPet(dt, closed);
  }

  /**
   * Your pet helps while you sit at your own desk (`seated`): it sends little missiles of its own from where it stands
   * (`raidPet`, set by the 3D people), a quarter as fast as you. Stand up and it stops. Only the show, like the rest; the real hits are your synced tokens.
   */
  private shootPet(dt: number, closed: boolean): void {
    const mine = this.seated.get(world.selfId);
    const pet = world.avatars.get(world.selfId)?.info.look.pet ?? mine?.raider.look.pet ?? 0;
    if (!mine || !pet || !seated()) {
      this.petOwed = 0;
      return;
    }
    const rate = petRate(mine.raider.burn, raiderRate(mine.raider.burn, closed));
    const got = owedShots(this.petOwed, rate, dt * 1000);
    this.petOwed = got.owed;
    if (got.shots === 0) return;
    // Beside the seat, if the pet isn't drawn (yet).
    const [px, pz] = raidPet.at ?? [
      mine.seat[0] - this.map.x0 + 0.5 + 0.7,
      mine.seat[1] - this.map.y0 + 0.5 + 0.3,
    ];
    for (let i = 0; i < got.shots; i++) this.fire(this.tmp.set(px, 0.55, pz), "pet");
  }
  private petOwed = 0;
  private readonly litNow = new Set<number>();

  /** Moves the missiles along their arcs and the sparks along theirs, and draws them. */
  private flyShots(): void {
    const t = this.t;
    this.missiles.begin();
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const m = this.flying[i]!;
      const k = (t - m.at) / (m.s || 0.75);
      if (k >= 1) {
        this.burstAt(m.to.x, m.to.y, m.to.z, colourOf(m.by), m.by === "laptop" ? 4 : 2);
        this.flying.splice(i, 1);
        continue;
      }
      const colour = colourOf(m.by);
      // A short trail behind the bolt.
      for (let j = 2; j >= 0; j--) {
        const kk = Math.max(0, k - j * 0.04);
        this.missiles.add(
          arc(m.from.x, m.control.x, m.to.x, kk),
          arc(m.from.y, m.control.y, m.to.y, kk),
          arc(m.from.z, m.control.z, m.to.z, kk),
          j === 0 ? (m.by === "laptop" ? 1.2 : 0.8) : 0.7 - j * 0.15,
          j === 0 ? "#ffffff" : colour,
        );
      }
    }
    this.missiles.end();
    this.sparks.begin();
    const dtS = 1 / 60;
    for (let i = this.burst.length - 1; i >= 0; i--) {
      const s = this.burst[i]!;
      const age = t - s.at;
      if (age >= s.s) {
        this.burst.splice(i, 1);
        continue;
      }
      s.v.y -= 2.2 * dtS;
      s.p.addScaledVector(s.v, dtS);
      this.sparks.add(s.p.x, s.p.y, s.p.z, 1 - age / s.s, s.colour);
    }
    this.sparks.end();
  }

  // MARK: Loot

  private noteLoot(news: readonly LootNews[]): void {
    const sorted = [...news].sort((a, b) => RANK[rarityOf(b.item)] - RANK[rarityOf(a.item)]);
    const room = 16 - this.lootQueue.length;
    sorted.slice(0, Math.max(0, room)).forEach((n, i) => {
      const rarity = rarityOf(n.item);
      const colour = new THREE.Color(RARITIES[rarity].color);
      const root = new THREE.Group();
      root.visible = false;
      const made = withTicks(() => lootModel(n.item));
      const model = made.value;
      if (model) root.add(model);
      const w = beamWidth(RANK[rarity]);
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(w * 2, 1, w * 2),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      beam.userData.nopick = true;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 28).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false }),
      );
      ring.userData.nopick = true;
      this.group.add(root, beam, ring);
      beam.visible = ring.visible = false;
      const name = lootById(n.item)?.name ?? n.item;
      this.lootQueue.push({
        news: n,
        rarity,
        colour,
        start: this.t + LOOT_DELAY_S + i * LOOT_STAGGER_S,
        dx: (i % 2 ? 1 : -1) * (0.5 + ((i * 7) % 18) / 12),
        root,
        model,
        beam,
        ring,
        to: null,
        ticks: made.ticks,
        label: `✨ ${n.name}: ${name}`,
      });
    });
  }

  private flyLoot(): void {
    for (let i = this.lootQueue.length - 1; i >= 0; i--) {
      const f = this.lootQueue[i]!;
      const age = this.t - f.start;
      if (age < 0) continue;
      if (age > LOOT_POP_S + LOOT_FLY_S + LOOT_LAND_S) {
        for (const o of [f.root, f.beam, f.ring]) {
          o.removeFromParent();
          disposeObject(o);
        }
        this.lootQueue.splice(i, 1);
        this.signKey = "";
        continue;
      }
      const start = this.bossAt;
      f.to ??= this.deskOf(f.news.userId) ?? new THREE.Vector3(start.x + f.dx * 2, 0.5, start.z + 3.5);
      const top = this.tmp.set(start.x + f.dx, BOSS_Y + 1.8, start.z);
      const rank = RANK[f.rarity];
      const root = f.root;
      root.visible = true;
      let scale = 1;
      let landed = false;
      if (age < LOOT_POP_S) {
        const u = ease(age / LOOT_POP_S);
        root.position.set(
          start.x + (top.x - start.x) * u,
          BOSS_Y + BOSS_MID + (top.y - BOSS_Y - BOSS_MID) * u,
          start.z,
        );
        scale = 0.4 + 0.8 * u;
      } else if (age < LOOT_POP_S + LOOT_FLY_S) {
        const u = ease((age - LOOT_POP_S) / LOOT_FLY_S);
        const cx = (top.x + f.to.x) / 2;
        const cy = Math.max(top.y, f.to.y) + 0.8;
        root.position.set(
          arc(top.x, cx, f.to.x, u),
          arc(top.y, cy, f.to.y, u),
          arc(top.z, (top.z + f.to.z) / 2, f.to.z, u),
        );
        scale = 1.2 - 0.3 * u;
      } else {
        landed = true;
        root.position.copy(f.to);
        root.position.y += 0.3 + Math.sin(this.t * 4) * 0.05;
        scale = 0.9;
      }
      const fade = landed ? 1 - (age - LOOT_POP_S - LOOT_FLY_S) / LOOT_LAND_S : 1;
      root.scale.setScalar(scale * 0.8 * Math.max(0.05, fade));
      for (const f2 of f.ticks) f2(this.t);
      // The beam: a pillar of its colour while it pops out.
      const bm = f.beam;
      if (age < LOOT_POP_S + 0.3) {
        const a = Math.min(1, age / 0.15) * (1 - Math.max(0, age - LOOT_POP_S) / 0.3);
        bm.visible = true;
        bm.scale.set(1, 5, 1);
        bm.position.set(top.x, BOSS_Y + 2.4, start.z);
        (bm.material as THREE.MeshBasicMaterial).opacity = 0.4 * a;
      } else bm.visible = false;
      // The landing: a ring spreading out from the desk.
      const ring = f.ring;
      if (landed) {
        const u = (age - LOOT_POP_S - LOOT_FLY_S) / LOOT_LAND_S;
        ring.visible = true;
        ring.position.set(f.to.x, f.to.y + 0.05, f.to.z);
        ring.scale.setScalar(0.3 + u * (0.9 + rank * 0.4));
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u);
      }
    }
  }

  /** A raider's desk, where their loot lands. */
  private deskOf(userId: number): THREE.Vector3 | null {
    const seat = seatTile(userId);
    return seat
      ? new THREE.Vector3(seat[0] - this.map.x0 + 0.5, 0.95, seat[1] - 1 - this.map.y0 + 0.5)
      : null;
  }

  // MARK: Frame

  /** Once a frame: `t` seconds, as the room's ticks get it. */
  update(t: number): void {
    const dt = this.last ? Math.min(0.1, Math.max(0, t - this.last)) : 0;
    this.last = t;
    this.t = t;
    this.frame++;
    this.applyRaid();
    this.syncRaiders();
    this.plate();
    this.wall();
    const r = this.raid;
    const closed = r ? resting(r) : false;
    for (let i = this.later.length - 1; i >= 0; i--)
      if (t >= this.later[i]!.at) {
        const l = this.later.splice(i, 1)[0]!;
        this.boss.flinch(l.text, l.gold);
      }
    this.build();
    // A week with kills ends in gold sparkles instead of missiles.
    if ((r?.closed || r?.cleared) && !r.prelaunch && r.kills.length > 0 && Math.random() < dt * 4)
      this.burstAt(
        this.bossAt.x + (Math.random() - 0.5) * 1.8,
        BOSS_Y + BOSS_MID + (Math.random() - 0.5) * 1.2,
        this.bossAt.z,
        "#ffd35c",
        1,
        0.9,
      );
    this.shoot(dt, closed);
    this.flyShots();
    this.flyLoot();
    // People and minions: the far half of a big crowd moves every other frame.
    // Yours isn't drawn while you sit in it: your own body is at the desk then (`Entities`).
    const occupied = (s: Seated) =>
      [...world.avatars.values()].some(
        (a) => a.state === "sit" && (a.info.id === s.raider.id || (a.x === s.seat[0] && a.y === s.seat[1])),
      );
    for (const s of this.seated.values()) {
      const gone = occupied(s);
      if (s.avatar) s.avatar.root.visible = !gone;
      if (gone || (this.caps.people < 30 && (this.frame + s.idx) % 2)) continue;
      s.avatar?.update(dt * (this.caps.people < 30 ? 2 : 1), t);
    }
    this.figures.begin();
    for (const s of this.seated.values())
      if (!s.avatar && !occupied(s))
        this.figures.add(
          s.seat[0] - this.map.x0 + 0.5,
          SEAT_Y,
          s.seat[1] - this.map.y0 + 0.5,
          s.shirt,
          s.skin,
        );
    this.figures.end();
    this.minions.begin();
    for (const s of this.seated.values())
      for (const [i, b] of s.bots.entries())
        this.minions.add(
          b.at.x,
          b.at.z,
          Math.PI,
          MINION_SCALE,
          t < b.lit,
          Math.abs(Math.sin(t * 3 + s.idx + i)) * 0.03,
        );
    this.minions.end();
  }

  /** The words fixed in the room: each raider's name, who is not at a desk, the boss's link, the loot that landed. */
  signs(): Sign[] {
    const landed = this.lootQueue.filter((f) => f.to && this.t - f.start > LOOT_POP_S + LOOT_FLY_S).length;
    const prompt = this.prompt();
    const key = `${this.crowd?.top.length ?? -1}:${this.crowd?.more ?? 0}:${this.lootQueue.length}:${landed}:${this.seated.size}:${this.raid?.prelaunch}:${prompt}`;
    if (key === this.signKey) return this.signList;
    this.signKey = key;
    const list: Sign[] = [];
    const x0 = this.map.x0;
    const y0 = this.map.y0;
    for (const s of this.seated.values()) {
      const x = s.seat[0] - x0 + 0.5;
      const z = s.seat[1] - y0 + 0.5;
      list.push({
        key: `raider:${s.raider.id}`,
        at: [x, 1.75, z],
        kind: "label",
        text: s.raider.name,
        own: s.raider.id === world.selfId,
      });
      if (prompt && s.raider.id === world.selfId) {
        const seat = s.seat;
        list.push({
          key: "sit",
          at: [x, 2.15, z],
          kind: "label",
          text: prompt === "stand" ? "E · stand up" : "E · take your seat",
          cls: "gold",
          onClick: () => (prompt === "stand" ? standUp() : void sit(seat[0], seat[1])),
        });
      }
      const extra = s.raider.agents - 1 - s.bots.length;
      if (extra > 0)
        list.push({
          key: `extra:${s.raider.id}`,
          at: [x + 0.55, 0.9, z + 0.5],
          kind: "label",
          text: `+${extra}`,
          cls: "green",
        });
    }
    const more = this.crowd?.more ?? 0;
    if (more > 0)
      list.push({
        key: "more",
        at: [this.map.width / 2, 0.8, this.map.height - 1.5],
        kind: "label",
        text: `⚔️ +${more} more raiding`,
      });
    if (!this.crowd?.top.length && !this.raid?.prelaunch)
      list.push({
        key: "empty",
        at: [this.bossAt.x, 0.4, this.bossAt.z + 2.6],
        kind: "label",
        text: "No agents running right now. Start one and take a desk.",
      });
    if (this.raid?.prelaunch)
      list.push({
        key: "desks",
        at: [this.bossAt.x, 0.4, this.bossAt.z + 2.6],
        kind: "label",
        text: "The desks are empty. For now. Monday 08:00, every agent fights.",
      });
    list.push({
      key: "raidlink",
      at: [this.bossAt.x, 0.2, this.bossAt.z + 1.4],
      kind: "label",
      text: "⚔️ The raid",
      cls: "gold",
      onClick: () => hud.set({ panel: { kind: "raid" } }),
    });
    for (const f of this.lootQueue)
      if (
        f.to &&
        this.t - f.start > LOOT_POP_S + LOOT_FLY_S &&
        this.t - f.start < LOOT_POP_S + LOOT_FLY_S + LOOT_LAND_S
      )
        list.push({
          key: `loot:${f.news.userId}:${f.news.item}`,
          at: [f.to.x, 1.4, f.to.z],
          kind: "label",
          text: f.label,
          cls: f.rarity,
        });
    list.push(...this.plaqueSigns);
    this.signList = list;
    return list;
  }

  /** What E does at your own desk right now: stand up while you sit, sit when you are close by, else nothing. */
  private prompt(): "" | "sit" | "stand" {
    if (seated()) return "stand";
    const seat = mySeat();
    const me = world.avatars.get(world.selfId);
    if (!seat || !me || !canSit(world.room, seat, me.state)) return "";
    return Math.abs(me.x - seat[0]) + Math.abs(me.y - seat[1]) === 1 ? "sit" : "";
  }

  dispose(): void {
    this.unsub();
    for (const s of this.seated.values()) this.removeSeated(s);
    this.seated.clear();
    for (const f of this.lootQueue) for (const o of [f.root, f.beam, f.ring]) disposeObject(o);
    this.lootQueue.length = 0;
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}

const colourOf = (by: Missile["by"]): THREE.Color =>
  by === "pet" ? PET_COLOUR : by === "minion" ? MINION_COLOUR : HIT_COLOUR;

const rarityOf = (item: string): Rarity => lootById(item)?.rarity ?? "common";

const countdownOf = (at: number): string => countdown(at);
