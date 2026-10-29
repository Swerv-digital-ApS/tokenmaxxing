import { hostAccent, type Keynote, SCREEN, signOf, startsIn, whenText } from "@tokenmaxxing/core/keynote.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { keynoteScreen } from "../../game/keynote.ts";
import { serverNow } from "../../game/world.ts";
import { hud } from "../../store.ts";
import { Model } from "../kit/kit.ts";
import { type Panel, panel } from "../kit/panel.ts";
import type { Room } from "./room.ts";
import type { LiveFrame } from "./rooms.ts";

/**
 * The keynote watch party in the 3D Tavern (the 2D one is `game/keynote.ts`): while one is on, a projector
 * screen pulled down on the west wall over the stage with the event's slide, a projector hanging over the
 * crowd and its beam; before it, the screen rolled up and a poster under it. A sign over it opens the panel.
 */

const FONT = "ui-monospace, Menlo, Consolas, monospace";
/** The screen, in world units: the five tiles of wall beside the stage, less a margin. */
const W = SCREEN.h - 0.5;
const H = 1.3;
const LIFT = 1.0;
/** The roller's housing sits on the cloth's frame, under the wall's top (2.6). */
const HOUSING_Y = LIFT + H + 0.12;
/** The projector, in room units: over the crowd (`CROWD`), level with the screen's middle. */
const PROJECTOR = new THREE.Vector3(5.5, 2.25, 0);

/** Words of `s` wrapped to lines no wider than `max` px in the canvas's current font. */
function wrap(g: CanvasRenderingContext2D, s: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return [...lines, line];
}

/** The slide on the screen: a band in the host's colour, the title, who's presenting, LIVE and where to watch. */
function slideDraw(k: Keynote): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    const accent = hostAccent(k.host);
    g.fillStyle = "#f4f7fc";
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.fillRect(0, 0, w, h * 0.16);
    g.fillRect(0, h * 0.94, w, h * 0.06);
    g.textBaseline = "top";
    g.textAlign = "left";
    g.fillStyle = C.white;
    g.font = `bold ${Math.round(h * 0.09)}px ${FONT}`;
    g.fillText(k.host.toUpperCase(), w * 0.04, h * 0.035);
    // LIVE, top right: a red pill.
    const live = "● LIVE";
    const lw = g.measureText(live).width + h * 0.06;
    g.fillStyle = "#e8434b";
    g.fillRect(w * 0.96 - lw, h * 0.025, lw, h * 0.11);
    g.fillStyle = C.white;
    g.textAlign = "right";
    g.fillText(live, w * 0.96 - h * 0.03, h * 0.035);
    g.textAlign = "left";
    g.fillStyle = C.ink;
    g.font = `bold ${Math.round(h * 0.15)}px ${FONT}`;
    for (const [i, line] of wrap(g, k.title, w * 0.9)
      .slice(0, 3)
      .entries())
      g.fillText(line, w * 0.05, h * (0.26 + i * 0.18));
    g.fillStyle = "#5b6170";
    g.font = `bold ${Math.round(h * 0.075)}px ${FONT}`;
    g.fillText(`▶ ${new URL(k.url).hostname.replace(/^www\./, "")}`, w * 0.05, h * 0.8);
  };
}

/** The poster under the rolled-up screen: WATCH PARTY, the title, when, in the host's colour. */
function posterDraw(k: Keynote, now: number): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    const accent = hostAccent(k.host);
    g.fillStyle = C.white;
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.fillRect(0, 0, w, h * 0.22);
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = C.white;
    g.font = `bold ${Math.round(h * 0.09)}px ${FONT}`;
    g.fillText("WATCH PARTY", w / 2, h * 0.06);
    g.fillStyle = C.ink;
    g.font = `bold ${Math.round(h * 0.1)}px ${FONT}`;
    for (const [i, line] of wrap(g, k.title, w * 0.88)
      .slice(0, 3)
      .entries())
      g.fillText(line, w / 2, h * (0.3 + i * 0.12));
    g.fillStyle = accent;
    g.font = `bold ${Math.round(h * 0.075)}px ${FONT}`;
    g.fillText(whenText(k.startsAt, now), w / 2, h * 0.72);
    g.fillStyle = "#5b6170";
    g.fillText(startsIn(k.startsAt, now), w / 2, h * 0.84);
  };
}

/** The projector: a grey box on a rod from the ceiling, its lens (+z) towards the screen. */
function projector(): Model {
  const m = new Model();
  m.box([0.04, 0.5, 0.04], C.ink, [0, 0.12, 0], 0.01);
  m.box([0.36, 0.14, 0.3], "#5b6170", [0, 0, 0], 0.03);
  m.box([0.36, 0.02, 0.3], "#8d93a3", [0, 0.13, 0], 0.01);
  m.cyl(0.05, 0.06, C.ink, [0, 0.07, 0.16], 0.05, 10).rotation.x = Math.PI / 2;
  return m;
}

export class KeynoteScreen {
  /** On the wall: lowered with it when the camera looks over it. */
  private readonly wall = new THREE.Group();
  private readonly cloth: Panel;
  private readonly poster: Panel;
  private readonly housing = new Model();
  private readonly projector = projector();
  private readonly beam: THREE.Mesh;
  private el: HTMLDivElement | null = null;
  /** Where the sign goes, over the housing (in the room, then the world once the room is placed). */
  private readonly at = new THREE.Vector3();
  private placed = false;
  private key = "";
  private sign = "";

  constructor(private readonly room: Room) {
    // The west wall (x 0) beside the stage: map tiles y 10 to 14 are room z 8 to 12.
    const z = SCREEN.y - 2 + SCREEN.h / 2;
    this.wall.position.set(0, 0, z);
    this.wall.rotation.y = Math.PI / 2;
    this.housing.box([W + 0.3, 0.16, 0.16], "#3b3450", [0, HOUSING_Y, 0.1], 0.04);
    this.housing.box([0.08, 0.2, 0.2], C.ink, [-(W + 0.3) / 2, HOUSING_Y - 0.02, 0.1], 0.02);
    this.housing.box([0.08, 0.2, 0.2], C.ink, [(W + 0.3) / 2, HOUSING_Y - 0.02, 0.1], 0.02);
    this.cloth = panel(W, H, () => {}, { frame: "#2b2433", lift: LIFT, px: 90, lit: true, smooth: true });
    this.cloth.position.z = 0.08;
    this.poster = panel(0.8, 1.05, () => {}, { frame: C.ink, lift: 1.05, px: 110, smooth: true });
    this.poster.position.z = 0.06;
    this.wall.add(this.housing, this.cloth, this.poster);
    room.group.add(this.wall);
    room.attachToWall([1, 0], this.wall);
    // The projector over the crowd, and its beam: a faint pyramid from the lens to the screen's corners.
    this.projector.position.set(PROJECTOR.x, PROJECTOR.y, z);
    this.projector.rotation.y = -Math.PI / 2;
    const lens: [number, number, number] = [PROJECTOR.x - 0.2, PROJECTOR.y + 0.07, z];
    const x = 0.12;
    const corners = [
      [x, LIFT + 0.1, z - W / 2],
      [x, LIFT + 0.1, z + W / 2],
      [x, LIFT + H, z + W / 2],
      [x, LIFT + H, z - W / 2],
    ];
    const pos = [lens, ...corners].flat();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    this.beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: "#fff6dc",
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.beam.renderOrder = 2;
    room.group.add(this.projector, this.beam);
    this.at.set(0.3, HOUSING_Y + 0.3, z);
    this.show(null, 0);
  }

  /** Up, down or rolled away, and the face repainted when what it says has changed. */
  private show(s: ReturnType<typeof keynoteScreen>, now: number): void {
    const live = s?.live ?? false;
    this.wall.visible = s !== null;
    this.cloth.visible = live;
    this.poster.visible = s !== null && !live;
    this.projector.visible = live;
    this.beam.visible = live;
    if (!s) return;
    // The poster's "in 3 h" changes by the minute; the slide only with the keynote.
    const key = JSON.stringify([s.live, s.keynote, live ? 0 : Math.floor(now / 60_000)]);
    if (key === this.key) return;
    this.key = key;
    if (live) this.cloth.redraw(slideDraw(s.keynote));
    else this.poster.redraw(posterDraw(s.keynote, now));
  }

  update(f: LiveFrame): void {
    const now = serverNow();
    const s = keynoteScreen();
    this.show(s, now);
    if (s?.live)
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.02 * Math.sin(f.now / 170);
    if (!s) {
      if (this.el) this.el.style.display = "none";
      return;
    }
    if (!this.placed) {
      this.room.group.updateWorldMatrix(true, false);
      this.room.group.localToWorld(this.at);
      this.placed = true;
    }
    if (!this.el) {
      this.el = f.overlay.make("r3-sign link");
      this.el.addEventListener("click", () => hud.set({ panel: { kind: "keynote" } }));
    }
    const sign = signOf(s, now);
    if (sign !== this.sign) {
      this.sign = sign;
      this.el.textContent = sign;
    }
    f.overlay.place(this.el, this.at, f.camera, 0, 0, !s.live);
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
    this.beam.geometry.dispose();
    (this.beam.material as THREE.Material).dispose();
  }
}
