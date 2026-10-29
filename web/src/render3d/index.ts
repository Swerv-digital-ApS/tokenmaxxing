import { GameMap } from "@tokenmaxxing/core/maps.ts";
import type { Rot } from "@tokenmaxxing/core/office.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { houseTier, mapOf, ownerOfOffice } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { viewHooks } from "../game/camera.ts";
import { ghost, startPlace } from "../game/furniture.ts";
import { gameHits } from "../game/games.ts";
import { peekHits } from "../game/houses.ts";
import { send, walkTo } from "../game/input.ts";
import { hudInset } from "../game/inset.ts";
import { chipHits, signHits } from "../game/labels.ts";
import { hover, hoverStrength } from "../game/near.ts";
import { setRaiders } from "../game/raid.ts";
import type { Renderer, Tile } from "../game/renderer.ts";
import { seasonLookNow } from "../game/seasons.ts";
import { skyNow } from "../game/sky.ts";
import { loadTrophies } from "../game/trophies.ts";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import type { GraphicsSettings } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { tagCap } from "./engine/declutter.ts";
import { gpuNow } from "./engine/dispose.ts";
import { Overlay } from "./engine/overlay.ts";
import { castAt } from "./engine/pick.ts";
import { Pipeline } from "./engine/pipeline.ts";
import { CameraRig } from "./engine/rig.ts";
import { SEE } from "./engine/seethrough.ts";
import { Drops } from "./furniture/drops.ts";
import { Placer } from "./furniture/placer.ts";
import { setGeometryDetail } from "./kit/kit.ts";
import { Entities } from "./people/entities.ts";
import { keyDirection } from "./people/motion.ts";
import { applyGraphics } from "./perf/tiers.ts";
import {
  buildRoom,
  preloadRoom,
  prepareRoom,
  type RoomCtx,
  type RoomView,
  roomReady,
  roomsNextTo,
} from "./rooms/rooms.ts";
import { dropWarmedShops, SHOP_INSET, type ShopDisplay, type ShopId } from "./shops/catalog.ts";
import { type InstalledShops, installShops, type ShopWorld } from "./shops/index.ts";
import "./rooms/room-generic.ts";
import "./rooms/room-loaders.ts";
import "./town/room-town.ts";
import { lightPipeline, RoomStage } from "./engine/stage3d.ts";
import { signature as trophySignature, watchShelf } from "./furniture/trophies3d.ts";
import { easeWalls } from "./rooms/walls.ts";
import { warmNearShops } from "./rooms/warm.ts";
import { Signs } from "./town/signs.ts";
import { burstCap } from "./town/world-logic.ts";

/**
 * The 3D renderer's entry, loaded on demand (`loadRenderer`) so Three.js is never downloaded on the Low
 * tier. Return a `Renderer` (see `game/renderer.ts`), or null when 3D isn't available: the game then runs
 * on 2D. Throwing (a shader error, a lost context) also falls back, with a toast.
 */
export function create3D(): Renderer | null {
  return new Renderer3D();
}

/** The world's clock in minutes since midnight in Copenhagen, for the street's schedules. */
function minutesNow(): number {
  const w = worldWall(skyNow());
  return w.hour * 60 + w.minute + w.second / 60;
}

/** Every texture a scene's materials use, once each, for uploading ahead of its first frame. */
function texturesOf(scene: THREE.Scene): THREE.Texture[] {
  const seen = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : [])
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) seen.add(v);
  });
  return [...seen];
}

let mapIds = 0;
const mapKeys = new WeakMap<object, number>();
const mapKey = (m: object): number => {
  const known = mapKeys.get(m);
  if (known) return known;
  mapKeys.set(m, ++mapIds);
  return mapIds;
};

/** A blink between rooms: how long the screen takes to close when the server is moving us, and to open. */
const FADE_OUT_MS = 170;
const FADE_IN_MS = 360;
/** Rooms worth building before the door is taken (fixed maps, one door away), and how long after arriving to wait. */
const WARM_KINDS: readonly string[] = ["town", "inn"];
const WARM_AFTER_MS = 1500;
const TEXTURES_PER_FRAME = 6;
/** Building ahead costs a few hundred ms in all: it waits until you have stood still this long. */
const STILL_MS = 600;
/** How far a press moves (CSS pixels) before it is a drag of the picture, not a click. */
const DRAG_PX = 6;

/**
 * A room shown for the first time stays under the veil until its shaders are compiled (off the main thread), so the
 * frame that links the rest isn't a freeze in view and the fade in starts after it. Never longer than this.
 */
const REVEAL_MAX_MS = 1500;

/**
 * The game, in 3D: the room the server says we are in, everyone in it as voxel people with their pets, name
 * tags and speech as DOM over the canvas, the town's sky from the game's own clock and weather, and the
 * camera following you. The state is the 2D game's (`world`): this only draws it, and turns clicks into the
 * same tiles the 2D game's input already knows what to do with.
 */
class Renderer3D implements Renderer {
  readonly kind = "3d";
  private readonly canvas = document.createElement("canvas");
  private readonly pipe: Pipeline;
  private readonly overlay = new Overlay();
  private readonly rig = new CameraRig();
  private readonly entities = new Entities(this.overlay);
  private readonly signs = new Signs(this.overlay);
  private readonly drops = new Drops();
  private readonly caster = new THREE.Raycaster();
  private stage: RoomStage | null = null;
  /** The town is kept while you are indoors: coming back out doesn't rebuild it. */
  private town: { stage: RoomStage; key: string } | null = null;
  private key = "";
  private room = "";
  /** A room next door, built and its shaders compiled in a quiet moment, for the frame its door is taken. */
  private ahead: { id: string; map: GameMap; stage: RoomStage } | null = null;
  /** When the current room was entered (frame clock), and whether this room's neighbour has been seen to. */
  private since = 0;
  private warmed = "";
  private stillSince = 0;
  private stillAt: [number, number] | null = null;
  /** A room built ahead whose batching and shaders are still to do (next frame). */
  private warming: {
    stage: RoomStage;
    textures: THREE.Texture[] | null;
    compiled: boolean;
    draw?: boolean;
  } | null = null;
  /** A room change waiting for the veil to close: it draws closed first, so the build happens behind it. */
  private veiled = false;
  /** A room just put on the stage that has never been drawn: kept under the veil until its shaders are in (and the town built). */
  private reveal: { since: number; pending: number; town: boolean } | null = null;
  /** Stages drawn at least once (or drawn ahead): their first frame in view is only the draw. */
  private readonly drawn = new WeakSet<RoomStage>();
  private w = 1;
  private h = 1;
  private detail: 0 | 1 | null = null;
  private shops: InstalledShops | null = null;
  private readonly placer = new Placer();
  private last = 0;
  private settings: GraphicsSettings | null = null;
  private labelsAll = false;
  private fail?: (reason: string) => void;
  private selfAt: [number, number] | null = null;
  private drag: { x: number; y: number; id: number; moving: boolean } | null = null;
  private errored = 0;
  private hooks3d: Required<typeof viewHooks> | null = null;
  private framing: { view: number; bounds: RoomView["bounds"] } | null = null;
  /** While a room works out what moves (`batch.ts`), the hour its schedules read. */
  private probeMinutes: number | null = null;
  private readonly hooks = { clock: (m: number | null) => (this.probeMinutes = m) };
  private readonly off: (() => void)[] = [];
  /** What the last frame cost, for the debug handle. */
  readonly stats = { frames: 0, builds: 0, lastBuildMs: 0, lastGap: 0, cpuMs: 0, entityMs: 0 };

  private readonly lost = (e: Event) => {
    e.preventDefault();
    this.fail?.("the graphics context was lost");
  };

  constructor() {
    this.canvas.id = "world";
    this.canvas.style.imageRendering = "auto";
    this.pipe = new Pipeline(this.canvas);
    this.pipe.autoQuality = false;
    // Draw calls and triangles are counted over the whole frame (the passes), reset by hand.
    this.pipe.renderer.info.autoReset = false;
    this.canvas.addEventListener("webglcontextlost", this.lost);
    // The HUD's item icons share this look: their shaders compile in idle time, not when the first shop opens.
    void import("./icons.ts").then((m) => m.warmIcons());
  }

  mount(host: HTMLElement): void {
    host.append(this.canvas);
    this.overlay.mount(host);
    // The 2D game's click targets are in canvas pixels; they are not ours.
    for (const hits of [chipHits, signHits, peekHits, gameHits]) hits.length = 0;
    this.hooks3d = {
      zoom: (step) => this.rig.zoom(step),
      rotate: (step) => this.rig.rotate(step),
      key: (dir) => keyDirection(dir as never, this.rig.turns) as never,
      shop: (_shop, x, y) => this.openShelf(x, y),
      toss: (x, y) => this.stage?.view.onToss?.(x, y),
      ghost: (g) => this.showGhost(g),
    };
    Object.assign(viewHooks, this.hooks3d);
    // Panning: drag the picture (the left or middle button, or one finger); it settles back on you when you
    // walk on. Two fingers pinch and twist instead (`touch.ts`). A press only pans once it has moved a few
    // pixels, and the click that ends a drag is swallowed, so a drag never walks you anywhere.
    const fingers = new Set<number>();
    let dragged = false;
    const down = (e: PointerEvent) => {
      dragged = false;
      if (e.pointerType === "touch") fingers.add(e.pointerId);
      if (fingers.size > 1 || (e.button !== 0 && e.button !== 1)) {
        this.drag = null;
        return;
      }
      if (e.button === 1) e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moving: e.button === 1 };
    };
    const move = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.moving) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_PX) return;
        d.moving = true;
        this.canvas.setPointerCapture(e.pointerId);
      }
      this.rig.panBy(e.clientX - d.x, e.clientY - d.y, this.h);
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (this.drag?.id !== e.pointerId) return;
      dragged = this.drag.moving;
      this.drag = null;
    };
    // In the capture phase and before the shops' own: nothing else hears the click.
    const click = (e: MouseEvent) => {
      if (dragged) e.stopImmediatePropagation();
      dragged = false;
    };
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("click", click, true);
    this.canvas.addEventListener("auxclick", (e) => e.preventDefault());
    this.off.push(() => {
      this.canvas.removeEventListener("pointerdown", down);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.canvas.removeEventListener("click", click, true);
    });
    this.shops = installShops(this.shopWorld);
    this.bindShopping();
    Object.assign(window, { __r3d: this });
    // `?r3dcheck`: builds and frees every room a few times over and says whether the GPU counts moved.
    // (The address is read from the navigation entry: signing in rewrites the page's own.)
    const opened = performance.getEntriesByType("navigation")[0]?.name ?? location.href;
    if (opened.includes("r3dcheck"))
      setTimeout(async () => {
        await Promise.all(
          ["town", "hq", "inn", "upstairs", "basement", "dungeon", "office"].map(prepareRoom),
        );
        const { before, after } = this.cycle(4);
        const leaked =
          before.geometries !== after.geometries ||
          before.textures !== after.textures ||
          before.programs !== after.programs;
        (leaked ? console.error : console.info)("3D leak check", leaked ? "LEAKED" : "ok", before, after);
      }, 3000);
  }

  onFail(cb: (reason: string) => void): void {
    this.fail = cb;
  }

  // MARK: Rooms

  /** The Office's wallpaper and floor as just chosen (the server's snapshot, which replaces the map, supersedes it). */
  private decorNow: { base: GameMap; map: GameMap } | null = null;

  /** Puts a wallpaper and floor on the Office at once: the room is built again from its map with them. */
  private applyDecor(d: { wall?: string; floor?: string }): void {
    if (ownerOfOffice(world.room) === null) return;
    const base = world.map;
    const m = this.decorNow?.base === base ? this.decorNow.map : base;
    this.decorNow = { base, map: new GameMap(m.id, m.name, m.rows, m.x0, m.y0, { ...m.decor, ...d }) };
    this.key = "";
  }

  private ctx(): RoomCtx {
    const map = this.decorNow && this.decorNow.base === world.map ? this.decorNow.map : world.map;
    return {
      map,
      companies: [...world.companies.values()],
      minutes: () => this.probeMinutes ?? minutesNow(),
    };
  }

  /** The town's identity, worked out once per list of companies (`setCompanies` replaces the map each time). */
  private preparing: string | null = null;
  private townKey: { companies: typeof world.companies; key: string } | null = null;

  /**
   * What identifies the room as drawn: the room itself, and for the town what its houses look like (each
   * company's plot, tier and brand: a new company, a house that grew or a new logo is a new town).
   */
  private roomKey(): string {
    if (world.room !== "town") {
      // An office's shelf of trophies is asked for while you are there; a new trophy builds the room again.
      const owner = ownerOfOffice(world.room);
      if (owner !== null) watchShelf(owner, performance.now(), loadTrophies);
      return `${world.room}:${mapKey(world.map)}${owner === null ? "" : `:${trophySignature(owner)}`}`;
    }
    return this.townIdentity();
  }

  /** What the town looks like now: its companies' plots, tiers, brands. */
  private townIdentity(): string {
    if (this.townKey?.companies !== world.companies)
      this.townKey = {
        companies: world.companies,
        key: `town:${[...world.companies.values()]
          .map(
            (c) =>
              `${c.plot}.${houseTier(c.tokens30d, c.members)}.${c.brand?.roof ?? ""}${c.brand?.logo ?? ""}.${c.deskFleet ?? 0}`,
          )
          .sort()
          .join()}`,
      };
    return `${this.townKey.key}:${seasonLookNow().key}`;
  }

  /** Makes the stage match `world.room`, building it (and clearing the people) when the room changes. */
  private ensureStage(now: number): boolean {
    const key = this.roomKey();
    if (this.stage && key === this.key) return true;
    if (!roomReady(world.room)) {
      // The room's code is not in yet: the old room stays under the veil until it is (the next door is preloaded, so this is rare).
      if (this.preparing !== world.room) {
        const id = world.room;
        this.preparing = id;
        void prepareRoom(id)
          .catch((e) => console.error("3D room code:", e))
          .finally(() => {
            if (this.preparing === id) this.preparing = null;
          });
      }
      return false;
    }
    const roomChanged = world.room !== this.room;
    // Nothing next door was ready: close the veil first and build on the frame after, so the stall is under black
    // rather than the old room freezing in view.
    if (
      roomChanged &&
      this.stage &&
      !this.veiled &&
      this.overlay.faded < 0.95 &&
      !this.settings?.reduceMotion &&
      !this.aheadFor(key)
    ) {
      this.veiled = true;
      this.overlay.snapFade(1);
      return false;
    }
    this.veiled = false;
    const t0 = performance.now();
    const old = this.stage;
    this.entities.group.removeFromParent();
    this.drops.group.removeFromParent();
    if (roomChanged) this.entities.clear();
    this.drops.clear();
    let next: RoomStage;
    if (world.room === "town" && this.town?.key === key) next = this.town.stage;
    else if (
      this.ahead?.id === world.room &&
      this.ahead.map === world.map &&
      key === `${world.room}:${mapKey(world.map)}`
    ) {
      next = this.ahead.stage;
      this.ahead = null;
    } else {
      next = new RoomStage(buildRoom(world.room, this.ctx()), this.hooks);
      if (world.room === "town") {
        // A town for other plots replaces the one kept.
        if (this.town && this.town.stage !== old) this.town.stage.dispose();
        this.town = { stage: next, key };
      }
    }
    if (old && old !== next) {
      if (old === this.town?.stage) old.view.leave?.();
      else old.dispose();
    }
    next.scene.add(this.entities.group, this.drops.group);
    this.stage = next;
    this.key = key;
    this.room = world.room;
    if (this.settings) next.applySettings(this.settings);
    const view = next.view;
    this.framing = { view: view.view, bounds: view.bounds };
    this.rig.frame(this.framing);
    this.rig.setAspect(this.w / this.h);
    // The walls as this camera wants them before the room is first seen: no lowering or rising on the way in.
    easeWalls(10);
    view.tick(now / 1000, 10, this.rig.towardCamera());
    this.selfAt = null;
    if (roomChanged) {
      this.shops?.panel.close();
      this.shops?.panel.tip(null);
      this.placer.cancel();
    }
    if (roomChanged) {
      const calm = this.settings?.reduceMotion ?? false;
      this.overlay.snapFade(calm ? 0 : 1);
      if (calm || this.drawn.has(next)) this.overlay.fadeTowards(0, calm ? 0 : FADE_IN_MS, now);
      else this.hold(next, now);
    }
    this.stats.builds++;
    this.stats.lastBuildMs = performance.now() - t0;
    if (roomChanged) {
      this.since = now;
      this.warmed = "";
      const near = roomsNextTo(world.room);
      if (this.ahead && !near.includes(this.ahead.id)) this.dropAhead();
      for (const n of near) preloadRoom(n);
    }
    return true;
  }

  /**
   * Behind the veil, a room never drawn: its first frame's batching now and its shaders compiling off the main
   * thread, the veil opening only once they are in (`frame`). If the town isn't built (the page opened indoors, or
   * its houses changed), it is built here too, under the same veil: every way out ends there, and building it on the
   * frame its door is taken is the longest freeze in the game.
   */
  private hold(stage: RoomStage, now: number): void {
    this.reveal = { since: now, pending: 0, town: world.room !== "town" };
    this.compiling(this.warmNow(stage));
    void prepareRoom("town").catch(() => {});
    this.townBehindVeil();
  }

  /** One more compile the veil waits for. */
  private compiling(done: Promise<unknown>): void {
    const reveal = this.reveal;
    if (!reveal) return;
    reveal.pending++;
    void done.then(() => {
      reveal.pending--;
    });
  }

  /** While the veil is shut on a room that isn't the town: the town built (and compiling) too, if it isn't kept. */
  private townBehindVeil(): void {
    if (!this.reveal?.town || !this.settings || !roomReady("town")) return;
    this.reveal.town = false;
    const key = this.townIdentity();
    if (this.town?.key === key) return;
    const town = new RoomStage(buildRoom("town", { ...this.ctx(), map: mapOf("town") }), this.hooks);
    town.applySettings(this.settings);
    if (this.town && this.town.stage !== this.stage) this.town.stage.dispose();
    this.town = { stage: town, key };
    this.compiling(this.warmNow(town));
    // Its textures and the one draw ahead are left to `warmAhead`'s last steps.
    this.warming = { stage: town, textures: texturesOf(town.scene), compiled: true };
  }

  /** A stage's first-frame CPU work now, and its shaders compiling in parallel; resolves when they are linked. */
  private warmNow(stage: RoomStage): Promise<unknown> {
    this.pipe.prepare(stage.scene);
    stage.fx?.rescan();
    return this.pipe.renderer.compileAsync(stage.scene, this.rig.camera).catch(() => {});
  }

  /** Whether the room for `key` is already built (the kept town, or the one built ahead). */
  private aheadFor(key: string): boolean {
    if (world.room === "town") return this.town?.key === key;
    return this.ahead?.id === world.room && this.ahead.map === world.map;
  }

  private dropAhead(): void {
    this.ahead?.stage.dispose();
    this.ahead = null;
  }

  /**
   * In a quiet moment after arriving, builds the room one door away that is worth it (the town, the Tavern) and
   * starts its shaders compiling in parallel with the page, so taking the door doesn't build and compile on the
   * frame it opens. One step a frame, once per room.
   */
  private warmAhead(now: number): void {
    if (this.warming) {
      // Batching is the heavy step and waits for you to stand still; texture uploads are small enough to go on meanwhile.
      const w = this.warming;
      if (!w.draw && (now - this.stillSince > STILL_MS || (w.textures && w.compiled))) this.finishAhead();
      return;
    }
    if (!this.settings || !this.stage || this.warmed === this.room || world.portalPending) return;
    if (now - this.since < WARM_AFTER_MS || now - this.stillSince < STILL_MS || this.stats.lastGap > 40)
      return;
    const id = roomsNextTo(world.room).find((k) => WARM_KINDS.includes(k) && roomReady(k));
    this.warmed = this.room;
    if (!id) return;
    let stage: RoomStage;
    if (id === "town") {
      const key = this.townIdentity();
      if (this.town?.key === key) return;
      stage = new RoomStage(buildRoom("town", { ...this.ctx(), map: mapOf("town") }), this.hooks);
      if (this.town && this.town.stage !== this.stage) this.town.stage.dispose();
      this.town = { stage, key };
    } else {
      const map = mapOf(id as never);
      if (this.ahead?.id === id && this.ahead.map === map) return;
      this.dropAhead();
      stage = new RoomStage(buildRoom(id as never, { ...this.ctx(), map }), this.hooks);
      this.ahead = { id, map, stage };
    }
    stage.applySettings(this.settings);
    this.warming = { stage, textures: null, compiled: false };
  }

  /**
   * The rest of warming, one small step a frame so none is a hitch: batching, then the shaders (compiled off the
   * main thread), then the textures (a Tavern's are thirty-odd uploads) a few at a time.
   */
  private finishAhead(): void {
    const w = this.warming;
    if (!w) return;
    if (w.stage !== this.ahead?.stage && w.stage !== this.town?.stage) {
      this.warming = null;
      return;
    }
    if (!w.textures) {
      this.pipe.prepare(w.stage.scene);
      w.stage.fx?.rescan();
      w.textures = [];
      return;
    }
    if (!w.compiled) {
      w.compiled = true;
      w.textures = texturesOf(w.stage.scene);
      this.pipe.renderer.compileAsync(w.stage.scene, this.rig.camera).catch(() => {});
      return;
    }
    const start = performance.now();
    for (let i = 0; i < TEXTURES_PER_FRAME && w.textures.length; i++) {
      this.pipe.renderer.initTexture(w.textures.shift()!);
      if (performance.now() - start >= 3) break;
    }
    if (!w.textures.length) w.draw = true;
  }

  /**
   * The last warming step: draws the room once into the picture buffer, so the frame it is first shown on has its
   * geometry on the GPU and every shader linked (the compile above misses the shadow and ambient passes). It runs
   * just before the real frame, which draws over it, so it is never shown.
   */
  private drawAhead(): void {
    const w = this.warming;
    if (!w?.draw) return;
    this.warming = null;
    this.drawn.add(w.stage);
    const b = w.stage.view.bounds;
    const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.8;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const aspect = this.w / this.h;
    const cam = new THREE.OrthographicCamera(-r * aspect, r * aspect, r, -r, 0.1, 400);
    cam.position.set(cx + r, r * 1.2, cz + r);
    cam.lookAt(cx, 0, cz);
    cam.updateMatrixWorld();
    lightPipeline(this.pipe, w.stage, 0);
    this.pipe.render(w.stage.scene, cam, this.w, this.h);
  }

  // MARK: Frame

  frame(now: number): void {
    const started = performance.now();
    this.pipe.renderer.info.reset();
    const dt = this.last ? Math.min(100, Math.max(0.1, now - this.last)) : 16;
    this.last = now;
    if (!this.ensureStage(now)) {
      this.waiting(now);
      return;
    }
    // A new room's shaders still compiling (or the town still to build): the veil stays shut a moment longer.
    if (this.reveal) this.townBehindVeil();
    if (this.reveal && (this.reveal.pending || this.reveal.town) && now - this.reveal.since < REVEAL_MAX_MS) {
      this.overlay.stepFade(now);
      return;
    }
    const stage = this.stage!;
    const view = stage.view;
    const t = now / 1000;
    const calm = this.settings?.reduceMotion ?? false;

    // The camera: on you, off the room's edges, a pan easing back once you walk on.
    const me = this.entities.positionOf(world.selfId) ?? this.spotOf(view);
    const focus = me ?? [
      (view.bounds.minX + view.bounds.maxX) / 2,
      (view.bounds.minZ + view.bounds.maxZ) / 2,
    ];
    if (
      this.rig.panned() &&
      me &&
      this.selfAt &&
      Math.hypot(me[0] - this.selfAt[0], me[1] - this.selfAt[1]) > 0.7
    )
      this.rig.easePan(dt);
    if (!this.rig.panned() || !this.selfAt) this.selfAt = me ? [me[0], me[1]] : null;
    const mine = world.avatars.get(world.selfId);
    // Shops' interiors are built ahead a slice a frame, but not while the town is still settling in, nor on a frame
    // that was already slow: a slice on top of either is a stutter right outside the door.
    if (
      mine &&
      world.room === "town" &&
      !world.portalPending &&
      now - this.since > WARM_AFTER_MS &&
      this.stats.lastGap < 40
    )
      warmNearShops(world.map, mine.x, mine.y);
    if (this.insetSeen !== hudInset.version) {
      this.insetSeen = hudInset.version;
      this.applyInsets();
    }
    if (!me || !this.stillAt || Math.hypot(me[0] - this.stillAt[0], me[1] - this.stillAt[1]) > 0.05) {
      this.stillAt = me ? [me[0], me[1]] : null;
      this.stillSince = now;
    }
    this.rig.update(calm ? 1000 : dt, focus[0], focus[1]);
    const camera = this.rig.camera;
    camera.updateMatrixWorld();

    // The fade over a door: close it when the server is moving us, open it in the new room (ensureStage).
    // A new room's first frame is drawn under the veil (linking what the compile missed); it opens from the next.
    if (this.reveal) this.overlay.snapFade(1);
    else if (world.portalPending && !calm) this.overlay.fadeTowards(1, FADE_OUT_MS, now);
    else if (this.overlay.faded > 0 && !world.portalPending)
      this.overlay.fadeTowards(0, calm ? 0 : FADE_IN_MS, now);
    this.overlay.stepFade(now);
    const reveal = hoverStrength(now);
    this.overlay.focusAt(
      this.labelsAll ? null : me,
      reveal > 0 ? view.toWorld(hover.x, hover.y) : null,
      reveal,
    );

    const before = this.entities.size;
    const e0 = performance.now();
    try {
      this.entities.update(now, dt, view, camera);
      this.signs.update(view, camera);
      this.drops.update(view, t);
      view.frame?.({
        now,
        t,
        dt: dt / 1000,
        camera,
        overlay: this.overlay,
        me,
        calm,
        density: this.settings?.weather ?? 1,
      });
    } catch (e) {
      // A bad look or label shouldn't take the whole picture down; say so once in a while.
      if (this.errored++ % 300 === 0) console.error("3D entities:", e);
    }
    this.stats.entityMs += (performance.now() - e0 - this.stats.entityMs) * 0.05;
    if (this.entities.size !== before || this.entities.dirty || this.drops.dirty)
      this.entities.dirty = this.drops.dirty = false;

    const dark = stage.update(dt / 1000, t, this.rig.focus, this.rig.viewShown, camera);
    // Under the veil (a room's first frame, after its batching probe turned the walls every way): settle them.
    easeWalls(this.reveal ? 10 : dt / 1000);
    view.tick(t, dt / 1000, this.rig.towardCamera());
    lightPipeline(this.pipe, stage, dark);
    this.seeSelf(me, camera, dt / 1000, calm);
    // The town built behind this veil: its textures and one draw now too, while nothing shows, so the first frame
    // outside links no shaders (the compile misses the shadow and blocky passes, and they are most of it).
    const w = this.warming;
    if (this.reveal && w && w.stage === this.town?.stage && w.stage !== stage) {
      for (const tex of w.textures ?? []) this.pipe.renderer.initTexture(tex);
      Object.assign(w, { textures: [], compiled: true, draw: true });
    }
    if (this.warming?.draw && (this.reveal || now - this.stillSince > STILL_MS)) this.drawAhead();
    lightPipeline(this.pipe, stage, dark);
    this.pipe.render(stage.scene, camera, this.w, this.h);
    this.drawn.add(stage);
    this.reveal = null;
    this.stats.frames++;
    this.stats.lastGap = dt;
    this.warmAhead(now);
    this.stats.cpuMs += (performance.now() - started - this.stats.cpuMs) * 0.05;
  }

  /** While a room's code is on its way: the last room, frozen, under a closing veil. */
  private waiting(now: number): void {
    const stage = this.stage;
    this.overlay.fadeTowards(1, this.settings?.reduceMotion ? 0 : FADE_OUT_MS, now);
    this.overlay.stepFade(now);
    if (!stage) return;
    stage.update(0, now / 1000, this.rig.focus, this.rig.viewShown, this.rig.camera);
    this.pipe.render(stage.scene, this.rig.camera, this.w, this.h);
  }

  /** Where you stand in the room's units, from the game state: before your body has been drawn (a new room). */
  private spotOf(view: RoomView): [number, number] | null {
    const a = world.avatars.get(world.selfId);
    return a ? view.toWorld(a.x, a.y) : null;
  }

  /** Where the ring that cuts trees and roofs away round you is, in render pixels. */
  private seeSelf(
    me: [number, number] | null | undefined,
    camera: THREE.OrthographicCamera,
    dt: number,
    calm: boolean,
  ): void {
    if (!me) {
      SEE.value.w = 0;
      return;
    }
    const at = new THREE.Vector3(me[0], 0.9, me[1]);
    const reveal = this.stage!.occlusion.update(at, camera, dt, calm);
    const depth = -at.clone().applyMatrix4(camera.matrixWorldInverse).z;
    at.project(camera);
    const ratio = this.pipe.renderer.getPixelRatio();
    SEE.value.set(
      (at.x * 0.5 + 0.5) * this.w * ratio,
      (at.y * 0.5 + 0.5) * this.h * ratio,
      depth,
      (this.h / this.rig.viewShown) * 0.95 * ratio * Math.sqrt(reveal),
    );
  }

  private insetSeen = -1;

  private applyInsets(): void {
    const i = hudInset;
    this.rig.setInsets(i.left, i.top, i.right, i.bottom, this.w, this.h);
  }

  resize(w: number, h: number, _dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.overlay.resize(this.w, this.h);
    this.rig.setAspect(this.w / this.h);
    this.applyInsets();
    if (this.settings) this.setQuality(this.settings);
  }

  setQuality(s: GraphicsSettings): void {
    this.settings = s;
    this.labelsAll = s.labels === "all";
    this.entities.calm = s.reduceMotion;
    this.entities.maxBursts = burstCap(s.weather);
    this.entities.maxTags = tagCap(s.tier);
    applyGraphics(this.pipe, s);
    // Medium builds lean rooms (plain boxes, fewer segments); a change of tier rebuilds what is built.
    const detail = s.tier === "medium" ? 0 : 1;
    if (detail !== this.detail) {
      const changed = this.detail !== null;
      this.detail = detail;
      setGeometryDetail(detail);
      if (changed) {
        if (this.town && this.town.stage !== this.stage) this.town.stage.dispose();
        this.town = null;
        this.key = "";
      }
    }
    this.stage?.applySettings(s);
    this.town?.stage.applySettings(s);
  }

  // MARK: Shops

  /** What the buy panel needs of this world (`render3d/shops`). */
  private readonly shopWorld: ShopWorld = {
    previewLook: (look) => this.entities.previewLook(look),
    renderStyle: () => ({
      style: this.pipe.style === "voxel" ? "voxel" : "classic",
      pixelSize: this.pipe.pixelSize,
      night: this.pipe.night > 0.5,
    }),
    startPlacement: (itemId, company) => this.startPlacement(itemId, company),
    applyDecor: (d) => this.applyDecor(d),
  };

  /** The display nearest a point of the window, within a few finger widths. */
  private shelfAt(clientX: number, clientY: number): { shop: ShopId; display: ShopDisplay } | null {
    const room = this.stage?.view.shop;
    if (!room) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector3();
    let best: ShopDisplay | null = null;
    let bestD = 30;
    for (const d of room.displays) {
      p.set(d.pos.x + SHOP_INSET[0], d.pos.y, d.pos.z + SHOP_INSET[1]).project(this.rig.camera);
      const dist = Math.hypot(
        ((p.x + 1) / 2) * r.width + r.left - clientX,
        ((1 - p.y) / 2) * r.height + r.top - clientY,
      );
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best ? { shop: room.id, display: best } : null;
  }

  /** E on a display tile of the map: the buy panel on the first thing sold there. */
  private openShelf(x: number, y: number): boolean {
    const room = this.stage?.view.shop;
    const d = room?.displays.find((q) => q.tile[0] + SHOP_INSET[0] === x && q.tile[1] + SHOP_INSET[1] === y);
    if (!room || !d || !this.shops) return false;
    this.shops.open(room.id, d.item);
    return true;
  }

  /** Clicks on shelves, the price tip and the placement ghost: in the capture phase, before the game's own walking. */
  private bindShopping(): void {
    const click = (e: MouseEvent) => {
      if (hud.get().panel) return;
      const hit = this.shelfAt(e.clientX, e.clientY);
      if (!hit || !this.shops) return;
      e.stopImmediatePropagation();
      this.shops.open(hit.shop, hit.display.item);
    };
    const move = (e: PointerEvent) => {
      if (!this.shops) return;
      const near = this.stage?.view.shop && !ghost.mode ? this.shelfAt(e.clientX, e.clientY) : null;
      const it = near?.display.item;
      this.shops.panel.tip(
        it ? `${it.name}${it.price ? ` · 🪙 ${it.price}` : ""}` : null,
        e.clientX,
        e.clientY,
      );
    };
    this.canvas.addEventListener("click", click, true);
    this.canvas.addEventListener("pointermove", move);
    this.off.push(() => {
      this.canvas.removeEventListener("click", click, true);
      this.canvas.removeEventListener("pointermove", move);
    });
  }

  // MARK: Placing furniture

  /** The Office placement mode for `itemId` (`game/furniture.ts`); it takes you to your Office first if you are elsewhere. */
  private startPlacement(itemId: string, company = false): boolean {
    if (!this.stage) return false;
    this.shops?.panel.close();
    return startPlace(itemId, company);
  }

  /** The furniture ghost (`game/furniture.ts` decides, this shows): the piece over its tile, green where it fits. */
  private showGhost(g: { item: string; tile: Tile | null; fits: boolean; rot: Rot } | null): void {
    const stage = this.stage;
    if (!g || !stage) return void this.placer.cancel();
    if (this.placer.itemId !== g.item && !this.placer.begin(g.item, stage.scene)) return;
    this.placer.aim(stage.view, g.tile, g.fits, g.rot);
  }

  // MARK: Picking

  /**
   * The tile under a point in the window. A person is their own tile; a prop that stands on a tile you can't
   * walk on (a desk, a door, a house) is that tile; otherwise the floor point under the click.
   */
  pick(clientX: number, clientY: number): Tile | null {
    const stage = this.stage;
    if (!stage) return null;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -(((clientY - r.top) / r.height) * 2 - 1),
    );
    this.caster.setFromCamera(ndc, this.rig.camera);
    const ray = this.caster.ray;
    const who = this.entities.pick(ray);
    const person = who === null ? undefined : world.avatars.get(who);
    if (person) return { x: person.x, y: person.y };
    const { floor, prop } = castAt(ray, stage.view.group, this.caster);
    const view = stage.view;
    if (prop) {
      const [x, y] = view.toTile(prop.x, prop.z);
      if (world.map.contains(x, y) && !world.map.walkable(x, y)) return { x, y };
    }
    if (!floor) return null;
    const [x, y] = view.toTile(floor.x, floor.z);
    return { x, y };
  }

  // MARK: Debug

  /** The window position of a tile's middle (for tests that click on tiles). */
  screenOf(tx: number, ty: number, y = 0.2): [number, number] | null {
    const view = this.stage?.view;
    if (!view) return null;
    const [x, z] = view.toWorld(tx, ty);
    const [sx, sy] = this.overlay.project(new THREE.Vector3(x, y, z), this.rig.camera);
    const r = this.canvas.getBoundingClientRect();
    return [r.left + sx, r.top + sy];
  }

  readonly world = world;
  readonly hud = hud;

  /** Where a shelf of the shop you are in is in the window, by item id (tests); the first one without an id. */
  shelfScreen(itemId?: string): { id: string; name: string; price: number; at: [number, number] } | null {
    const d = this.stage?.view.shop?.displays.find((q) => !itemId || q.item.id === itemId);
    if (!d) return null;
    const p = new THREE.Vector3(d.pos.x + SHOP_INSET[0], d.pos.y, d.pos.z + SHOP_INSET[1]).project(
      this.rig.camera,
    );
    const r = this.canvas.getBoundingClientRect();
    return {
      id: d.item.id,
      name: d.item.name,
      price: d.item.price,
      at: [((p.x + 1) / 2) * r.width + r.left, ((1 - p.y) / 2) * r.height + r.top],
    };
  }

  /** Goes to your own Office from anywhere, as the card's button does (tests). */
  visitOffice(): void {
    send(conn.visit(world.selfId));
  }

  /** Walks to a tile of the room as a click would (tests). */
  go(x: number, y: number): void {
    walkTo(x, y);
  }

  /** Shows room `id` from its core map without moving anyone (screenshots and tests); the next snapshot undoes it. */
  debugRoom(id: string): void {
    world.room = id as never;
    world.map = mapOf(id as never);
    world.avatars.clear();
  }

  /** Seats `n` made-up raiders at the war desks (screenshots and measuring a full dungeon); the next real list undoes it. */
  debugRaiders(n: number): void {
    const look = world.avatars.get(world.selfId)?.info.look;
    if (!look) return;
    const top = Array.from({ length: n }, (_, i) => ({
      id: -1000 - i,
      name: `raider${i + 1}`,
      look: { ...look, hair: i % 8, outfit: i % 12, skin: i % 5 },
      agents: 1 + (i % 6),
      burn: 1e5 * (1 + (i % 7)) * (i % 3 === 0 ? 0 : 1),
    }));
    setRaiders({ top, more: 0 });
  }

  /** Counts of what is on the GPU now (see `__r3d.gpu()` in the console). */
  gpu() {
    return gpuNow(this.pipe.renderer);
  }

  /**
   * Builds and frees every room `n` times over, for leak checks: the GPU counts after should equal those
   * before. Builds from the core maps, so it needs no server moves.
   */
  cycle(
    n: number,
    rooms: string[] = ["town", "hq", "inn", "upstairs", "basement", "dungeon", "office"],
  ): {
    before: ReturnType<typeof gpuNow>;
    after: ReturnType<typeof gpuNow>;
  } {
    const warm = () => {
      for (const id of rooms) {
        const s = new RoomStage(
          buildRoom(id as never, { ...this.ctx(), map: mapOf(id as never) }),
          this.hooks,
        );
        // Draw all of it once (nothing is uploaded until it is drawn), so freeing it is a real test.
        s.scene.traverse((o) => {
          o.frustumCulled = false;
        });
        this.rig.frame({ view: s.view.view, bounds: s.view.bounds });
        this.rig.update(16, s.view.bounds.maxX / 2, s.view.bounds.maxZ / 2, true);
        this.pipe.render(s.scene, this.rig.camera, this.w, this.h);
        s.dispose();
      }
    };
    warm();
    this.pipe.renderer.renderLists.dispose();
    const before = this.gpu();
    for (let i = 0; i < n; i++) warm();
    const after = this.gpu();
    // The live room's camera was borrowed.
    if (this.framing) this.rig.frame(this.framing);
    return { before, after };
  }

  dispose(): void {
    dropWarmedShops();
    for (const f of this.off) f();
    // Only our own hooks: a renderer that replaced us may have mounted before we were disposed.
    if (this.hooks3d && viewHooks.zoom === this.hooks3d.zoom) {
      delete viewHooks.zoom;
      delete viewHooks.rotate;
      delete viewHooks.key;
      delete viewHooks.shop;
      delete viewHooks.toss;
      delete viewHooks.ghost;
    }
    this.placer.cancel();
    this.shops?.dispose();
    this.shops = null;
    this.signs.dispose();
    this.entities.dispose();
    this.drops.dispose();
    if (this.stage && this.stage !== this.town?.stage) this.stage.dispose();
    this.town?.stage.dispose();
    this.dropAhead();
    this.stage = null;
    this.town = null;
    this.overlay.dispose();
    // Give the GPU context back now: browsers allow only a handful at once, and tiers can be switched often.
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.pipe.dispose();
    this.pipe.renderer.forceContextLoss();
    this.canvas.remove();
    if ((window as unknown as { __r3d?: unknown }).__r3d === this)
      delete (window as unknown as { __r3d?: unknown }).__r3d;
  }
}
