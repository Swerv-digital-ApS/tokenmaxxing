import { lightAt } from "@tokenmaxxing/core/sky.ts";
import * as THREE from "three";
import { lampDim } from "../../game/grid.ts";
import { skyNow, weatherNow } from "../../game/sky.ts";
import type { GraphicsSettings } from "../../settings/graphics.ts";
import { batchWithoutWarmup, SAMPLE_TIMES } from "../perf/bake.ts";
import type { RoomView } from "../rooms/rooms.ts";
import { easeWalls } from "../rooms/walls.ts";
import { Fx, meltSnow } from "../town/fx3d.ts";
import { isPropsNight } from "../town/props.ts";
import { disposeObject } from "./dispose.ts";
import type { Pipeline } from "./pipeline.ts";
import { PlayerOcclusion, seeThrough } from "./seethrough.ts";

const ROOM_BACKGROUND = "#1b1f2a";
const SHADOW_FAR = 90;

/**
 * A room as the renderer shows it: its scene and lights. Outdoors it also owns the sky: `Fx` (`fx3d.ts`: the
 * sky dome, sun, moon, clouds, weather and lamps) driven by the game's own clock and the server's weather.
 * Indoors the light is fixed, as the 2D game's rooms are (only the town is tinted by the hour).
 */
/** What the stage can ask of the renderer: the clock the room's schedules read, for working out what moves. */
export interface StageHooks {
  clock: (minutes: number | null) => void;
}

/** Hours of the day the batching probe tries (minutes since midnight), so a schedule that moves things shows. */
const PROBE_MINUTES = [120, 450, 690, 750, 870, 1010, 1200];

export class RoomStage {
  readonly scene = new THREE.Scene();
  readonly hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
  readonly sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  /** Where the sun looks: near the player, so shadows follow and weather falls where they are. */
  readonly target = new THREE.Vector3();
  readonly fx: Fx | null;
  readonly occlusion: PlayerOcclusion;
  private reach = 0;
  private darkness = 0;
  private settled = false;

  /** Milliseconds each step of making the stage took (for the debug handle). */
  readonly timing: Record<string, number> = {};

  /** What batching the still parts of the room into few meshes did. */
  batched = { before: 0, after: 0, batches: 0 };

  constructor(
    readonly view: RoomView,
    hooks: StageHooks = { clock: () => {} },
  ) {
    const { scene, sun } = this;
    scene.background = new THREE.Color(ROOM_BACKGROUND);
    sun.userData.sun = true;
    const b = view.bounds;
    this.target.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    sun.target.position.copy(this.target);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = SHADOW_FAR;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.setReach(Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.75);
    this.place();
    scene.add(this.hemi, sun, sun.target, view.group);
    view.lights?.(scene, this.hemi, sun);
    if (view.outdoors) {
      const ref = { name: "Town", scene, sun, hemi: this.hemi, target: this.target };
      this.fx = new Fx(
        {
          stages: [ref],
          town: ref,
          current: () => "Town",
          applyNight: (on) => view.night?.(on),
        },
        { clock: skyNow, weather: weatherNow, light: lightAt, lampDim },
      );
    } else this.fx = null;
    const t0 = performance.now();
    seeThrough(view.group);
    this.occlusion = new PlayerOcclusion(view.group);
    this.timing.see = performance.now() - t0;
    const opened = performance.getEntriesByType("navigation")[0]?.name ?? "";
    if (!opened.includes("nobatch")) this.batch(hooks);
    if (view.extras) scene.add(view.extras);
    this.timing.total = performance.now() - t0;
  }

  /**
   * Flags the room for the pipeline's static batching (`perf/bake.ts`): the still parts become a few merged meshes on the
   * baked shadow layer, the rest (anything under `userData.live` or `nobatch`) stays as built. What moves is found by
   * running the room's own animation through a few hours of the day and states of its lamps (`userData.sample`).
   */
  private batch(hooks: StageHooks): void {
    const { view } = this;
    const toward = new THREE.Vector3();
    const root = view.group;
    let nightBeforeProbe = false;
    root.userData.bake = true;
    root.userData.sample = (t: number) => {
      const i = Math.max(0, SAMPLE_TIMES.indexOf(t));
      if (i === 0) nightBeforeProbe = isPropsNight();
      hooks.clock(PROBE_MINUTES[(i * 2) % PROBE_MINUTES.length]!);
      view.night?.(i % 2 === 1);
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      easeWalls(0.7);
      view.tick(t, 0.7, toward.set(Math.sin(a), 0, Math.cos(a)));
      if (i === SAMPLE_TIMES.length - 1) {
        hooks.clock(null);
        view.night?.(nightBeforeProbe);
        easeWalls(10);
        view.tick(0, 10, toward.set(Math.SQRT1_2, 0, Math.SQRT1_2));
      }
    };
    batchWithoutWarmup(root);
  }

  /** The sun's shadow box, `reach` world units either way. */
  private setReach(reach: number): void {
    if (Math.abs(reach - this.reach) < this.reach * 0.08) return;
    this.reach = reach;
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -reach;
    s.right = s.top = reach;
    s.updateProjectionMatrix();
  }

  private place(): void {
    const { sun, target } = this;
    if (this.view.outdoors) return;
    sun.position.set(target.x - 11, 14, target.z + 7);
    sun.target.position.copy(target);
  }

  /** Shadows on or off, and how sharp (the graphics settings'). */
  applySettings(s: GraphicsSettings): void {
    const on = s.shadowMap > 0;
    if (this.sun.castShadow !== on) this.sun.castShadow = on;
    if (on && this.sun.shadow.mapSize.x !== s.shadowMap) {
      this.sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (this.fx) {
      this.fx.density = s.weather;
      this.fx.calm = s.reduceMotion;
    }
  }

  /**
   * Once a frame. `focus` is the player's spot; `viewHeight` the camera's picture height. Outdoors this runs
   * the sky and returns how dark it is (0 day, 1 night) for the composite's exposure.
   */
  update(
    dt: number,
    t: number,
    focus: THREE.Vector2,
    viewHeight: number,
    camera: THREE.OrthographicCamera,
  ): number {
    this.target.set(focus.x, 0, focus.y);
    this.setReach(Math.max(12, Math.min(34, viewHeight * 1.4)));
    if (this.fx) {
      if (!this.settled) {
        this.settled = true;
        this.fx.settle(t, camera);
      }
      this.fx.spread = Math.max(1, Math.min(2.4, viewHeight / 12));
      this.fx.update(dt, t, camera);
      this.darkness = this.fx.clockDark();
    } else {
      this.place();
      // Indoors nothing is snowed on, though the furniture shares the town's snowy materials.
      meltSnow();
    }
    return this.darkness;
  }

  /** The haze colour at the horizon, when there is a sky. */
  horizon(): THREE.Color | null {
    return this.fx?.hasSky() ? this.fx.horizon() : null;
  }

  dispose(): void {
    this.view.dispose();
    disposeObject(this.scene);
    this.scene.clear();
  }
}

/** Feeds the composite pass what the stage's sky says. */
export function lightPipeline(pipe: Pipeline, stage: RoomStage, dark: number): void {
  const horizon = stage.horizon();
  pipe.night = dark;
  if (horizon) {
    pipe.gradient = false;
    pipe.hazeColor.copy(horizon);
  } else {
    pipe.gradient = true;
    pipe.skyTop.set(ROOM_BACKGROUND);
    pipe.skyHor.set("#252a38");
    pipe.hazeColor.copy(pipe.skyHor);
  }
}
