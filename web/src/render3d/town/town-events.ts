import { fishingWater } from "@tokenmaxxing/core/fishing.ts";
import { PRICE_LAMP, priceSign } from "@tokenmaxxing/core/grid.ts";
import { STAND, standOf } from "@tokenmaxxing/core/launch.ts";
import { PLAZA } from "@tokenmaxxing/core/maps.ts";
import {
  CART_H,
  CART_SPOT,
  CART_W,
  lineup,
  cartOpen as merchantIn,
  weekOf,
} from "@tokenmaxxing/core/merchant.ts";
import { BASKET, BLANKETS } from "@tokenmaxxing/core/picnic.ts";
import {
  CART,
  clockMinutes,
  PAPER,
  paperboyAt,
  paperRides,
  cartOpen as polseOpen,
  SNAIL,
  snailAt,
} from "@tokenmaxxing/core/street.ts";
import * as THREE from "three";
import { currentGrid, PRICE_TONES } from "../../game/grid.ts";
import { currentLaunches, handOut, RAINBOW_SIGN } from "../../game/launch.ts";
import { openCart } from "../../game/merchant.ts";
import { outageNow } from "../../game/picnic.ts";
import { lane, live as raceLive } from "../../game/race.ts";
import { lightsNow, skyNow } from "../../game/sky.ts";
import { animalMotion, catPetted, townAnimals } from "../../game/town-life.ts";
import { self, serverNow, world } from "../../game/world.ts";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Burst, type Overlay } from "../engine/overlay.ts";
import { canvasTexture } from "../kit/kit.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import type { LiveFrame } from "../rooms/rooms.ts";
import { TownCat, TownPigeon } from "./animals3d.ts";
import { buntingMeshes } from "./bunting3d.ts";
import { FishingLine } from "./fishing3d.ts";
import {
  basketModel,
  blanketModel,
  grassPatch,
  launchStand,
  merchantCart,
  pamphletModel,
  signpost,
} from "./fx3d-town.ts";
import {
  burstCap,
  CART_SIGN_AWAY,
  CART_SIGN_HERE,
  crossed,
  goodsColors,
  isGrassNotice,
  polseSign,
  snailSign,
} from "./world-logic.ts";

/** The merchant's calls to anyone close (`CALLS` in `game/merchant.ts`). */
const CALLS = [
  "Merchant editions! Numbered, and never many.",
  "Only here till Monday morning, friend.",
  "Every copy stamped. Every one a little bit rare.",
  "Fresh from the far side of the context window!",
];
/** How far the cart rolls in and out, in tiles, and how fast. */
const ROLL_TILES = 3.4;
const ROLL_SPEED = 1.1;
const NEAR_MERCHANT = 4;
const GRASS_MS = 9000;
const COINS = 3;
/** The street's schedules are looked at this often. */
const STREET_EVERY_MS = 250;
const COIN_MS = 800;

const v3 = new THREE.Vector3();
const stripLights = (o: THREE.Object3D): void => {
  const lights: THREE.Object3D[] = [];
  o.traverse((c) => {
    if (c instanceof THREE.PointLight) lights.push(c);
  });
  for (const l of lights) l.parent?.remove(l);
};

/** The cart as the town wants it: no real lights, the lantern's flame and halo kept out of any batch, the halo a soft ball. */
function prep(c: ReturnType<typeof merchantCart>): void {
  stripLights(c.model);
  c.flame.userData.live = true;
  c.halo.userData.live = true;
  c.halo.userData.noBlock = true;
  c.halo.userData.nopick = true;
}

interface Pill {
  el: HTMLDivElement;
  text: string;
}

/**
 * The town's world events, drawn from the real game's state (the 2D game's `merchant.ts`, `picnic.ts`,
 * `street.ts`, `race.ts`, `launch.ts`): the traveling merchant's cart on the server's clock, the outage picnic
 * with its bunting and the "touched grass" moment, the pølsevogn's sign, the build snail's status and the
 * paperboy's tag, the launch stand and its pamphlets, and the Sprint Race's start line. Officer 429 and the racers are people, drawn by `Entities`.
 *
 * Everything is built once per town and only shown and hidden, positions are set in place, labels are a few
 * DOM nodes: nothing allocates per frame.
 */
export class TownEvents {
  readonly group = new THREE.Group();
  private readonly toWorld: (tx: number, ty: number) => [number, number];

  // The merchant
  private cart: ReturnType<typeof merchantCart>;
  private readonly cartRoot = new THREE.Group();
  private readonly merchant: Avatar;
  private readonly post = signpost();
  private cartState: "away" | "arriving" | "here" | "leaving" = "away";
  private cartAt = 0;
  private editionsMinute = Number.NaN;
  private hereAt = -Infinity;
  private hereNow = false;
  private readonly spot: [number, number];
  /** Where the merchant stands: by the back wheel. */
  private readonly stand: [number, number];
  private firstFrame = true;
  private weekShown: string;

  // The picnic
  private readonly picnic = new THREE.Group();
  private readonly grass = grassPatch();
  private grassAt = -1;
  private picnicOn = false;
  private noticeAt = 0;

  // The street
  private lastMinute: number | null = null;
  private readonly polseAt: [number, number];
  private rides: ReturnType<typeof paperRides> | null = null;
  private ridesFor: object | null = null;

  // The launch stand: built again only when its colours change (one provider's, or a rainbow).
  private readonly launchRoot = new THREE.Group();
  private launchLook: string | null = null;
  private readonly presenter: Avatar;
  private readonly flyer = pamphletModel();
  private readonly launchAt: [number, number];
  private launchSign = { at: -Infinity, sign: "", bg: "" };

  // The race
  private readonly line: THREE.Mesh;
  private lineKey = "";

  // The fountain's coins: a few in the air at a time, and the ripple where one lands.
  private readonly coins: { mesh: THREE.Mesh; from: [number, number]; to: [number, number]; at: number }[] =
    [];
  private readonly ripple: THREE.Mesh;
  private rippleAt = -10;
  private rippleWhere: [number, number] = [0, 0];
  private lastMe: [number, number] | null = null;
  private clock = 0;
  private readonly fishingLine = new FishingLine();
  private readonly cat = new TownCat();
  private readonly pigeons = [new TownPigeon(), new TownPigeon(), new TownPigeon()];

  // Labels and bursts
  private readonly pills = new Map<string, Pill>();
  private maxBursts = 4;
  private bursts: { burst: Burst; at: number; x: number; y: number; z: number }[] = [];
  private overlay: Overlay | null = null;

  constructor(toWorld: (tx: number, ty: number) => [number, number]) {
    this.toWorld = toWorld;
    this.group.name = "town-events";
    this.group.userData.events = this;
    this.group.add(this.cat.root, this.fishingLine.group);
    for (const bird of this.pigeons) this.group.add(bird.root);
    const [cx, cz] = this.toWorld(CART_SPOT.x, CART_SPOT.y);
    // The middle of the three-by-two tiles the cart stands on.
    this.spot = [cx + (CART_W - 1) / 2, cz + (CART_H - 1) / 2];
    const [px, pz] = this.toWorld(CART[0]![0], CART[0]![1]);
    this.polseAt = [px + 0.5, pz];
    this.stand = this.toWorld(CART_SPOT.x - 1, CART_SPOT.y);

    // The merchant's cart, stocked for this week: the lantern's flame and halo change colour, so they stay out of any batch.
    this.weekShown = weekOf(serverNow());
    this.cart = merchantCart(goodsColors(lineup(this.weekShown)));
    prep(this.cart);
    mergeStill(this.cart.model);
    this.cartRoot.add(this.cart.model);
    this.cartRoot.visible = false;
    this.merchant = new Avatar(
      personLook({
        skin: "#e0a97a",
        hair: "#a8a8b8",
        style: 0,
        outfit: ["#7a3b6e", "#5a2a52"],
        pants: "#3c4454",
        hat: "none",
        age: "senior",
        beard: 1,
      }),
      "voxel",
    );
    this.merchant.root.visible = false;
    this.merchant.root.position.set(this.stand[0], 0, this.stand[1]);
    this.merchant.root.rotation.y = 0;
    this.post.position.set(this.spot[0], 0, this.spot[1] + 0.9);
    this.group.add(this.cartRoot, this.post, this.merchant.root);

    // The launch stand, on its two by two tiles, with someone behind the counter; hidden until something ships.
    const [lx, lz] = this.toWorld(STAND.x, STAND.y);
    this.launchAt = [lx + (STAND.w - 1) / 2, lz + (STAND.h - 1) / 2];
    this.launchRoot.position.set(this.launchAt[0], 0, this.launchAt[1]);
    this.launchRoot.visible = false;
    this.presenter = new Avatar(
      personLook({
        skin: "#c98e62",
        hair: "#2b2433",
        style: 1,
        outfit: ["#6a4fb3", "#4b3889"],
        pants: "#3c4454",
        hat: "none",
      }),
      "voxel",
    );
    // Beside the counter's front corner, square-side: behind it, the awning and the counter hide them from
    // the camera. Like the merchant, a person of the events group's own (not part of the stand).
    this.presenter.root.position.set(this.launchAt[0] + 1.1, 0, this.launchAt[1] + 0.35);
    this.presenter.root.rotation.y = 0;
    this.presenter.root.visible = false;
    this.presenter.pose = "wave";
    this.presenter.expression = "happy";
    this.flyer.visible = false;
    this.flyer.userData.live = true;
    this.flyer.userData.nopick = true;
    this.group.add(this.launchRoot, this.presenter.root, this.flyer);

    // The picnic: blankets and the basket on the grass, bunting over the square.
    for (const [i, b] of BLANKETS.entries()) {
      const m = blanketModel(b.w, b.h, i);
      const [x, z] = this.toWorld(b.x, b.y);
      m.position.set(x + (b.w - 1) / 2, 0.045, z + (b.h - 1) / 2);
      this.picnic.add(m);
    }
    const basket = basketModel();
    const [bx, bz] = this.toWorld(BASKET[0], BASKET[1]);
    basket.position.set(bx, 0.05, bz);
    basket.rotation.y = -0.4;
    this.picnic.add(basket);
    const lamp = (tx: number, ty: number): [number, number, number] => {
      const [x, z] = this.toWorld(tx, ty);
      return [x, 2.1, z];
    };
    const tl = lamp(PLAZA.left, PLAZA.top);
    const tr = lamp(PLAZA.right, PLAZA.top);
    const bl = lamp(PLAZA.left, PLAZA.bottom);
    const br = lamp(PLAZA.right, PLAZA.bottom);
    mergeStill(this.picnic);
    this.picnic.add(
      buntingMeshes([
        { a: tl, b: tr, sag: 0.5 },
        { a: bl, b: br, sag: 0.5 },
        { a: tl, b: bl, sag: 0.4 },
        { a: tr, b: br, sag: 0.4 },
      ]),
    );
    this.picnic.visible = false;
    mergeStill(this.grass);
    this.grass.visible = false;
    this.group.add(this.picnic, this.grass);

    // The race's start line: a chequered strip across the lanes.
    const tex = canvasTexture(
      4,
      12,
      (g) => {
        for (let y = 0; y < 12; y++)
          for (let x = 0; x < 4; x++) {
            g.fillStyle = (x + y) % 2 ? "#2b2433" : "#fbf7ef";
            g.fillRect(x, y, 1, 1);
          }
      },
      false,
    );
    this.line = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    this.line.rotation.x = -Math.PI / 2;
    this.line.position.y = 0.08;
    this.line.visible = false;
    this.line.userData.live = true;
    this.line.userData.nopick = true;
    this.group.add(this.line);

    const coin = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10);
    const gold = new THREE.MeshBasicMaterial({ color: "#f5d14a" });
    for (let i = 0; i < COINS; i++) {
      const mesh = new THREE.Mesh(coin, gold);
      mesh.visible = false;
      mesh.userData.nopick = true;
      mesh.userData.live = true;
      this.group.add(mesh);
      this.coins.push({ mesh, from: [0, 0], to: [0, 0], at: -10 });
    }
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.26, 20),
      new THREE.MeshBasicMaterial({
        color: "#e8f6ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.visible = false;
    this.ripple.userData.nopick = true;
    this.ripple.userData.live = true;
    this.group.add(this.ripple);
  }

  // MARK: Labels

  private pill(
    key: string,
    cls: string,
    text: string,
    at: THREE.Vector3,
    camera: THREE.Camera,
    click?: () => void,
    style?: string,
  ): void {
    const overlay = this.overlay!;
    let p = this.pills.get(key);
    if (!p) {
      const el = overlay.make(cls);
      if (click) {
        el.classList.add("link");
        el.addEventListener("click", click);
      }
      p = { el, text: "" };
      this.pills.set(key, p);
    }
    if (p.text !== text) {
      p.text = text;
      p.el.textContent = text;
    }
    if (style !== undefined && p.el.style.background !== style) p.el.style.background = style;
    // The paperboy's tag is a "come here" beacon; the rest are signs over things, shown near the player.
    overlay.place(p.el, at, camera, 0, 0, key !== "paper");
  }

  private hide(key: string): void {
    const p = this.pills.get(key);
    if (p && p.el.style.display !== "none") p.el.style.display = "none";
  }

  private burst(emojis: string[], x: number, y: number, z: number, now: number): void {
    const overlay = this.overlay;
    if (!overlay) return;
    if (this.bursts.length >= this.maxBursts) this.bursts.shift()?.burst.dispose();
    this.bursts.push({ burst: new Burst(overlay, emojis, now), at: now, x, y, z });
  }

  private notify(text: string): void {
    hud.set({ notice: { text, at: Date.now() } });
  }

  // MARK: Frame

  /** A coin from where you stand into the fountain at tile (`tx`, `ty`): an arc, then a ripple. */
  toss(tx: number, ty: number): void {
    const free = this.coins.find((c) => c.at < 0 || this.clock - c.at > COIN_MS) ?? this.coins[0]!;
    // The fountain is a few tiles: the coin lands in the middle of them.
    const pool = world.map.find("F");
    const near = pool.some(([px, py]) => px === tx && py === ty) ? pool : [[tx, ty] as [number, number]];
    let x = 0;
    let z = 0;
    for (const [px, py] of near) {
      const [wx, wz] = this.toWorld(px, py);
      x += wx / near.length;
      z += wz / near.length;
    }
    free.from = this.lastMe ? [this.lastMe[0], this.lastMe[1]] : [x, z + 1];
    free.to = [x, z];
    free.at = this.clock;
    free.mesh.visible = true;
  }

  private coinsFrame(f: LiveFrame): void {
    for (const c of this.coins) {
      if (!c.mesh.visible) continue;
      const k = (f.now - c.at) / COIN_MS;
      if (k >= 1) {
        c.mesh.visible = false;
        this.rippleAt = f.now;
        this.rippleWhere = c.to;
        continue;
      }
      c.mesh.position.set(
        c.from[0] + (c.to[0] - c.from[0]) * k,
        1.1 + Math.sin(k * Math.PI) * 0.8 - k * 0.5,
        c.from[1] + (c.to[1] - c.from[1]) * k,
      );
      c.mesh.rotation.set(k * 14, 0, k * 6);
    }
    const r = (f.now - this.rippleAt) / 900;
    this.ripple.visible = r >= 0 && r < 1;
    if (this.ripple.visible) {
      this.ripple.position.set(this.rippleWhere[0], 0.55, this.rippleWhere[1]);
      this.ripple.scale.setScalar(1 + r * 3.5);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - r);
    }
  }

  update(f: LiveFrame): void {
    this.overlay = f.overlay;
    this.maxBursts = Math.max(1, Math.round(burstCap(f.density) / 2));
    this.clock = f.now;
    this.lastMe = f.me;
    this.fishingLine.update(f.now, this.toWorld, f.calm);
    const [pondX, pondZ] = this.toWorld(4, 11);
    this.pill("fishing", "r3-sign link", "🎣 Pond fishing", v3.set(pondX, 0.65, pondZ), f.camera, () => {
      const me = self();
      if (me && fishingWater(world.map, me.x, me.y, me.facing)) hud.set({ panel: { kind: "fishing" } });
      else hud.set({ dialog: "🎣 Walk to the pond bank and press E facing the water to borrow a rod." });
    });
    const animals = townAnimals();
    this.cat.root.visible = animals !== null;
    if (animals) {
      const [x, z] = this.toWorld(...animals.cat);
      this.cat.root.position.set(x, 0, z);
      this.cat.update(f.now, catPetted(f.now), f.calm);
      animals.birds.forEach(([bx, by], i) => {
        const [px, pz] = this.toWorld(bx, by);
        const pose = animalMotion(i, bx, by, f.now);
        const bird = this.pigeons[i]!;
        bird.root.visible = true;
        bird.root.position.set(px + pose.offset * (i % 2 ? 0.7 : -0.7), pose.lift, pz + pose.offset * 0.2);
        bird.update(pose, i, f.calm);
      });
    } else for (const bird of this.pigeons) bird.root.visible = false;
    this.coinsFrame(f);
    const near = this.nearCamera(f);
    const calm = f.calm;
    this.merchantFrame(f, near, calm);
    this.picnicFrame(f);
    this.streetFrame(f);
    this.launchFrame(f);
    this.gridFrame(f);
    this.raceFrame();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!;
      const [sx, sy] = f.overlay.project(v3.set(b.x, b.y, b.z), f.camera);
      if (!b.burst.step(f.now, sx, sy)) {
        b.burst.dispose();
        this.bursts.splice(i, 1);
      }
    }
    this.firstFrame = false;
  }

  /** The cart's and the square's corner of the picture is on screen (otherwise the avatars skip their animation). */
  private nearCamera(f: LiveFrame): boolean {
    v3.set(this.spot[0], 1, this.spot[1]).project(f.camera);
    return Math.abs(v3.x) < 1.5 && Math.abs(v3.y) < 1.5;
  }

  // MARK: The merchant

  private merchantFrame(f: LiveFrame, near: boolean, calm: boolean): void {
    const { cartRoot, merchant, spot } = this;
    // Whether the cart is in: asked once a second (the clock is read through `Intl`).
    if (f.now - this.hereAt >= 1000) {
      this.hereAt = f.now;
      this.hereNow = merchantIn(serverNow());
    }
    const here = this.hereNow;
    const minute = Math.floor(serverNow() / 60_000);
    if (minute !== this.editionsMinute) {
      this.editionsMinute = minute;
      const week = weekOf(serverNow());
      if (week !== this.weekShown) {
        // A new week, a new lineup on the counter: only the goods' colours change, so the cart is built again.
        this.weekShown = week;
        this.restock(goodsColors(lineup(week)));
      }
    }
    const [mx, mz] = this.stand;
    const roll = ROLL_TILES;
    if (here && this.cartState === "away") {
      this.cartState = this.firstFrame ? "here" : "arriving";
      this.cartAt = this.cartState === "here" ? roll : 0;
      cartRoot.visible = true;
      merchant.root.visible = true;
    }
    if (!here && (this.cartState === "here" || this.cartState === "arriving")) {
      this.cartState = this.firstFrame ? "away" : "leaving";
      if (this.cartState === "away") {
        cartRoot.visible = false;
        merchant.root.visible = false;
      } else merchant.pose = "stand";
    }
    if (this.cartState === "arriving") {
      this.cartAt = Math.min(roll, this.cartAt + f.dt * ROLL_SPEED * (calm ? 4 : 1));
      if (this.cartAt >= roll) {
        this.cartState = "here";
        this.burst(["🛒", "✨"], spot[0], 1.6, spot[1], f.now);
      }
    } else if (this.cartState === "leaving") {
      this.cartAt = Math.max(0, this.cartAt - f.dt * ROLL_SPEED * (calm ? 4 : 1));
      if (this.cartAt <= 0) {
        this.cartState = "away";
        cartRoot.visible = false;
        merchant.root.visible = false;
      }
    }
    const state = this.cartState;
    const away = state === "away";
    this.post.visible = away;
    if (!away) {
      // Rolling in, the cart comes down from the square's side; it stands on its tiles once it is here.
      const z = spot[1] - (roll - this.cartAt);
      cartRoot.position.set(spot[0], 0, z);
      cartRoot.rotation.y = 0;
      const flick = Math.floor(f.now / 260) % 5 !== 0;
      (this.cart.flame.material as THREE.MeshBasicMaterial).color.set(flick ? "#ffd04a" : "#ffe9a8");
      (this.cart.halo.material as THREE.MeshBasicMaterial).opacity =
        (0.05 + lightsNow(f.now) * 0.1) * (flick ? 1 : 0.85);
      // The merchant walks beside it, then stands by the back wheel and nods at the square now and then.
      const m = merchant.root;
      if (state === "here") {
        m.position.set(mx, 0, mz);
        const look = Math.floor(f.now / 2600) % 3 === 2;
        m.rotation.y = look ? Math.PI / 2 : 0;
        merchant.pose = "wave";
        merchant.expression = "happy";
      } else {
        m.position.set(mx, 0, z - 0.4);
        m.rotation.y = state === "leaving" ? Math.PI : 0;
        merchant.pose = "walk";
      }
      if (near) merchant.update(f.dt, f.t);
    }
    // Signs: the cart's, or the post's (both open the cart's page).
    if (away) {
      this.hide("cart");
      this.hide("call");
      v3.set(spot[0], 1.5, spot[1] + 0.9);
      this.pill("post", "r3-sign", CART_SIGN_AWAY, v3, f.camera, openCart);
    } else {
      this.hide("post");
      v3.set(cartRoot.position.x, 1.9, cartRoot.position.z);
      this.pill("cart", "r3-sign own", CART_SIGN_HERE, v3, f.camera, openCart);
      const me = world.avatars.get(world.selfId);
      const close = me && Math.abs(me.x - (CART_SPOT.x - 1)) + Math.abs(me.y - CART_SPOT.y) <= NEAR_MERCHANT;
      if (close && state === "here") {
        v3.set(mx, 2.0, mz);
        this.pill("call", "r3-bubble", CALLS[Math.floor(f.now / 6000) % CALLS.length]!, v3, f.camera);
      } else this.hide("call");
    }
  }

  /** The cart's goods as this week's lineup (the colours of the four editions). */
  private restock(colors: string[]): void {
    const was = this.cart.model;
    const next = merchantCart(colors);
    prep(next);
    mergeStill(next.model);
    this.cartRoot.remove(was);
    disposeObject(was);
    this.cartRoot.add(next.model);
    this.cart.model = next.model;
    this.cart.flame = next.flame;
    this.cart.halo = next.halo;
  }

  // MARK: The picnic

  private picnicFrame(f: LiveFrame): void {
    const on = outageNow() !== null;
    if (on !== this.picnicOn) {
      this.picnicOn = on;
      this.picnic.visible = on;
    }
    // The reward: the server's notice for the badge says "Touched grass": a patch sprouts where you sit.
    const n = hud.get().notice;
    if (n && n.at !== this.noticeAt) {
      this.noticeAt = n.at;
      if (isGrassNotice(n.text) && f.me) {
        this.grassAt = f.now;
        this.grass.visible = true;
        this.grass.position.set(f.me[0] + 0.7, 0, f.me[1] + 0.2);
        this.grass.scale.setScalar(0.01);
        this.burst(["🌱", "🌿", "✨", "🧺", "🌼"], f.me[0], 1.6, f.me[1], f.now);
      }
    }
    if (this.grass.visible) {
      const k = Math.min(1, Math.max(0, (f.now - this.grassAt) / 600)) - 1;
      const e = f.calm ? 1 : 1 + 2.7 * k ** 3 + 1.7 * k ** 2;
      this.grass.scale.setScalar(Math.max(0.01, e));
      if (f.now - this.grassAt > GRASS_MS || !on) {
        this.grass.visible = false;
      }
    }
  }

  // MARK: The street

  /** The street's clock-driven state, worked out four times a second (the clock is read through `Intl`) and drawn every frame. */
  private readonly street = {
    at: -Infinity,
    m: 0,
    open: false,
    phase: "queued" as "queued" | "deploying" | "deployed",
    snail: [0, 0] as [number, number],
    boy: null as [number, number] | null,
  };

  private streetFrame(f: LiveFrame): void {
    const st = this.street;
    if (f.now - st.at >= STREET_EVERY_MS) {
      st.at = f.now;
      const at = skyNow();
      const m = clockMinutes(at);
      st.m = m;
      st.open = polseOpen(at);
      const s = snailAt(at);
      st.phase = s.phase;
      st.snail = this.toWorld(s.x, s.y);
      if (this.ridesFor !== world.map) {
        this.ridesFor = world.map;
        const map = world.map;
        this.rides = paperRides([...map.find("D"), ...map.find("I")], map.x0 + 1, map.x0 + map.width - 1);
      }
      const boy = m >= PAPER.at ? paperboyAt(this.rides!, m) : null;
      st.boy = boy ? this.toWorld(boy.x, boy.y) : null;
      // The build finishing while you watch: confetti over the snail, once.
      if (crossed(this.lastMinute, m, SNAIL.arrives)) {
        this.burst(["🎉", "✨", "✅"], st.snail[0], 0.9, st.snail[1], f.now);
        this.notify("🐌 Build succeeded. The snail has deployed to production.");
      }
      this.lastMinute = m;
    }
    // The pølsevogn's sign over its two tiles.
    v3.set(this.polseAt[0], 1.75, this.polseAt[1]);
    this.pill(
      "polse",
      "r3-sign",
      polseSign(st.open),
      v3,
      f.camera,
      undefined,
      st.open ? "rgba(216, 52, 60, 0.95)" : "rgba(43, 36, 51, 0.7)",
    );
    // The snail: a sign on its shell.
    const [sx, sz] = st.snail;
    v3.set(sx, 0.95, sz);
    this.pill(
      "snail",
      "r3-sign",
      snailSign(st.phase),
      v3,
      f.camera,
      undefined,
      st.phase === "deployed" ? "rgba(88, 179, 106, 0.95)" : "rgba(212, 156, 103, 0.95)",
    );
    // The paperboy's tag follows him round (the bike and the papers are the town's own).
    if (st.boy) {
      v3.set(st.boy[0], 1.6, st.boy[1]);
      this.pill("paper", "r3-sign own", "📰 Paper!", v3, f.camera);
    } else this.hide("paper");
  }

  // MARK: The launch stand

  /** The price board on the square's north-east lamp post (`core/src/grid.ts`), as in 2D. */
  private gridFrame(f: LiveFrame): void {
    const sign = priceSign(currentGrid());
    const [x, z] = this.toWorld(PRICE_LAMP.x, PRICE_LAMP.y);
    v3.set(x, 2.05, z);
    this.pill("grid", "r3-sign", sign.text, v3, f.camera, undefined, PRICE_TONES[sign.tone]);
  }

  private launchFrame(f: LiveFrame): void {
    const flying = handOut(f.now);
    // What's up, asked four times a second like the street's clock.
    const st = this.launchSign;
    if (f.now - st.at >= STREET_EVERY_MS) {
      st.at = f.now;
      const up = currentLaunches();
      const stand = up.length ? standOf(up) : null;
      const look = stand ? (stand.accent ?? "rainbow") : null;
      if (look !== this.launchLook) {
        this.launchLook = look;
        const old = this.launchRoot.getObjectByName("launch-stand");
        if (old) {
          this.launchRoot.remove(old);
          disposeObject(old);
        }
        if (stand) {
          const model = launchStand(stand.accent);
          model.name = "launch-stand";
          mergeStill(model);
          this.launchRoot.add(model);
        }
        this.launchRoot.visible = stand !== null;
        this.presenter.root.visible = stand !== null;
      }
      st.sign = stand?.sign ?? "";
      st.bg = stand?.accent ?? RAINBOW_SIGN;
    }
    if (!this.launchRoot.visible) {
      this.hide("launch");
      this.flyer.visible = false;
      return;
    }
    // The presenter waves only while the stand is in the picture (the merchant's `near` is the other side of the square).
    v3.set(this.launchAt[0], 1, this.launchAt[1]).project(f.camera);
    if (Math.abs(v3.x) < 1.5 && Math.abs(v3.y) < 1.5) this.presenter.update(f.dt, f.t);
    v3.set(this.launchAt[0], 2.05, this.launchAt[1]);
    this.pill(
      "launch",
      "r3-sign",
      st.sign,
      v3,
      f.camera,
      () => hud.set({ panel: { kind: "pamphlet" } }),
      st.bg,
    );
    // The pamphlet in the air: off the counter in an arc to whoever walked by.
    this.flyer.visible = flying !== null;
    if (flying) {
      const [tx, tz] = this.toWorld(flying.x, flying.y);
      const fx = this.launchAt[0];
      const fz = this.launchAt[1] + 0.3;
      const k = flying.t;
      this.flyer.position.set(
        fx + (tx - fx) * k,
        0.95 + Math.sin(k * Math.PI) * 0.9 - k * 0.15,
        fz + (tz - fz) * k,
      );
      this.flyer.rotation.set(0, k * 9, Math.sin(k * Math.PI) * 0.6);
    }
  }

  // MARK: The race

  private raceFrame(): void {
    let game: { players: number[] } | null = null;
    for (const g of world.games.values())
      if (raceLive(g)) {
        game = g;
        break;
      }
    if (!game) {
      if (this.line.visible) this.line.visible = false;
      this.lineKey = "";
      return;
    }
    const key = game.players.join();
    if (key !== this.lineKey) {
      this.lineKey = key;
      const lanes = game.players.map((p) => lane(game as never, p));
      const top = PLAZA.top + Math.min(...lanes);
      const bottom = PLAZA.top + Math.max(...lanes) + 0.8;
      const mid = (PLAZA.left + PLAZA.right) / 2 + 0.4;
      const [x0, z0] = this.toWorld(mid, top);
      const [, z1] = this.toWorld(mid, bottom);
      this.line.position.set(x0, 0.08, (z0 + z1) / 2);
      this.line.scale.set(0.4, z1 - z0, 1);
      this.line.rotation.z = 0;
      (this.line.material as THREE.MeshBasicMaterial).map!.repeat.set(
        1,
        Math.max(2, Math.round((z1 - z0) / 0.2) / 12),
      );
    }
    this.line.visible = true;
  }

  // MARK: Teardown

  /** The town is kept while you are elsewhere: its signs and bursts are DOM labels and would hang over another room. */
  leave(): void {
    for (const k of this.pills.keys()) this.hide(k);
    for (const b of this.bursts) b.burst.dispose();
    this.bursts = [];
  }

  dispose(): void {
    for (const b of this.bursts) b.burst.dispose();
    this.bursts = [];
    for (const p of this.pills.values()) p.el.remove();
    this.pills.clear();
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
