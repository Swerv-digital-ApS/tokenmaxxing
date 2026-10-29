import { COP_ID } from "@tokenmaxxing/core/cop.ts";
import { auraOf } from "@tokenmaxxing/core/dances.ts";
import { LEGENDARY_LEVEL } from "@tokenmaxxing/core/milestones.ts";
import { SNEEZE_MS } from "@tokenmaxxing/core/sky.ts";
import { hasPolse } from "@tokenmaxxing/core/street.ts";
import { hasSpecial, specialBuff } from "@tokenmaxxing/core/tavern.ts";
import { cupsLeft, JUMP_MS, ownerOfOffice, TILE } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { merchKey, merchVersion } from "../../art/merch.ts";
import { PET_H, PET_W } from "../../art/pets.ts";
import { type Chill, chillOf, SNEEZE_TEXT, sneezeJolt, sneezeOf, wearsScarf } from "../../game/cold.ts";
import { battlers, danceOf } from "../../game/dance.ts";
import { BURST_MS } from "../../game/emoji.ts";
import { LABEL_FAR } from "../../game/near.ts";
import { followPet, prunePets, reactionOf } from "../../game/pets.ts";
import { type Lap, racing } from "../../game/race.ts";
import { raidPet, seatedAt } from "../../game/raidseat.ts";
import { weatherNow } from "../../game/sky.ts";
import { jitter, tremorPhase } from "../../game/tremor.ts";
import {
  drawPos,
  type Avatar as GameAvatar,
  gamesOf,
  gameTag,
  stepping,
  WARP_MS,
  world,
} from "../../game/world.ts";
import { town } from "../../net.ts";
import { hud } from "../../store.ts";
import { RAID_SEAT_Y } from "../dungeon/raidfx.ts";
import { declutterTags } from "../engine/declutter.ts";
import { disposeObject } from "../engine/dispose.ts";
import { Burst, type Overlay } from "../engine/overlay.ts";
import { Model } from "../kit/kit.ts";
import { type Pet3D, petFrom2D } from "../pets/pets3d.ts";
import type { RoomView } from "../rooms/rooms.ts";
import { Breath, neckOf, scarf } from "../town/cold3d.ts";
import { STOOL_Y, seatPose } from "../town/gamefx.ts";
import { CopWatch, ShowcaseCache } from "../town/world-logic.ts";
import { Aura } from "./aura3d.ts";
import { Avatar as Avatar3D } from "./avatar.ts";
import { CopGear } from "./cop3d.ts";
import { type Look2D, lookFrom2D, nameTag, tagLift, wornBy } from "./gear3d.ts";
import { approach, crowdOffset, hopHeight, poseOf, turnToward, YAW } from "./motion.ts";

const NONE: ReadonlySet<number> = new Set();
/** Pets are drawn a little bigger than life so they read from the iso camera. */
const PET_SCALE = 1.25;
/** How high a full hop lifts a pet, in world units (a person's own hop is 0.44). */
const PLAY_LIFT = 0.4;
/** Tiles within which other players' pets show their names. */
const NAME_RANGE = LABEL_FAR;
/** A step that has stopped keeps the walk going this long, so a gap between two steps doesn't flicker. */
const WALK_HOLD_MS = 140;

interface Rig {
  id: number;
  info: GameAvatar["info"];
  sig: string;
  /** The try-on `sig` was worked out with: with `info`, what the look is made from. */
  fitting: Look2D | null;
  /** The companies' merch (`merchVersion`) `sig` was worked out with: a new print redresses whoever wears it. */
  merch: number;
  /** `info`, the try-on or the companies changed this frame: the signatures below are worked out again, otherwise reused. */
  changed: boolean;
  avatar: Avatar3D;
  root: THREE.Group;
  /** Where they are drawn, in world units. */
  x: number;
  z: number;
  yaw: number;
  placed: boolean;
  walkUntil: number;
  /** Where the game says they are this frame, in tiles (a race's lap, else the step between two tiles). */
  at: { x: number; y: number };
  seen: number;
  bedroll: Model | null;
  halo: THREE.Mesh | null;
  /** The cold (`town/cold3d.ts`): where their neck is (-1 until measured), their breath and, on a bot, a scarf. */
  neck: number;
  breath: Breath | null;
  scarf: Model | null;
  /** How far into a sneeze they are this frame (0..1), or null. */
  sneeze: number | null;
  /** An aura dance's aura, while they do one. */
  aura: Aura | null;
  /** Officer 429 only: his light bar and notepad, and what his lines say he is doing. */
  cop: { gear: CopGear; watch: CopWatch } | null;
  /** Where a Sprint Race has them (laps of the square) this frame, when it has. */
  lap: Lap | null;
  pet: {
    model: Pet3D;
    root: THREE.Group;
    sig: string;
    x: number;
    z: number;
    yaw: number;
    moving: boolean;
    placed: boolean;
  } | null;
  // Labels
  stack: HTMLDivElement;
  tag: HTMLElement | null;
  tagKey: string;
  /** The `tagKey` the tag on screen was made for. */
  tagMade: string;
  /** What `tagKey` was made from (info, company, showcase pins), compared by identity. */
  tagFrom: [unknown, unknown, unknown];
  /** The tag is on screen this frame. */
  tagOn: boolean;
  // The name-tag pass (declutter.ts)
  tx: number;
  ty: number;
  tdist: number;
  tshift: number;
  talpha: number;
  thide: boolean;
  /** What the tag shows now, so unchanged frames write nothing. */
  tagShown: { hide: boolean; alpha: number };
  bubble: HTMLDivElement;
  bubbleText: string;
  pills: {
    polse: HTMLDivElement;
    battle: HTMLDivElement;
    game: HTMLDivElement;
    work: HTMLDivElement;
    zzz: HTMLDivElement;
  };
  petLabel: HTMLDivElement | null;
  burst: Burst | null;
  /** The hearts (or treats, or stars) of my pet's reaction (`petPlay`), rising from the pet. */
  petBurst: Burst | null;
}

/** Shows `text` in `el`, or hides it for null; writes the DOM only when that changes. */
function show(el: HTMLElement, text: string | null): void {
  if (text === null) {
    if (el.style.display !== "none") el.style.display = "none";
    return;
  }
  if (el.style.display === "none") el.style.display = "";
  if (el.textContent !== text) el.textContent = text;
}

const lookSig = (info: GameAvatar["info"], look: GameAvatar["info"]["look"] = info.look): string =>
  `${JSON.stringify(look)}|${info.level >= LEGENDARY_LEVEL}|${info.id === COP_ID}|${look.merch && look.merchWorn ? merchKey(look.merch) : ""}`;

/** Everyone in the room: their voxel bodies, pets and the labels over them, keyed by player id. */
export class Entities {
  readonly group = new THREE.Group();
  private readonly rigs = new Map<number, Rig>();
  private frame = 0;
  /** New meshes were added (a person, a pet): the renderer swaps them for blocks. */
  dirty = false;
  /** A try-on: the look shown on the local player in place of their saved one (the shops' fitting room). */
  private fitting: Look2D | null = null;
  /** Reduce motion: the siren glows steadily. */
  calm = false;
  /** Most emoji bursts at once, from the tier (each is ten DOM nodes). */
  maxBursts = 10;
  /** Most name tags at once, from the tier. */
  maxTags = 12;
  private readonly tagged: Rig[] = [];
  /** Who is in an aura battle this frame (`battlers`). */
  private fights: ReadonlySet<number> = NONE;
  private bursts = 0;
  /** What the cold does to people this frame: outdoors only. */
  private chill: Chill | null = null;
  /** Bots whose bodies the room draws itself. */
  private keepers: ReadonlySet<number> = new Set();
  private readonly v = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  /** Showcase pins of those near me, for the chips on their name tags (asked a few at a time). */
  private readonly showcase = new ShowcaseCache({
    fetch: (id) => town.profile(id, "today").then((p) => p.showcase ?? []),
  });

  constructor(private readonly overlay: Overlay) {
    this.group.name = "entities";
  }

  /** Shows `look` on the local player for now; null puts the saved one back. */
  previewLook(look: Look2D | null): void {
    this.fitting = look;
  }

  /** What `info` is drawn wearing: their look, or the try-on if it is the local player. */
  private lookOf(info: GameAvatar["info"]): GameAvatar["info"]["look"] {
    return this.fitting && info.id === world.selfId ? { ...info.look, ...this.fitting } : info.look;
  }

  get size(): number {
    return this.rigs.size;
  }

  /** The player ids drawn right now. */
  ids(): number[] {
    return [...this.rigs.keys()];
  }

  /** Where someone is drawn (world x, z), if they are in the room. */
  positionOf(id: number): [number, number] | null {
    const r = this.rigs.get(id);
    return r ? [r.x, r.z] : null;
  }

  /** The player whose body the ray hits first, if any. */
  pick(ray: THREE.Ray): number | null {
    this.ray.ray.copy(ray);
    const roots: THREE.Object3D[] = [];
    for (const r of this.rigs.values()) if (r.root.visible) roots.push(r.avatar.root);
    const hit = this.ray.intersectObjects(roots, true)[0];
    if (!hit) return null;
    for (const r of this.rigs.values()) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o === r.avatar.root) return r.id;
    }
    return null;
  }

  private create(a: GameAvatar, view: RoomView): Rig {
    const look = lookFrom2D(this.lookOf(a.info), { level: a.info.level });
    if (a.info.id === COP_ID) look.job = "officer";
    const avatar = new Avatar3D(look, "voxel");
    this.dirty = true;
    const root = new THREE.Group();
    root.add(avatar.root);
    this.group.add(root);
    const stack = this.overlay.make("r3-stack");
    const bubble = document.createElement("div");
    bubble.className = "r3-bubble";
    bubble.style.display = "none";
    const pill = (cls: string) => {
      const el = document.createElement("div");
      el.className = `r3-pill ${cls}`;
      el.style.display = "none";
      return el;
    };
    const pills = {
      polse: pill(""),
      battle: pill("r3-battle"),
      game: pill("r3-game"),
      work: pill("r3-work"),
      zzz: pill("r3-zzz"),
    };
    pills.zzz.textContent = "z";
    stack.append(bubble, pills.polse, pills.battle, pills.game, pills.work, pills.zzz);
    const [x, z] = view.toWorld(a.x, a.y);
    return {
      id: a.info.id,
      info: a.info,
      sig: lookSig(a.info, this.lookOf(a.info)),
      fitting: this.fitting,
      merch: merchVersion(),
      changed: true,
      avatar,
      root,
      x,
      z,
      yaw: YAW[a.facing],
      placed: false,
      walkUntil: 0,
      at: { x: a.x, y: a.y },
      seen: 0,
      bedroll: null,
      halo: null,
      neck: -1,
      breath: null,
      scarf: null,
      sneeze: null,
      aura: null,
      cop: a.info.id === COP_ID ? { gear: new CopGear(avatar, root), watch: new CopWatch() } : null,
      lap: null,
      pet: null,
      stack,
      tag: null,
      tagKey: "",
      tagMade: "",
      tagFrom: [null, null, null],
      tagOn: false,
      tx: 0,
      ty: 0,
      tdist: 0,
      tshift: 0,
      talpha: 1,
      thide: false,
      tagShown: { hide: false, alpha: 1 },
      bubble,
      bubbleText: "",
      pills,
      petLabel: null,
      burst: null,
      petBurst: null,
    };
  }

  private remove(r: Rig): void {
    r.root.removeFromParent();
    disposeObject(r.root);
    // The pet's model hangs on the group beside the person, not on them: take it away too, or a rebuilt rig
    // (a new look, a stale one swept) leaves the old pet standing in the world.
    if (r.pet) {
      r.pet.root.removeFromParent();
      disposeObject(r.pet.root);
      r.pet = null;
    }
    r.stack.remove();
    r.petLabel?.remove();
    r.burst?.dispose();
    r.petBurst?.dispose();
    this.rigs.delete(r.id);
  }

  /** Throws everyone away (the room changed). */
  clear(): void {
    for (const r of [...this.rigs.values()]) this.remove(r);
    this.group.clear();
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }

  /** Brings the 3D people up to date with `world` for the frame at `now` (ms), `dt` ms after the last. */
  update(now: number, dt: number, view: RoomView, camera: THREE.OrthographicCamera): void {
    this.keepers = view.keepers ?? NONE;
    this.chill = view.outdoors ? chillOf(weatherNow()) : null;
    const frame = ++this.frame;
    const dtS = dt / 1000;
    const t = now / 1000;
    const me = world.avatars.get(world.selfId);
    const list: GameAvatar[] = [...world.avatars.values()];
    for (const l of world.leaving) if (!world.avatars.has(l.info.id)) list.push(l);
    prunePets();
    this.fights = battlers(list);
    this.bursts = 0;
    for (const r of this.rigs.values()) this.bursts += (r.burst ? 1 : 0) + (r.petBurst ? 1 : 0);
    // Who shares a tile (seats are one each, and the server keeps them so), in a fixed order: each gets a spot.
    const crowds = new Map<string, number[]>();
    for (const a of list) {
      if (world.map.kind(a.x, a.y).seat) continue;
      const key = `${a.x},${a.y}`;
      crowds.set(
        key,
        [...(crowds.get(key) ?? []), a.info.id].sort((p, q) => p - q),
      );
    }
    for (const a of list) {
      let r = this.rigs.get(a.info.id);
      // The server replaces `info` when it changes, so the look is only compared then (or for a try-on, or new merch).
      const changed = !!r && (r.info !== a.info || r.fitting !== this.fitting || r.merch !== merchVersion());
      if (r && changed && r.sig !== lookSig(a.info, this.lookOf(a.info))) {
        this.remove(r);
        r = undefined;
      }
      r ??= this.create(a, view);
      if (!this.rigs.has(r.id)) this.rigs.set(r.id, r);
      r.seen = frame;
      r.changed = changed;
      r.info = a.info;
      r.fitting = this.fitting;
      r.merch = merchVersion();
      const crowd = crowds.get(`${a.x},${a.y}`);
      const spread = crowd ? crowdOffset(crowd.indexOf(a.info.id), crowd.length) : ([0, 0] as const);
      this.step(r, a, me, view, camera, now, dt, dtS, t, spread);
    }
    for (const r of [...this.rigs.values()]) if (r.seen !== frame) this.remove(r);
    this.declutter();
  }

  /** Breath in the cold (not asleep or at a desk), and a scarf on a bot, at their neck as their pose has it now. */
  private cold(r: Rig, a: GameAvatar, now: number, lying: boolean): void {
    const chill = this.chill;
    const up = !lying && a.state !== "away" && a.state !== "working";
    const breathes = !!chill && up && !a.warp && r.root.visible;
    const scarved = wearsScarf(a, chill) && up;
    if ((breathes || scarved) && r.neck < 0) r.neck = neckOf(r.root, r.avatar.body, r.avatar.head);
    const neck = r.neck + r.avatar.body.position.y;
    if (breathes && !r.breath) {
      r.breath = new Breath();
      r.root.add(r.breath.group);
    }
    if (r.breath) {
      if (breathes) r.breath.update(r.id, now, neck + 0.1);
      else r.breath.group.visible = false;
    }
    if (scarved && !r.scarf) {
      r.scarf = scarf(r.id);
      r.root.add(r.scarf);
    }
    if (r.scarf) {
      r.scarf.visible = scarved;
      r.scarf.position.y = neck;
    }
  }

  /** Tags that would cover each other stack up, the farthest fade, and a crowd shows only the nearest. */
  private declutter(): void {
    const tagged = this.tagged;
    let n = 0;
    for (const r of this.rigs.values()) {
      if (r.tag && r.tagOn) tagged[n++] = r;
    }
    tagged.length = n;
    declutterTags(tagged, n, this.maxTags);
    for (const r of tagged) {
      const tag = r.tag!;
      const shown = r.tagShown;
      if (shown.hide !== r.thide) {
        shown.hide = r.thide;
        tag.style.visibility = r.thide ? "hidden" : "";
      }
      const alpha = Math.round(r.talpha * 10) / 10;
      if (shown.alpha !== alpha) {
        shown.alpha = alpha;
        tag.style.opacity = alpha === 1 ? "" : String(alpha);
      }
      if (r.tshift > 0) this.overlay.lift(r.stack, r.tx, r.ty - r.tshift);
    }
  }

  private step(
    r: Rig,
    a: GameAvatar,
    me: GameAvatar | undefined,
    view: RoomView,
    camera: THREE.OrthographicCamera,
    now: number,
    dt: number,
    dtS: number,
    t: number,
    spread: readonly [number, number],
  ): void {
    const info = a.info;
    // Where they are: the 2D game's own step interpolation, eased so corners round off.
    // In a Sprint Race they run laps of the square instead of standing at their table.
    const lap = racing(info.id, now);
    r.lap = lap;
    // At your own war desk in the raid dungeon (`game/raidseat.ts`) you are drawn on the seat, typing.
    const sit = !lap && info.id === world.selfId ? seatedAt() : null;
    const p = lap ?? (sit ? { x: sit[0], y: sit[1] } : drawPos(a, now));
    r.at = p;
    const [cx, cz] = view.toWorld(p.x, p.y);
    // Off the tile's middle when someone else stands on it too (not while running laps).
    const [tx, tz] = lap ? [cx, cz] : [cx + spread[0], cz + spread[1]];
    const dx = tx - r.x;
    const dz = tz - r.z;
    // How far they came this frame, for the stride (a jump into place is not a step).
    let moved = 0;
    if (!r.placed || Math.hypot(dx, dz) > 3) {
      r.x = tx;
      r.z = tz;
      r.placed = true;
    } else {
      const [wasX, wasZ] = [r.x, r.z];
      r.x = approach(r.x, tx, dt, 45);
      r.z = approach(r.z, tz, dt, 45);
      moved = Math.hypot(r.x - wasX, r.z - wasZ);
    }
    const moving = (lap ? lap.running : stepping(a, now)) || Math.hypot(tx - r.x, tz - r.z) > 0.04;
    if (moving) r.walkUntil = now + WALK_HOLD_MS;
    const seatKind = lap ? undefined : world.map.kind(a.x, a.y).seat;
    const onSeat = !lap && (a.state === "sit" || a.state === "working");
    const placed = poseOf(
      { state: lap ? "idle" : a.state, dozing: info.dozing && !lap },
      onSeat ? seatKind : undefined,
      now < r.walkUntil,
    );
    const lying = placed.lying && !sit;
    // At a game table they sit on a stool, at an arena desk they type.
    const gamePose = a.state === "playing" ? seatPose(gamesOf(info.id)[0], lap !== null) : null;
    const pose = gamePose ?? (sit && !moving ? "type" : placed.pose);
    const av = r.avatar;
    // On the Tavern's stage while the jukebox plays: dance.
    const dancing =
      pose === "stand" &&
      world.room === "inn" &&
      world.map.at(a.x, a.y) === "e" &&
      hud.get().jukebox !== null;
    // Their own dance from the dance bar, on their feet and standing still.
    const dance = pose === "stand" && !lap ? danceOf(a) : undefined;
    av.pose = dancing || dance ? "dance" : pose;
    av.move = dance?.move ?? null;
    const hop = a.jump === null ? 0 : hopHeight((now - a.jump) / JUMP_MS);
    // Sitters and sleepers lie on their seat's height; everyone else on the floor.
    let y = 0;
    if (lying) y = seatKind === "bed" ? view.seatY(a.x, a.y, "bed") : 0.02;
    else if (gamePose) y = STOOL_Y;
    else if (sit && pose === "type") y = RAID_SEAT_Y;
    else if (pose === "sit" || pose === "type") y = seatKind ? view.seatY(a.x, a.y, seatKind) : 0.04;
    y += hop;
    let yawTarget = sit ? YAW.up : YAW[lap?.facing ?? a.facing];
    // A sitter faces where their seat is turned (the server only says "up" for a chair and "down" for the rest).
    if (pose === "sit" && !lying) yawTarget = view.seatYaw?.(a.x, a.y) ?? yawTarget;
    if (lying) yawTarget = 0;
    r.yaw = turnToward(r.yaw, yawTarget, dt, 70);

    // Coffee and the Tavern's special: a buzz, or a warm glow.
    const unow = Date.now();
    const special = hasSpecial(info.specialUntil ?? 0, unow) ? specialBuff(info.specialUntil ?? 0) : null;
    // A buzz off the clock (`tremor.ts`), the same at any frame rate: feet planted, the body vibrating over
    // them. The Tavern special's jitter counts as 1.5 cups.
    const cups = this.calm ? 0 : Math.max(cupsLeft(info.coffeeUntil, unow), special === "jitter" ? 1.5 : 0);
    const shake = cups > 0 ? jitter(cups, unow / 1000, tremorPhase(info.id)) : null;
    y += shake?.lift ?? 0;
    r.root.position.set(r.x, y, r.z);
    // A sneeze (pollen, `game/cold.ts`) tips the whole figure forward: their limbs may be frozen still.
    r.sneeze = sneezeOf(a);
    const sneeze = r.sneeze === null || this.calm ? 0 : sneezeJolt(r.sneeze) * 0.22;
    // Turned first, then tilted, so the tilt is the figure's own side to side and back and forth.
    r.root.rotation.set((shake?.pitch ?? 0) + sneeze, r.yaw, shake?.roll ?? 0, "YXZ");
    if (special === "glow") {
      if (!r.halo) {
        r.halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 16, 12),
          new THREE.MeshBasicMaterial({
            color: "#ffde78",
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        r.halo.position.y = 0.55;
        r.halo.userData.nopick = true;
        r.halo.userData.noBlock = true;
        r.root.add(r.halo);
      }
      r.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3.1));
    } else if (r.halo) {
      r.halo.removeFromParent();
      disposeObject(r.halo);
      r.halo = null;
    }
    // An aura dance farms its aura: it grows over the first half-minute (`auraOf`).
    if (dance?.aura) {
      r.aura ??= new Aura(r.root);
      r.aura.update(dance.aura, auraOf(info.danceSince ?? 0, unow), t, this.calm);
    } else if (r.aura) {
      r.aura.dispose();
      r.aura = null;
    }
    // Appearing and disappearing: a pop.
    let pop = 1;
    if (a.warp) {
      const k = Math.min(1, (now - a.warp.at) / WARP_MS);
      pop = Math.max(0.01, a.warp.out ? 1 - k : k);
    }
    r.root.scale.setScalar(pop);

    // A sleeping bag on the floor for anyone who dozes off away from a bed.
    const bag = a.state === "away" && seatKind !== "bed" && !sit;
    if (bag && !r.bedroll) {
      r.bedroll = new Model();
      r.bedroll.box([0.7, 0.05, 1.75], "#4a4452", [0, 0, 0.05], 0.02);
      r.bedroll.box([0.6, 0.03, 1.6], "#6b5a8a", [0, 0.05, 0.05], 0.015);
      r.bedroll.userData.nopick = true;
      r.root.add(r.bedroll);
    } else if (!bag && r.bedroll) {
      r.bedroll.removeFromParent();
      disposeObject(r.bedroll);
      r.bedroll = null;
    }

    // Off screen: positions keep up, but nothing is posed or labelled.
    this.v.set(r.x, 1, r.z).project(camera);
    const near = Math.abs(this.v.x) < 1.35 && Math.abs(this.v.y) < 1.35;
    r.root.visible = near && !this.keepers.has(r.id);
    const bubbleOn = a.bubble !== null && now < a.bubble.until;
    av.talking = bubbleOn;
    if (near) av.update(dtS, t, moved);
    this.cold(r, a, now, lying || pose === "sleep");
    if (r.cop)
      r.cop.gear.update(r.cop.watch.read(bubbleOn && a.bubble ? a.bubble.text : "", now), now, this.calm);

    this.pet(r, a, me, view, camera, dt, t, now, near);
    const close = !me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE;
    this.labels(r, a, camera, now, near, close, bubbleOn, pose, y, me);
  }

  private pet(
    r: Rig,
    a: GameAvatar,
    me: GameAvatar | undefined,
    view: RoomView,
    camera: THREE.OrthographicCamera,
    dt: number,
    t: number,
    now: number,
    near: boolean,
  ): void {
    const look = this.lookOf(a.info);
    const mine = a.info.id === world.selfId;
    if (!look.pet || a.warp) {
      if (mine) raidPet.at = null;
      if (r.pet) {
        r.pet.root.removeFromParent();
        disposeObject(r.pet.root);
        r.pet = null;
      }
      return;
    }
    const sig =
      r.pet && !r.changed
        ? r.pet.sig
        : `${look.pet}|${look.petVariant}|${look.petName ?? ""}|${look.petwear}|${a.info.level >= LEGENDARY_LEVEL}`;
    if (r.pet && r.pet.sig !== sig) {
      r.pet.root.removeFromParent();
      disposeObject(r.pet.root);
      r.pet = null;
    }
    if (!r.pet) {
      const model = petFrom2D(look.pet, look.petVariant, look.petName ?? "");
      model.wear = look.petwear;
      model.crown = a.info.level >= LEGENDARY_LEVEL;
      const root = new THREE.Group();
      model.root.scale.setScalar(PET_SCALE);
      root.add(model.root);
      this.group.add(root);
      this.dirty = true;
      r.pet = { model, root, sig, x: r.x, z: r.z, yaw: 0, moving: false, placed: false };
    }
    const owner = ownerOfOffice(world.room);
    const bed = owner === a.info.id ? world.map.find("Q")[0] : undefined;
    const pos = r.at;
    const spot = followPet(a, pos.x * TILE, pos.y * TILE, dt, bed);
    if (!spot) return;
    // The 2D spot is the sprite's top-left in pixels; the 3D pet stands on its bottom middle.
    const [wx, wz] = view.toWorld((spot.x + PET_W / 2) / TILE - 0.5, (spot.y + PET_H) / TILE - 0.5);
    const pet = r.pet;
    const ddx = wx - pet.x;
    const ddz = wz - pet.z;
    let came = 0;
    if (!pet.placed) {
      pet.x = wx;
      pet.z = wz;
      pet.placed = true;
    } else {
      const [wasX, wasZ] = [pet.x, pet.z];
      pet.x = approach(pet.x, wx, dt, 60);
      pet.z = approach(pet.z, wz, dt, 60);
      came = Math.hypot(pet.x - wasX, pet.z - wasZ);
    }
    const speed = Math.hypot(ddx, ddz) / Math.max(dt / 1000, 0.001);
    const pm = spot.moving && !spot.asleep;
    pet.moving = pm;
    pet.model.moving = pm;
    if (pm && speed > 0.25) pet.yaw = turnToward(pet.yaw, Math.atan2(ddx, ddz), dt, 90);
    else if (!spot.asleep) pet.yaw = turnToward(pet.yaw, Math.atan2(r.x - pet.x, r.z - pet.z), dt, 220);
    pet.model.pose = spot.asleep ? "sleep" : a.state !== "idle" && !pm ? "sit" : "stand";
    // A reaction (`petPlay`): it hops, a trick turns it right round, and the legs go while it's off the ground.
    const play = spot.asleep || !near ? null : reactionOf(a.info.id, now);
    if (play && play.pose.lift > 0.25) pet.model.moving = true;
    pet.root.position.set(pet.x, (play?.pose.lift ?? 0) * PLAY_LIFT, pet.z);
    pet.root.rotation.y = pet.yaw + (play?.pose.spin ?? 0) * Math.PI * 2;
    // The raid's little missiles start where your pet stands (`DungeonLive`).
    if (mine) raidPet.at = [pet.x, pet.z];
    pet.root.visible = near;
    if (near) pet.model.update(t, came);
    // Its name, for mine and for those close to me.
    const name = look.petName;
    const close = !me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE;
    if (name && close && near) {
      if (!r.petLabel) {
        r.petLabel = this.overlay.make("r3-pet");
        r.petLabel.style.transform = "translate(-9999px, -9999px)";
      }
      if (r.petLabel.textContent !== name) r.petLabel.textContent = name;
      this.v.set(pet.x, 0.5, pet.z);
      this.overlay.place(r.petLabel, this.v, camera, 0, 14, true);
    } else if (r.petLabel) {
      r.petLabel.remove();
      r.petLabel = null;
    }
    // The emoji of its reaction rise from it. Past the tier's cap on bursts a new one waits.
    if (play) {
      if (!r.petBurst?.matches(play.emojis, play.at)) {
        r.petBurst?.dispose();
        r.petBurst = null;
        if (this.bursts < this.maxBursts) {
          r.petBurst = new Burst(this.overlay, play.emojis, play.at);
          this.bursts++;
        }
      }
      if (r.petBurst) {
        const [sx, sy] = this.overlay.project(this.v.set(pet.x, 0.6, pet.z), camera);
        if (!r.petBurst.step(now, sx, sy)) {
          r.petBurst.dispose();
          r.petBurst = null;
        }
      }
    } else if (r.petBurst) {
      r.petBurst.dispose();
      r.petBurst = null;
    }
  }

  private labels(
    r: Rig,
    a: GameAvatar,
    camera: THREE.OrthographicCamera,
    now: number,
    near: boolean,
    close: boolean,
    bubbleOn: boolean,
    pose: string,
    y: number,
    me: GameAvatar | undefined,
  ): void {
    const info = a.info;
    r.tagOn = false;
    if (!near || a.warp?.out) {
      if (r.stack.style.display !== "none") r.stack.style.display = "none";
      return;
    }
    const resting = a.state === "away";
    // The name tag: name, level, rarity ring, company; yours is left off, you know who you are.
    const company = info.companyId === null ? undefined : world.companies.get(info.companyId);
    const isMe = info.id === world.selfId;
    if (close && !isMe) this.showcase.want(info.id, now);
    const pins = isMe ? null : this.showcase.get(info.id);
    const from = r.tagFrom;
    if (from[0] !== info || from[1] !== company || from[2] !== pins) {
      from[0] = info;
      from[1] = company;
      from[2] = pins;
      r.tagKey = `${info.name}|${info.level}|${info.online}|${company?.name ?? ""}|${company?.brand?.roof ?? ""}|${info.look.hat}|${info.look.outfit}|${pins?.key ?? ""}`;
    }
    if (!isMe && (!r.tag || r.tagMade !== r.tagKey)) {
      r.tag?.remove();
      r.tag = nameTag({
        name: info.name,
        level: info.level,
        rarity: wornBy(info.look).rarity,
        online: info.online,
        company: company ? { name: company.name, color: company.brand?.roof ?? "#3f7a78" } : undefined,
        badges: pins?.chips.badges,
        trophies: pins?.chips.trophies,
      });
      r.tag.classList.remove("label");
      r.tagMade = r.tagKey;
      r.stack.append(r.tag);
    } else if (isMe && r.tag) {
      r.tag.remove();
      r.tag = null;
    }
    // Over their head, top to bottom: what they said, a sausage, the game they are in, the desk, the nap.
    // What they said, or else a sneeze.
    const said =
      bubbleOn && a.bubble && !resting
        ? { text: a.bubble.text, left: a.bubble.until - now }
        : r.sneeze !== null
          ? { text: SNEEZE_TEXT, left: (1 - r.sneeze) * SNEEZE_MS }
          : null;
    if (said) {
      if (r.bubbleText !== said.text) {
        r.bubbleText = said.text;
        r.bubble.textContent = said.text.length > 120 ? `${said.text.slice(0, 119)}…` : said.text;
      }
      r.bubble.style.display = "";
      r.bubble.style.opacity = said.left < 400 ? String(Math.max(0, said.left / 400)) : "1";
    } else r.bubble.style.display = "none";
    show(r.pills.polse, hasPolse(info.polseUntil, Date.now()) ? "🌭" : null);
    show(r.pills.battle, this.fights.has(info.id) ? "⚔️ Aura battle" : null);
    show(r.pills.game, gameTag(info.id));
    show(r.pills.work, a.state === "working" ? `💻 ×${Math.max(1, info.liveAgents)}` : null);
    show(r.pills.zzz, resting || info.dozing ? "z" : null);
    const lift = tagLift(info.level, pose);
    this.v.set(r.x, y + lift - (pose === "sleep" ? 0 : 0) + 0.05, r.z);
    if (this.overlay.place(r.stack, this.v, camera) && r.tag) {
      r.tagOn = true;
      r.tx = this.overlay.px;
      r.ty = this.overlay.py;
      r.tdist = me ? Math.hypot(a.x - me.x, a.y - me.y) : 0;
    }

    // Emoji-only lines burst round the head instead of showing a bubble.
    if (a.burst && now - a.burst.at < BURST_MS) {
      if (!r.burst?.matches(a.burst.emojis, a.burst.at)) {
        r.burst?.dispose();
        r.burst = null;
        // Busy rooms: past the tier's cap a new burst waits (and is skipped once its time is up).
        if (this.bursts < this.maxBursts) {
          r.burst = new Burst(this.overlay, a.burst.emojis, a.burst.at);
          this.bursts++;
        }
      }
      if (!r.burst) return;
      const [sx, sy] = this.overlay.project(this.v.set(r.x, y + lift - 0.2, r.z), camera);
      if (!r.burst.step(now, sx, sy)) {
        r.burst.dispose();
        r.burst = null;
      }
    } else if (r.burst) {
      r.burst.dispose();
      r.burst = null;
    }
  }
}
