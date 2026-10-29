/**
 * The town's sky and weather (ported from `web/src/game/sky.ts`): a sun that rises and sets, stars and a phased moon,
 * clouds, fog (as thick as the visibility says), drizzle, rain, storms with lightning, snow that settles on roofs, and a
 * pond that ices over below freezing (`cold3d.ts`). The light follows the game's clock
 * smoothly: lamps and windows switch on at dusk and dim in by degrees, and the sun swings round the sky.
 */

import { worldWall } from "@tokenmaxxing/core/range.ts";
import { CALM, fogOf, iceOver, type Light, moonPhase, type Weather } from "@tokenmaxxing/core/sky.ts";
import * as THREE from "three";
import { addPatch } from "../kit/patches.ts";
import { ICE } from "./cold3d.ts";
import { setStreetLampDim } from "./props.ts";

export { FX_ASSETS } from "./fx3d-town.ts";

export interface FxStageRef {
  name: string;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  target: THREE.Vector3;
}

/** What the stage lends the effects: its stages and its lamps. */
export interface FxHost {
  stages: FxStageRef[];
  town: FxStageRef;
  /** The stage being shown. */
  current: () => string;
  /** Lamps and windows on or off (the part of night that is a switch, not a dimmer). */
  applyNight: (on: boolean) => void;
}

/** The game's side of the sky: its clock, the server's weather and its sun. */
export interface FxOptions {
  /** Now, in ms: the game's sky clock. */
  clock: () => number;
  /** The weather to show (already with winter's snow rule). */
  weather: () => Weather;
  /** The sun's light at a time (the game's, over Copenhagen). */
  light: (ms: number) => Light;
  /** How bright the street lamps burn, 0..1 (dimmed while power is expensive: `game/grid.ts`). */
  lampDim?: () => number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const col = (hex: string) => new THREE.Color(hex);
const constants = new Map<string, THREE.Color>();
/** A colour that is only read (mixed from, copied): made once, not parsed from its string every frame. */
const fixed = (hex: string): THREE.Color => {
  let c = constants.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    constants.set(hex, c);
  }
  return c;
};
const mixCol = (a: THREE.Color, b: THREE.Color, k: number) => a.clone().lerp(b, clamp01(k));

// MARK: Sky

const SKY_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 top; uniform vec3 hor; uniform vec3 cloudCol;
uniform float dark; uniform float time; uniform float cloud; uniform float flash;
uniform float aspect; uniform float wind; uniform float moonAge; uniform float murk;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.,0.)), f.x), mix(h(i+vec2(0.,1.)), h(i+vec2(1.,1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a*n(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec3 c = mix(hor, top, smoothstep(0.0, 1.0, vUv.y));
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float night = dark * dark * (1.0 - cloud * 0.9);
  // Stars: a few hundred cells, some bigger, all twinkling.
  vec2 g = p * 64.0; vec2 id = floor(g); float r = h(id);
  float rad = 0.16 + 0.22 * h(id + 3.0);
  float star = step(0.975, r) * step(length(fract(g) - 0.5), rad) * (0.6 + 0.4 * sin(time * 2.0 + r * 60.0));
  c += vec3(0.9, 0.93, 1.0) * star * night * (0.5 + 0.5 * vUv.y);
  // The moon, at its phase: the lit side bright, the rest a faint disc.
  vec2 mc = vec2(aspect * 0.78, 0.8); float R = 0.05;
  vec2 d = (p - mc) / R; float len = length(d);
  float a = 6.2831853 * moonAge;
  if (len < 1.0) {
    float nz = sqrt(1.0 - len*len);
    float lit = smoothstep(-0.04, 0.04, dot(vec3(d, nz), vec3(sin(a), 0.0, -cos(a))));
    float crater = 0.06 * step(0.8, h(floor(d * 6.0)));
    vec3 mcol = mix(vec3(0.16, 0.2, 0.33), vec3(0.96, 0.94, 0.86) - crater, lit);
    c = mix(c, mcol, night);
  } else c += vec3(0.8, 0.85, 1.0) * 0.12 * exp(-(len - 1.0) * 3.5) * night;
  // Clouds drifting with the wind: more of them the heavier the cover.
  float f = fbm(p * 2.4 + vec2(time * wind * 0.012, 0.0));
  float m = smoothstep(0.66 - cloud * 0.36, 0.86 - cloud * 0.3, f) * (0.35 + 0.65 * smoothstep(0.0, 0.5, vUv.y + cloud * 0.3));
  c = mix(c, cloudCol, m * (0.55 + 0.4 * cloud));
  c = mix(c, c * vec3(0.7, 0.74, 0.8), murk);
  c += vec3(0.75, 0.8, 1.0) * flash * (0.35 + 0.65 * m);
  gl_FragColor = vec4(c, 1.0);
}
`;

// MARK: Weather particles

const RAIN_MAX = 900;
const SNOW_MAX = 700;
const REACH = 17;

class Particles {
  readonly group = new THREE.Group();
  private readonly rain: THREE.InstancedMesh;
  private readonly snow: THREE.InstancedMesh;
  private readonly rainPos: THREE.Vector3[] = [];
  private readonly snowPos: THREE.Vector3[] = [];
  private readonly ripples: { m: THREE.Mesh; age: number }[] = [];
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly bolt = new THREE.Group();
  private boltUntil = 0;
  flash = 0;
  density = 1;
  calm = false;
  private nextBolt = 0;

  constructor() {
    const rnd = (a: number) => (Math.random() - 0.5) * 2 * a;
    this.rain = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.014, 0.5, 0.014),
      new THREE.MeshBasicMaterial({ color: "#bcd8ff", transparent: true, opacity: 0.6, depthWrite: false }),
      RAIN_MAX,
    );
    this.snow = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false }),
      SNOW_MAX,
    );
    for (const m of [this.rain, this.snow]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    for (let i = 0; i < RAIN_MAX; i++)
      this.rainPos.push(new THREE.Vector3(rnd(REACH), Math.random() * 11, rnd(REACH)));
    for (let i = 0; i < SNOW_MAX; i++)
      this.snowPos.push(new THREE.Vector3(rnd(REACH), Math.random() * 10, rnd(REACH)));
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.09, 12),
        new THREE.MeshBasicMaterial({
          color: "#d6e4fa",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.ripples.push({ m, age: 9 });
    }
    this.group.add(this.bolt);
  }

  /** A bolt and its flash, now. */
  private strike(t: number, centre: THREE.Vector3): void {
    this.bolt.clear();
    const x = centre.x + (Math.random() - 0.5) * 16;
    const z = centre.z + (Math.random() - 0.5) * 12;
    const mat = new THREE.MeshBasicMaterial({ color: "#f4f7ff", transparent: true, depthWrite: false });
    let px = x;
    let py = 15;
    let pz = z;
    while (py > 0.05) {
      const ny = Math.max(0, py - 1 - Math.random() * 1.2);
      const nx = px + (Math.random() - 0.5) * 1.2;
      const nz = pz + (Math.random() - 0.5) * 1.2;
      const len = Math.hypot(nx - px, ny - py, nz - pz);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.07), mat);
      seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
      seg.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(nx - px, ny - py, nz - pz).normalize(),
      );
      this.bolt.add(seg);
      px = nx;
      py = ny;
      pz = nz;
    }
    this.boltUntil = t + 0.35;
    this.flash = 1;
    this.flashAt = t;
  }
  private flashAt = -9;

  update(dt: number, t: number, w: Weather, centre: THREE.Vector3, wind: THREE.Vector2): void {
    const falls = w.kind === "rain" || w.kind === "drizzle" || w.kind === "storm";
    const snows = w.kind === "snow";
    const rainN = falls
      ? Math.round(w.intensity * RAIN_MAX * this.density * (w.kind === "drizzle" ? 0.7 : 1))
      : 0;
    const snowN = snows ? Math.round(w.intensity * SNOW_MAX * this.density) : 0;
    this.rain.count = rainN;
    this.snow.count = snowN;
    this.group.position.set(centre.x, 0, centre.z);
    // Rain: streaks slanted with the wind.
    if (rainN) {
      const speed = w.kind === "drizzle" ? 9 : w.kind === "storm" ? 17 : 14;
      const vel = new THREE.Vector3(wind.x * 3, -speed, wind.y * 3);
      this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize().negate());
      const k = w.kind === "drizzle" ? 0.6 : w.kind === "storm" ? 1.4 : 1;
      this.s.set(1, k, 1);
      for (let i = 0; i < rainN; i++) {
        const p = this.rainPos[i]!;
        p.addScaledVector(vel, dt * (0.8 + (i % 7) * 0.06));
        if (p.y < 0.05) {
          if (Math.random() < 0.05) this.drop(p.x, p.z);
          p.set((Math.random() - 0.5) * 2 * REACH, 10 + Math.random() * 3, (Math.random() - 0.5) * 2 * REACH);
        }
        this.m4.compose(p, this.q, this.s);
        this.rain.setMatrixAt(i, this.m4);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
    if (snowN) {
      this.q.identity();
      this.s.set(1, 1, 1);
      for (let i = 0; i < snowN; i++) {
        const p = this.snowPos[i]!;
        p.y -= dt * (0.7 + (i % 5) * 0.15) * (1 + w.intensity);
        p.x += (wind.x * 0.5 + Math.sin(t * 0.9 + i) * 0.4) * dt;
        p.z += (wind.y * 0.5 + Math.cos(t * 0.8 + i * 1.7) * 0.3) * dt;
        if (p.y < 0.05)
          p.set((Math.random() - 0.5) * 2 * REACH, 9 + Math.random() * 2, (Math.random() - 0.5) * 2 * REACH);
        this.m4.compose(p, this.q, this.s);
        this.snow.setMatrixAt(i, this.m4);
      }
      this.snow.instanceMatrix.needsUpdate = true;
    }
    // Ripples where it lands.
    for (const r of this.ripples) {
      r.age += dt;
      const k = r.age / 0.45;
      r.m.visible = k < 1 && falls;
      if (r.m.visible) {
        r.m.scale.setScalar(1 + k * 3);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
    }
    // Lightning: now and then in a storm, a double flicker and a bolt.
    if (w.kind === "storm" && !this.calm) {
      if (t > this.nextBolt) {
        this.strike(t, centre);
        this.nextBolt = t + 5 + Math.random() * 8;
      }
    }
    const e = t - this.flashAt;
    this.flash = this.calm
      ? 0
      : e < 0.07
        ? 0.9
        : e < 0.13
          ? 0.15
          : e < 0.2
            ? 0.8
            : e < 0.5
              ? 0.8 * (1 - (e - 0.2) / 0.3)
              : 0;
    this.bolt.visible = t < this.boltUntil && (e < 0.2 || Math.floor(e * 40) % 2 === 0);
  }

  private drop(x: number, z: number): void {
    const r = this.ripples.find((q) => q.age > 0.45);
    if (!r) return;
    r.age = 0;
    r.m.position.set(x, 0.11, z);
  }
}

/** How deep the snow lies, shared by every patched material (materials outlive a town and its `Fx`). */
const SNOW = { value: 0 };

/**
 * No snow on anything: for a room indoors. Its furniture shares the town's materials, so snow left lying from
 * outside would whiten every table top; back outside it settles again.
 */
export const meltSnow = (): void => {
  SNOW.value = 0;
};

// MARK: Fx

/** Seconds the light takes to catch up with the clock. */
const BLEND = 0.35;

export class Fx {
  private readonly host: FxHost;
  private readonly particles = new Particles();
  private readonly opts: FxOptions;
  private readonly sky: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  /** 0..1 how deep the snow lies; shared by every patched material. */
  private readonly snowAmt = SNOW;
  private snowScan = 0;
  private readonly fogBank: THREE.Mesh[] = [];
  private weather: Weather = { ...CALM };
  private shown: Weather = { ...this.weather };
  /** 0..1 how thick the fog is, eased (`fogOf`). */
  private fog = 0;
  private light = { dark: 0, warm: 0, glow: 0, dim: 1 };
  /** The street lamps' dimmer, eased toward `lampDim` so they fade rather than blink. */
  private dim = 1;
  private lit = { dark: 0, warm: 0, glow: 0 };
  private nightOn = false;
  private lightsAt = -9;
  private pointLights = new Map<string, THREE.PointLight[]>();
  private flashBoost = 0;
  private lastT = performance.now() / 1000;

  /** 0 to 1: how much of the rain and snow to draw (the graphics settings'). */
  set density(d: number) {
    this.particles.density = d;
  }

  /** How far the rain and snow spread round the middle: 1 is `REACH` (17 units) either way; wider for a wider picture. */
  set spread(k: number) {
    this.particles.group.scale.set(k, 1, k);
  }

  /** No lightning flashes. */
  set calm(on: boolean) {
    this.particles.calm = on;
  }

  constructor(host: FxHost, opts: FxOptions) {
    this.host = host;
    this.opts = opts;
    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          top: { value: col("#5aa5e8") },
          hor: { value: col("#cfe8f8") },
          cloudCol: { value: col("#ffffff") },
          dark: { value: 0 },
          time: { value: 0 },
          cloud: { value: 0 },
          flash: { value: 0 },
          aspect: { value: 1.6 },
          wind: { value: 2 },
          moonAge: { value: 0.5 },
          murk: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    // Snow settles on every upward-facing surface (ground, roofs, benches) via a shader patch, see `whiten`.
    this.whiten(host.town.scene);
    // Fog banks: soft white slabs drifting over the ground.
    const fogMat = new THREE.MeshBasicMaterial({
      color: "#e4e9ee",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fogMat.clone());
      m.scale.set(5 + Math.random() * 4, 0.6 + Math.random() * 0.5, 3 + Math.random() * 2);
      m.position.set(Math.random() * 34, 0.5 + Math.random() * 1.5, Math.random() * 30);
      m.userData.speed = 0.15 + Math.random() * 0.25;
      m.visible = false;
      host.town.scene.add(m);
      this.fogBank.push(m);
    }
    host.town.scene.add(this.particles.group);
  }

  // ——— Clock ———

  /** How dark the sky is now, 0 (day) to 1 (night), as last shown. */
  clockDark(): number {
    return this.lit.dark;
  }

  /** Whether the sky dome is in the scene being shown (the town) rather than a plain background. */
  hasSky(): boolean {
    return this.sky.parent !== null;
  }

  /** The sky's colour at the horizon right now (for atmospheric haze). */
  horizon(): THREE.Color {
    return this.sky.material.uniforms.hor!.value as THREE.Color;
  }

  // ——— Frame ———

  private current(): FxStageRef {
    return this.host.stages.find((s) => s.name === this.host.current()) ?? this.host.town;
  }

  /** Jumps the light and weather to where the clock and the weather say, without blending (a room just built). */
  settle(t: number, camera: THREE.OrthographicCamera): void {
    ICE.value = iceOver(this.opts.weather()) ? 1 : 0;
    this.fog = fogOf(this.opts.weather());
    for (let i = 0; i < 3; i++) {
      this.lastT = t - 0.5;
      this.update(0, t, camera);
    }
  }

  /** Call once a frame, after the stage's own update. */
  update(_dt: number, t: number, camera: THREE.OrthographicCamera): void {
    // Our own frame time (the renderer clamps its dt, which would slow the weather on a slow machine).
    const dt = Math.min(0.5, Math.max(0.001, t - this.lastT));
    this.lastT = t;
    const ms = this.opts.clock();
    const stage = this.current();
    const inTown = stage === this.host.town;
    const l = this.opts.light(ms);
    // Weather eases in and out.
    this.weather = this.opts.weather();
    const w = this.weather;
    const k = Math.min(1, dt * 1.5);
    const s = this.shown;
    if (s.kind !== w.kind) {
      // Cross over: fade the old intensity out first, then switch.
      s.intensity = lerp(s.intensity, 0, Math.min(1, dt * 3));
      if (s.intensity < 0.05 || w.kind === "clear" || w.kind === "cloudy" || w.kind === "fog")
        s.kind = w.kind;
    }
    s.intensity = lerp(s.intensity, w.intensity, k);
    s.cloud = lerp(s.cloud, w.cloud, k);
    s.windMs = lerp(s.windMs, w.windMs, k);
    s.windDir = w.windDir;
    if (s.kind === w.kind) s.intensity = lerp(s.intensity, w.intensity, k);
    this.fog = lerp(this.fog, fogOf(w), k);
    const fog = this.fog;

    // The light of the sky, with clouds dimming it.
    const storm = s.kind === "storm" ? 0.2 : 0;
    const murk = s.cloud * 0.35 + storm + 0.1 * fog;
    const glowTarget = Math.min(
      1,
      Math.max(l.darkness, l.warmth * 0.5, s.cloud * 0.25 * (s.kind === "storm" ? 2 : 1)),
    );
    const blend = Math.min(1, dt / BLEND);
    this.lit.dark = lerp(this.lit.dark, l.darkness, blend);
    this.lit.warm = lerp(this.lit.warm, l.warmth, blend);
    this.lit.glow = lerp(this.lit.glow, glowTarget, blend);
    const { dark, warm, glow } = this.lit;
    this.flashBoost = this.particles.flash;
    this.applyLight(dark, warm, murk, ms, glow);

    // Lamps and windows come on once it's dim enough.
    if (!this.nightOn && glow > 0.4) {
      this.nightOn = true;
      this.host.applyNight(true);
    } else if (this.nightOn && glow < 0.3) {
      this.nightOn = false;
      this.host.applyNight(false);
    }
    this.dim = lerp(this.dim, this.opts.lampDim?.() ?? 1, Math.min(1, dt * 0.8));
    this.applyPointLights(glow, t);

    // The dome.
    if (inTown) {
      if (this.sky.parent !== stage.scene) stage.scene.add(this.sky);
      // Centred on the frustum, not the camera: the rig slides the window off-centre to clear the HUD.
      const at = new THREE.Vector3((camera.left + camera.right) / 2, (camera.top + camera.bottom) / 2, -150);
      this.sky.position.copy(at.applyQuaternion(camera.quaternion)).add(camera.position);
      this.sky.quaternion.copy(camera.quaternion);
      const sw = (camera.right - camera.left) * 1.05;
      const sh = (camera.top - camera.bottom) * 1.05;
      this.sky.scale.set(sw, sh, 1);
      const u = this.sky.material.uniforms;
      const day = fixed("#4f9be0");
      const dayH = fixed("#bfe3f7");
      const warmT = fixed("#5a78b8");
      const warmH = fixed("#ffb27a");
      const nightT = fixed("#070b1c");
      const nightH = fixed("#1a2145");
      const grey = fixed("#8c97a6");
      const greyH = fixed("#c3c9d0");
      let top = mixCol(day, warmT, warm * 0.85);
      let hor = mixCol(dayH, warmH, warm * 0.85);
      top = mixCol(top, nightT, dark ** 1.3);
      hor = mixCol(hor, nightH, dark ** 1.3);
      const gk = clamp01(s.cloud * 0.6 + storm * 2 + Math.min(0.3, fog * 0.6)) * (1 - dark * 0.7);
      top = mixCol(top, grey.clone().multiplyScalar(1 - dark * 0.8 - storm), gk);
      hor = mixCol(hor, greyH.clone().multiplyScalar(1 - dark * 0.8 - storm), gk);
      u.top!.value.copy(top);
      u.hor!.value.copy(hor);
      u.cloudCol!.value.copy(
        mixCol(
          fixed("#ffffff"),
          mixCol(fixed("#ffb89a"), fixed("#1b2038"), dark),
          Math.max(warm * 0.6, dark),
        ).multiplyScalar(1 - storm * 2.2),
      );
      u.dark!.value = dark;
      u.time!.value = t;
      u.cloud!.value = s.cloud;
      u.flash!.value = this.flashBoost;
      u.aspect!.value = sw / sh;
      u.wind!.value = s.windMs;
      u.moonAge!.value = moonPhase(ms).age;
      u.murk!.value = murk * 0.5;
      // Fog fades the far end of the slab into the horizon.
      if (fog > 0.05) {
        if (!stage.scene.fog) stage.scene.fog = new THREE.Fog(hor.getHex(), 60, 90);
        const f = stage.scene.fog;
        (f as THREE.Fog).color.copy(hor);
        (f as THREE.Fog).near = lerp(90, 46, fog);
        (f as THREE.Fog).far = lerp(120, 78, fog);
      } else stage.scene.fog = null;
    } else if (this.sky.parent) this.sky.removeFromParent();

    // Weather in the town (the indoor stages stay dry).
    const winds = new THREE.Vector2(
      -Math.sin((s.windDir * Math.PI) / 180) * Math.min(1, s.windMs / 10) * 2.5,
      Math.cos((s.windDir * Math.PI) / 180) * Math.min(1, s.windMs / 10) * 1.2,
    );
    this.particles.group.visible = inTown;
    this.particles.update(dt, t, s, this.host.town.target, winds);
    // Snow settles on up-facing surfaces and melts away; fog banks drift.
    const snowy = s.kind === "snow" && s.intensity > 0.05;
    this.snowAmt.value = lerp(this.snowAmt.value, snowy ? 1 : 0, Math.min(1, dt * 0.5));
    // The pond freezes below 0 °C and thaws above it, over half a minute or so.
    ICE.value = clamp01(ICE.value + (iceOver(w) ? 1 : -1) * dt * 0.04);
    this.snowScan -= dt;
    if (this.snowScan <= 0) {
      this.snowScan = 1.5;
      this.whiten(this.host.town.scene); // pick up props built since the last pass
    }
    for (const m of this.fogBank) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const want = 0.14 * fog;
      mat.opacity = lerp(mat.opacity, want, Math.min(1, dt));
      m.visible = mat.opacity > 0.01 && inTown;
      m.position.x += (m.userData.speed as number) * dt * (winds.x >= 0 ? 1 : -1);
      if (m.position.x > 40) m.position.x = -6;
      if (m.position.x < -6) m.position.x = 40;
    }
  }

  private applyLight(dark: number, warm: number, murk: number, ms: number, glow: number): void {
    const dayHemi = fixed("#fff4e0");
    const warmHemi = fixed("#ffc89a");
    const nightHemi = fixed("#8fa0ff");
    const daySun = fixed("#fff1d6");
    const warmSun = fixed("#ff9a5c");
    const nightSun = fixed("#9fb0ff");
    const wall = worldWall(ms);
    const hours = wall.hour + wall.minute / 60;
    // Morning on the left, evening on the right; at night the moon takes the same arc.
    const az = Math.max(-1.3, Math.min(1.3, (hours - 13) / 6));
    const flash = this.flashBoost;
    for (const s of this.host.stages) {
      const h = mixCol(mixCol(dayHemi, warmHemi, warm * 0.8), nightHemi, dark ** 1.4);
      const sc = mixCol(mixCol(daySun, warmSun, warm * 0.8), nightSun, dark ** 1.4);
      const grey = (c: THREE.Color) => c.lerp(new THREE.Color(0.7, 0.72, 0.76), murk * 0.5);
      s.hemi.color.copy(grey(h));
      s.sun.color.copy(grey(sc));
      s.hemi.intensity = lerp(1.6, 0.55, dark) * (1 - murk * 0.25) * (1 - warm * 0.08) + flash * 2.4;
      s.sun.intensity = lerp(lerp(2.4, 1.8, warm), 0.35, dark) * (1 - murk * 1.1);
      s.sun.intensity = Math.max(0.15, s.sun.intensity);
      const elev = clamp01(this.opts.light(ms).elevation / 55);
      s.sun.position.set(s.target.x + az * 14, lerp(7, 15, Math.max(elev, dark * 0.6)), s.target.z + 7);
      s.sun.target.position.copy(s.target);
      (s.scene.background as THREE.Color | null)?.copy(mixCol(fixed("#1b1f2a"), fixed("#0f111a"), dark));
    }
    void glow;
  }

  /** Lamps shine in proportion to how dim it is: smoothly, not on and off. */
  private applyPointLights(glow: number, t: number): void {
    const dim = this.dim;
    if (
      Math.abs(glow - this.light.glow) < 0.004 &&
      Math.abs(dim - this.light.dim) < 0.004 &&
      t - this.lightsAt < 1.5
    )
      return;
    this.light.glow = glow;
    this.light.dim = dim;
    setStreetLampDim(dim);
    const refresh = t - this.lightsAt > 1.5;
    if (refresh) this.lightsAt = t;
    for (const s of this.host.stages) {
      let list = this.pointLights.get(s.name);
      if (!list || refresh) {
        list = [];
        s.scene.traverse((o) => {
          if (o instanceof THREE.PointLight && typeof o.userData.night === "number") list!.push(o);
        });
        this.pointLights.set(s.name, list);
      }
      for (const p of list) {
        p.intensity = (p.userData.night as number) * glow * (p.userData.street ? dim : 1);
        p.visible = p.intensity > 0;
      }
    }
  }

  /**
   * Patches what was built since the last pass (a room's batches, just made by `Pipeline.prepare`) now, before its
   * shaders are compiled ahead: left to the next pass, every batch would compile again 1.5 s after being shown.
   */
  rescan(): void {
    this.whiten(this.host.town.scene);
  }

  /** Teach every toon material in `root` to go white on surfaces that face up, scaled by `snowAmt`. */
  private whiten(root: THREE.Object3D): void {
    const uSnow = this.snowAmt;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(mat as THREE.MeshToonMaterial).isMeshToonMaterial || mat.userData.snowy) continue;
        mat.userData.snowy = true;
        addPatch(mat, "snowy", (sh) => {
          sh.uniforms.uSnow = uSnow;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nvarying float vSnowUp;")
            .replace(
              "#include <beginnormal_vertex>",
              "#include <beginnormal_vertex>\n  vSnowUp = normalize(mat3(modelMatrix) * objectNormal).y;",
            );
          sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vSnowUp;\nuniform float uSnow;")
            .replace(
              "#include <dithering_fragment>",
              "#include <dithering_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.94, 0.97, 1.0), smoothstep(0.5, 0.8, vSnowUp) * uSnow * 0.95);",
            );
        });
      }
    });
  }
}
