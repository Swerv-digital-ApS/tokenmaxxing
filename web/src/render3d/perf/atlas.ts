import * as THREE from "three";

/**
 * Small painted textures (a sign, a price tag, a poster: 16 to 256 px, sampled without smoothing) folded into one
 * atlas per batch, so a room's textured props merge into one draw call per material setup instead of one per picture.
 * Close-ups keep nearest sampling; independently painted mip levels smooth distant pictures without bleeding. Only
 * unrepeated, unrotated canvases whose UVs stay inside 0..1 are folded; a
 * texture that repaints often (a screen) is left alone (`userData.animated`).
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  rects: Map<THREE.Texture, Rect>;
  /** The version each member had when it was painted in, to notice a repaint. */
  seen: Map<THREE.Texture, number>;
  repaints: number;
}

const MAX_EDGE = 256;
const MAX_ATLAS = 2048;
const MIP_LEVELS = 4;
// Nearest sampling within each mip needs slots aligned through the smallest level.
const ALIGNMENT = 2 ** (MIP_LEVELS - 1);
const PADDING = 1;
const aligned = (n: number): number => Math.ceil(n / ALIGNMENT) * ALIGNMENT;

interface Canvasish {
  width: number;
  height: number;
  getContext?: unknown;
}

export function atlasable(t: THREE.Texture | null | undefined): t is THREE.Texture {
  if (!t?.isTexture || t.userData.animated || (t as unknown as { isVideoTexture?: boolean }).isVideoTexture)
    return false;
  const img = t.image as Canvasish | null;
  if (!img || typeof img.getContext !== "function" || !(img.width > 0) || !(img.height > 0)) return false;
  if (img.width > MAX_EDGE || img.height > MAX_EDGE) return false;
  return (
    t.magFilter === THREE.NearestFilter &&
    t.minFilter === THREE.NearestFilter &&
    !t.generateMipmaps &&
    t.colorSpace === THREE.SRGBColorSpace &&
    t.flipY &&
    t.offset.x === 0 &&
    t.offset.y === 0 &&
    t.repeat.x === 1 &&
    t.repeat.y === 1 &&
    t.rotation === 0
  );
}

const uvBounds = new WeakMap<THREE.BufferGeometry, boolean>();
/** Whether a geometry's UVs stay inside the picture (a tiled floor does not: it needs the texture's own wrap). */
export function uvInside(g: THREE.BufferGeometry): boolean {
  let ok = uvBounds.get(g);
  if (ok === undefined) {
    const uv = g.getAttribute("uv");
    ok = !!uv;
    if (uv)
      for (let i = 0; i < uv.count && ok; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) ok = false;
      }
    uvBounds.set(g, ok);
  }
  return ok;
}

/** Packs the textures along a skyline, tallest first; returns null when fewer than two fit (nothing to gain). */
export function packAtlas(textures: THREE.Texture[]): Atlas | null {
  const list = [...new Set(textures)].sort(
    (a, b) => (b.image as Canvasish).height - (a.image as Canvasish).height,
  );
  if (list.length < 2) return null;
  let side = 128;
  const total = list.reduce(
    (n, t) =>
      n +
      aligned((t.image as Canvasish).width + PADDING * 2) *
        aligned((t.image as Canvasish).height + PADDING * 2),
    0,
  );
  while (side * side < total && side < MAX_ATLAS) side *= 2;
  const rects = new Map<THREE.Texture, Rect>();
  for (; ; side *= 2) {
    rects.clear();
    const skyline = new Uint16Array(side / ALIGNMENT);
    let fit = true;
    for (const t of list) {
      const { width: w, height: h } = t.image as Canvasish;
      const columns = aligned(w + PADDING * 2) / ALIGNMENT;
      const slotH = aligned(h + PADDING * 2);
      let x = 0;
      let y = side;
      for (let start = 0; start + columns <= skyline.length; start++) {
        let top = 0;
        for (let i = start; i < start + columns; i++) top = Math.max(top, skyline[i]!);
        if (top < y) {
          x = start;
          y = top;
        }
      }
      if (y + slotH > side) {
        fit = false;
        break;
      }
      rects.set(t, { x: x * ALIGNMENT + PADDING, y: y + PADDING, w, h });
      skyline.fill(y + slotH, x, x + columns);
    }
    // Whatever does not fit in the biggest atlas keeps its own texture.
    if (fit || side >= MAX_ATLAS) break;
  }
  if (rects.size < 2) return null;
  let h = 1;
  for (const r of rects.values()) h = Math.max(h, r.y - PADDING + aligned(r.h + PADDING * 2));
  const height = Math.min(side, aligned(h));
  const width = side;
  const levels = Array.from({ length: MIP_LEVELS }, (_, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = width / 2 ** i;
    canvas.height = height / 2 ** i;
    return canvas;
  });
  const seen = new Map<THREE.Texture, number>();
  for (const [t, r] of rects) {
    paintTile(levels, t, r);
    seen.set(t, t.version);
  }
  const texture = new THREE.CanvasTexture(levels[0]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  // Stop before neighbouring slots merge. Immutable WebGL storage clamps sampling to these allocated levels.
  texture.mipmaps = levels;
  texture.generateMipmaps = false;
  return { texture, width, height, rects, seen, repaints: 0 };
}

/** Rebuild each tile's mip levels from its own image, including an extruded border at every level. */
function paintTile(levels: HTMLCanvasElement[], texture: THREE.Texture, r: Rect): void {
  const image = texture.image as CanvasImageSource;
  const tile = document.createElement("canvas");
  tile.width = aligned(r.w + PADDING * 2);
  tile.height = aligned(r.h + PADDING * 2);
  const g = tile.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const xs = [0, PADDING, PADDING + r.w, tile.width];
  const ys = [0, PADDING, PADDING + r.h, tile.height];
  const sx = [0, 0, r.w - 1];
  const sy = [0, 0, r.h - 1];
  const sw = [1, r.w, 1];
  const sh = [1, r.h, 1];
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++)
      g.drawImage(
        image,
        sx[x]!,
        sy[y]!,
        sw[x]!,
        sh[y]!,
        xs[x]!,
        ys[y]!,
        xs[x + 1]! - xs[x]!,
        ys[y + 1]! - ys[y]!,
      );

  // Resample a complete tile, so fractional content edges cannot leave seams between drawImage calls.
  for (let level = 0; level < levels.length; level++) {
    const scale = 2 ** level;
    const dest = levels[level]!.getContext("2d")!;
    const x = (r.x - PADDING) / scale;
    const y = (r.y - PADDING) / scale;
    const w = tile.width / scale;
    const h = tile.height / scale;
    dest.clearRect(x, y, w, h);
    dest.imageSmoothingEnabled = level > 0;
    dest.drawImage(tile, x, y, w, h);
  }
}

/** The atlas version of a picture's UVs, exact: nearest sampling lands on the same texel. */
export function remapUv(g: THREE.BufferGeometry, r: Rect, atlas: Atlas): void {
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const e = 0.001;
  for (let i = 0; i < uv.count; i++) {
    const px = Math.min(r.w - e, Math.max(e, uv.getX(i) * r.w));
    const py = Math.min(r.h - e, Math.max(e, (1 - uv.getY(i)) * r.h));
    uv.setXY(i, (r.x + px) / atlas.width, 1 - (r.y + py) / atlas.height);
  }
  uv.needsUpdate = true;
}

/** Paints in whatever a member texture repainted since; returns how many did. */
export function syncAtlas(a: Atlas): number {
  let n = 0;
  for (const [t, r] of a.rects) {
    if (a.seen.get(t) === t.version) continue;
    a.seen.set(t, t.version);
    paintTile(a.texture.mipmaps as HTMLCanvasElement[], t, r);
    n++;
  }
  if (n) {
    a.texture.needsUpdate = true;
    a.repaints += n;
  }
  return n;
}
