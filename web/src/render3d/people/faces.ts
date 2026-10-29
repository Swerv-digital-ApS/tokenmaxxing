/**
 * Faces, painted: every expression drawn once on a canvas, in each style's ink, and wrapped onto heads,
 * muzzles and screens. Changing a face is swapping a texture.
 */
import * as THREE from "three";
import { tint } from "../kit/kit.ts";

export type Expression = "neutral" | "happy" | "laugh" | "surprised" | "love" | "wink" | "focus" | "sleep";
/** What's drawn: an expression, or a frame of one (mid-blink, mid-word). */
export type Face = Expression | "blink" | "talk";

/** The colours a face is drawn in, per style. */
interface Ink {
  line: string;
  eye: string;
  iris?: string;
  shine?: string;
  mouth: string;
  tongue?: string;
  blush?: string;
  heart: string;
  /** A neon glow round every stroke (the bots' screens). */
  glow?: string;
  /** Eyes this much the size of the chibi's. */
  eyeSize: number;
  /** Eye width and height before `eyeSize`: a chibi's are tall ovals, a grown-up's rounder. */
  eyeShape?: [number, number];
  /** An upper lid over each eye, which reads as older. */
  lid?: boolean;
  brow?: number;
}

const INKS = {
  chibi: {
    line: "#2b2433",
    eye: "#2b2433",
    iris: "#5a4a7a",
    shine: "#ffffff",
    mouth: "#7a2a3a",
    tongue: "#ff8a9a",
    blush: "rgba(242, 120, 160, 0.45)",
    heart: "#ff4f8b",
    eyeSize: 1,
  },
  animal: {
    line: "#2b2433",
    eye: "#1b1520",
    shine: "#ffffff",
    mouth: "#6a2430",
    tongue: "#ff8a9a",
    blush: "rgba(242, 120, 160, 0.4)",
    heart: "#ff4f8b",
    eyeSize: 0.62,
  },
  adult: {
    line: "#2b2433",
    eye: "#231c2a",
    shine: "#ffffff",
    mouth: "#6a2a34",
    tongue: "#e86a7a",
    heart: "#ff4f8b",
    eyeSize: 0.8,
    eyeShape: [10, 11],
    lid: true,
    brow: 5,
  },
  bot: {
    line: "#8fe3ff",
    eye: "#8fe3ff",
    mouth: "#8fe3ff",
    heart: "#ff7ab6",
    glow: "#3fb8ff",
    eyeSize: 1,
  },
} satisfies Record<string, Ink>;

/** Which face set a decal shows: a style's whole face, or only its eyes, or only its mouth (on a muzzle). */
export type FaceKind = PaintedKind | VoxelKind;
type PaintedKind = "chibi" | "adult" | "bot" | "animal-eyes" | "adult-eyes" | "animal-mouth";
/** Pixel faces for voxel heads: the whole face, or the eyes and the mouth apart (for a muzzle). */
type VoxelKind = "voxel" | "voxel-eyes" | "voxel-mouth";

/** Draws a face on a 256×128 canvas, as it wraps the front of the head: eyes, brows, mouth, blush. */
function drawFace(
  g: CanvasRenderingContext2D,
  face: Face,
  ink: Ink,
  parts: { eyes: boolean; mouth: boolean },
): void {
  const [lx, rx, ey, my] = [92, 164, 66, 96];
  const INK = ink.line;
  g.lineCap = g.lineJoin = "round";
  if (ink.glow) {
    g.shadowColor = ink.glow;
    g.shadowBlur = 10;
  }
  if (ink.blush && parts.eyes) {
    g.fillStyle = ink.blush;
    for (const x of [lx - 26, rx + 26]) {
      g.beginPath();
      g.ellipse(x, ey + 22, 13, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const [ew, eh] = ink.eyeShape ?? [12, 18];
  const eye = (x: number, big = 1) => {
    big *= ink.eyeSize;
    g.fillStyle = ink.eye;
    g.beginPath();
    if (ink.glow) g.roundRect(x - 10 * big, ey - 16 * big, 20 * big, 32 * big, 8 * big);
    else g.ellipse(x, ey, ew * big, eh * big, 0, 0, Math.PI * 2);
    g.fill();
    if (ink.lid) {
      g.strokeStyle = ink.line;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, ey + 2, (ew + 4) * big, (eh + 3) * big, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
    }
    if (ink.iris) {
      g.fillStyle = ink.iris;
      g.beginPath();
      g.ellipse(x, ey + 7 * big, 9 * big, 9 * big, 0, 0, Math.PI);
      g.fill();
    }
    if (ink.shine) {
      // Grown-ups get one small glint; chibis two big ones.
      const r = ink.lid ? 3 : 5.5;
      g.fillStyle = ink.shine;
      g.beginPath();
      g.arc(x + 4 * big, ey - 4 * big, r * big, 0, Math.PI * 2);
      if (!ink.lid) g.arc(x - 3 * big, ey + 6 * big, 2 * big, 0, Math.PI * 2);
      g.fill();
    }
  };
  const arc = (x: number, up: boolean) => {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    if (up) g.arc(x, ey + 6, 11, Math.PI * 1.15, Math.PI * 1.85);
    else g.arc(x, ey - 6, 11, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  };
  const brows = (lift: number, tilt = 0) => {
    g.strokeStyle = ink.glow ? INK : tint(INK, 0.15);
    g.lineWidth = ink.brow ?? 4;
    for (const [x, s] of [
      [lx, -1],
      [rx, 1],
    ] as const) {
      g.beginPath();
      g.moveTo(x - 10, ey - 24 - lift + s * tilt);
      g.lineTo(x + 10, ey - 24 - lift - s * tilt);
      g.stroke();
    }
  };
  const heart = (x: number) => {
    g.fillStyle = ink.heart;
    g.beginPath();
    g.moveTo(x, ey + 12);
    g.bezierCurveTo(x - 18, ey, x - 12, ey - 16, x, ey - 6);
    g.bezierCurveTo(x + 12, ey - 16, x + 18, ey, x, ey + 12);
    g.fill();
    if (ink.shine) {
      g.fillStyle = ink.shine;
      g.beginPath();
      g.arc(x + 5, ey - 5, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  };
  const smile = (w: number, open = false) => {
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    if (open) {
      g.fillStyle = ink.mouth;
      g.moveTo(128 - w, my - 2);
      g.quadraticCurveTo(128, my + w * 1.6, 128 + w, my - 2);
      g.closePath();
      g.fill();
      g.stroke();
      if (ink.tongue) {
        g.fillStyle = ink.tongue;
        g.beginPath();
        g.ellipse(128, my + w * 0.55, w * 0.45, w * 0.25, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.arc(128, my - w * 0.6, w, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
    }
  };
  const flat = (w: number) => {
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(128 - w, my);
    g.lineTo(128 + w, my);
    g.stroke();
  };
  const oh = (r: number) => {
    g.fillStyle = ink.mouth;
    g.strokeStyle = INK;
    g.lineWidth = 3.5;
    g.beginPath();
    g.ellipse(128, my + 2, r * 0.8, r, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  // A decal that only shows eyes skips the mouth, and the other way round.
  const draw = { eye, arc, brows, heart, smile, flat, oh };
  if (!parts.eyes) draw.eye = draw.arc = draw.brows = draw.heart = () => {};
  if (!parts.mouth) draw.smile = draw.flat = draw.oh = () => {};
  paint(face, draw, lx, rx, ey, g, INK, parts.eyes);
}

interface Strokes {
  eye: (x: number, big?: number) => void;
  arc: (x: number, up: boolean) => void;
  brows: (lift: number, tilt?: number) => void;
  heart: (x: number) => void;
  smile: (w: number, open?: boolean) => void;
  flat: (w: number) => void;
  oh: (r: number) => void;
}

/** Each expression, as strokes. */
function paint(
  face: Face,
  { eye, arc, brows, heart, smile, flat, oh }: Strokes,
  lx: number,
  rx: number,
  ey: number,
  g: CanvasRenderingContext2D,
  INK: string,
  eyes: boolean,
): void {
  switch (face) {
    case "neutral":
      brows(0);
      eye(lx);
      eye(rx);
      smile(9);
      break;
    case "talk":
      brows(1);
      eye(lx);
      eye(rx);
      oh(7);
      break;
    case "blink":
      brows(0);
      arc(lx, false);
      arc(rx, false);
      smile(9);
      break;
    case "happy":
      brows(3);
      arc(lx, true);
      arc(rx, true);
      smile(12, true);
      break;
    case "laugh":
      brows(5, -2);
      if (eyes)
        for (const [x, s] of [
          [lx, 1],
          [rx, -1],
        ] as const) {
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(x - 9 * s, ey - 10);
          g.lineTo(x + 7 * s, ey);
          g.lineTo(x - 9 * s, ey + 10);
          g.stroke();
        }
      smile(17, true);
      break;
    case "surprised":
      brows(9);
      eye(lx, 1.2);
      eye(rx, 1.2);
      oh(9);
      break;
    case "love":
      brows(3);
      heart(lx);
      heart(rx);
      smile(11, true);
      break;
    case "wink":
      brows(2, 2);
      eye(lx);
      arc(rx, true);
      smile(12);
      break;
    case "focus":
      brows(-2, 3);
      eye(lx, 0.85);
      eye(rx, 0.85);
      // Lids halfway down.
      g.strokeStyle = INK;
      g.lineWidth = 4;
      if (eyes)
        for (const x of [lx, rx]) {
          g.beginPath();
          g.moveTo(x - 12, ey - 4);
          g.lineTo(x + 12, ey - 4);
          g.stroke();
        }
      flat(7);
      break;
    case "sleep":
      arc(lx, false);
      arc(rx, false);
      oh(4);
      break;
  }
}

/**
 * How each kind is laid out: drawn `scale` times bigger than `drawFace` lays it out, about the point
 * (128, `from`), which lands at (128, `y`).
 */
const LAYOUTS: Record<
  PaintedKind,
  { ink: Ink; scale: number; y: number; from: number; eyes: boolean; mouth: boolean }
> = {
  // Big and a touch low: big eyes, biggest on a chibi.
  chibi: { ink: INKS.chibi, scale: 1.6, y: 70, from: 64, eyes: true, mouth: true },
  bot: { ink: INKS.bot, scale: 1.35, y: 70, from: 64, eyes: true, mouth: true },
  adult: { ink: INKS.adult, scale: 1.25, y: 66, from: 64, eyes: true, mouth: true },
  "animal-eyes": { ink: INKS.animal, scale: 1.3, y: 64, from: 64, eyes: true, mouth: false },
  "adult-eyes": { ink: INKS.adult, scale: 1.3, y: 64, from: 64, eyes: true, mouth: false },
  // The mouth alone, big, high on the decal: it sits under the nose on a small muzzle.
  "animal-mouth": { ink: INKS.animal, scale: 1.9, y: 74, from: 96, eyes: false, mouth: true },
};

// ——— Voxel faces: pixel art on the 7×7 front of a voxel head, two pixels to a voxel ———
const PX = 14;
const PIXEL = {
  eye: "#1b1520",
  shine: "#ffffff",
  brow: "#2b2028",
  mouth: "#5a1f2a",
  teeth: "#ffffff",
  tongue: "#ff8a9a",
  heart: "#ff4f8b",
};

/**
 * One expression, in pixels: the eyes on the fourth voxel row from the top (pixels 6–7), either side
 * of a nose voxel, and the mouth on the sixth (pixels 10–11).
 */
function drawVoxelFace(g: CanvasRenderingContext2D, face: Face, eyes: boolean, mouth: boolean): void {
  const dot = (color: string, ...xy: number[]) => {
    g.fillStyle = color;
    for (let i = 0; i < xy.length; i += 2) g.fillRect(xy[i]!, xy[i + 1]!, 1, 1);
  };
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const E = PIXEL.eye;
  // Each pair is drawn for the left eye at `x` and mirrored for the right.
  const both = (draw: (x: number, side: number) => void) => {
    draw(3, 1);
    draw(9, -1);
  };
  const open = (h = 2) =>
    both((x) => {
      rect(E, x, 8 - h, 2, h);
      dot(PIXEL.shine, x + 1, 8 - h);
    });
  const brows = (y = 4, slant = 0) =>
    both((x, side) => {
      rect(PIXEL.brow, x - (side > 0 ? 1 : 0), y, 3, 1);
      if (slant) dot(PIXEL.brow, side > 0 ? x + 1 : x, y + slant);
    });
  const smile = (wide = false) => {
    const [l, r] = wide ? [4, 9] : [5, 8];
    dot(PIXEL.mouth, l, 10, r, 10);
    rect(PIXEL.mouth, l + 1, 11, r - l - 1, 1);
  };
  const grin = () => {
    rect(PIXEL.teeth, 5, 10, 4, 1);
    rect(PIXEL.mouth, 5, 11, 4, 1);
  };
  const happyEyes = (x: number) => dot(E, x - 1, 7, x, 6, x + 1, 6, x + 2, 7);
  if (eyes)
    switch (face) {
      case "neutral":
      case "talk":
        brows();
        open();
        break;
      case "blink":
        brows();
        rect(E, 3, 7, 2, 1);
        rect(E, 9, 7, 2, 1);
        break;
      case "happy":
        brows(3);
        both(happyEyes);
        break;
      case "laugh":
        brows(3);
        dot(E, 3, 5, 4, 6, 3, 7);
        dot(E, 10, 5, 9, 6, 10, 7);
        break;
      case "surprised":
        brows(2);
        both((x) => {
          rect(E, x, 5, 2, 3);
          dot(PIXEL.shine, x + 1, 5);
        });
        break;
      case "love":
        brows(3);
        both((x) => {
          dot(PIXEL.heart, x - 1, 5, x + 1, 5);
          rect(PIXEL.heart, x - 1, 6, 3, 1);
          dot(PIXEL.heart, x, 7);
        });
        break;
      case "wink":
        brows(3);
        rect(E, 3, 6, 2, 2);
        dot(PIXEL.shine, 4, 6);
        happyEyes(9);
        break;
      case "focus":
        brows(4, 1);
        rect(E, 3, 7, 2, 1);
        rect(E, 9, 7, 2, 1);
        break;
      case "sleep":
        rect(E, 2, 7, 3, 1);
        rect(E, 9, 7, 3, 1);
        break;
    }
  if (mouth)
    switch (face) {
      case "neutral":
      case "blink":
      case "wink":
        smile();
        break;
      case "talk":
        rect(PIXEL.mouth, 6, 10, 2, 2);
        break;
      case "happy":
      case "love":
        grin();
        break;
      case "laugh":
        rect(PIXEL.teeth, 4, 10, 6, 1);
        rect(PIXEL.mouth, 5, 11, 4, 2);
        rect(PIXEL.tongue, 6, 12, 2, 1);
        break;
      case "surprised":
        rect(PIXEL.mouth, 6, 10, 2, 3);
        break;
      case "focus":
        rect(PIXEL.mouth, 5, 11, 4, 1);
        break;
      case "sleep":
        rect(PIXEL.mouth, 6, 11, 2, 1);
        break;
    }
}

function pixelTexture(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PX;
  draw(canvas.getContext("2d")!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

let glassesTexture: THREE.CanvasTexture | undefined;
/** Square frames round both eyes, to lay over a voxel face. */
export function voxelGlasses(): THREE.CanvasTexture {
  glassesTexture ??= pixelTexture((g) => {
    g.strokeStyle = "#1b1520";
    g.lineWidth = 1;
    for (const x of [2, 8]) g.strokeRect(x + 0.5, 5.5, 3, 3);
    g.fillStyle = "#1b1520";
    for (const x of [0, 6, 12]) g.fillRect(x, 6, 2, 1);
  });
  return glassesTexture;
}

const faces = new Map<string, THREE.CanvasTexture>();
/** A face, drawn once per expression and kind. */
export function faceTexture(face: Face, kind: FaceKind): THREE.CanvasTexture {
  const key = `${kind}:${face}`;
  let t = faces.get(key);
  if (!t) {
    if (kind === "voxel" || kind === "voxel-eyes" || kind === "voxel-mouth") {
      t = pixelTexture((g) => drawVoxelFace(g, face, kind !== "voxel-mouth", kind !== "voxel-eyes"));
      t.userData.shared = true;
      faces.set(key, t);
      return t;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext("2d")!;
    const { ink, scale, y, from, eyes, mouth } = LAYOUTS[kind];
    g.translate(128, y);
    g.scale(scale, scale);
    g.translate(-128, -from);
    drawFace(g, face, ink, { eyes, mouth });
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.shared = true;
    faces.set(key, t);
  }
  return t;
}
