/**
 * The app icon, in pixel art on a 32×32 grid: a tiny round world with a house and a tree, and a lightning
 * bolt striking past it, on a night sky in the macOS rounded square (Apple's 824/1024 grid). Every size is
 * drawn from the grid with whole pixels, so it stays crisp. Writes the Mac app's icons (src-tauri/icons)
 * and the website's (site/public).
 *
 *   bun app/desktop/scripts/icon.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const N = 32;
const ROOT = join(import.meta.dir, "../../..");

// The town's palette (web/src/art/palette.ts), plus the night sky.
const COLORS: Record<string, string> = {
  k: "#2b2433", // ink
  g: "#86c35e", // grass
  G: "#6aa84a", // grass, shade
  D: "#4f8a3a", // grass, night side
  a: "#3d4a7c", // atmosphere
  L: "#a5d977", // grass, light
  w: "#58a9e2", // water
  W: "#a8dcf7", // water, light
  p: "#e6cc98", // path
  r: "#d9574a", // roof
  R: "#b0443a", // roof, shade
  h: "#f1e6d2", // wall
  H: "#dccbad", // wall, shade
  d: "#8c5c36", // door
  l: "#ffe28a", // lit window
  t: "#80563a", // trunk
  e: "#4f9b3d", // leaves
  E: "#72bf52", // leaves, light
  y: "#ffd35c", // bolt
  Y: "#fff2a8", // bolt, light
  o: "#e0a23a", // bolt, shade
  s: "#fbf7ef", // star
  S: "#8a93c9", // faint star
};
const SKY = ["#34406b", "#2b3559", "#232b48", "#1c2238", "#171c2d"];

const HOUSE = ["...k...", "..krk..", ".krrRk.", "krrrRRk", ".khlhk.", ".khhdk."];
const TREE = [".kk.", "kEek", "keek", ".kk.", ".t.."];
const BOLT = [
  "....kkkkkk",
  "...kYYyyyk",
  "...kYyyyk.",
  "..kYyyyk..",
  "..kYyyyk..",
  ".kYyyyk...",
  ".kYyyyykkk",
  "kYyyyyyyyk",
  "kkkkkyyyok",
  "....kyyok.",
  "...kyyok..",
  "...kyok...",
  "..kyok....",
  "..kok.....",
  ".kok......",
  ".kk.......",
];

type Grid = (string | null)[][];

function draw(): Grid {
  const grid: Grid = Array.from({ length: N }, () => Array<string | null>(N).fill(null));
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < N && y < N && ch !== ".") grid[y]![x] = COLORS[ch]!;
  };
  const sprite = (rows: string[], x0: number, y0: number) =>
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) put(x0 + dx, y0 + dy, row[dx]!);
    });

  // The rounded square, cells 3..28 (26 cells: 832 of 1024), corners of radius 6.
  const [lo, hi, r] = [3, 29, 5];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [px, py] = [x + 0.5, y + 0.5];
      const cx = Math.min(Math.max(px, lo + r), hi - r);
      const cy = Math.min(Math.max(py, lo + r), hi - r);
      if (px < lo || px > hi || py < lo || py > hi || Math.hypot(px - cx, py - cy) > r) continue;
      // Night sky in bands, dithered where they meet.
      const t = ((y - lo) / (hi - lo)) * (SKY.length - 1);
      const band = Math.floor(t) + ((x + y) % 2 === 0 && t % 1 > 0.6 ? 1 : 0);
      grid[y]![x] = SKY[Math.min(band, SKY.length - 1)]!;
    }
  for (const [x, y, ch] of [
    [6, 6, "s"],
    [8, 4, "S"],
    [15, 5, "S"],
    [5, 12, "S"],
    [26, 22, "S"],
    [24, 25, "s"],
    [4, 18, "s"],
  ] as const)
    put(x, y, ch);

  // The world: a round planet lit from the top left, a pond, a path and flowers.
  const [wx, wy, wr] = [13, 20, 7.6];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [dx, dy] = [(x + 0.5 - wx) / wr, (y + 0.5 - wy) / wr];
      const d = Math.hypot(dx, dy);
      if (d > 1 + 1.2 / wr) continue;
      if (d > 1) {
        if (grid[y]![x] && SKY.includes(grid[y]![x]!)) put(x, y, "a");
        continue;
      }
      if (d > 1 - 1 / wr) {
        put(x, y, "k");
        continue;
      }
      const light = -dx * 0.6 - dy * 0.8;
      put(x, y, light > 0.45 ? "L" : light > -0.15 ? "g" : light > -0.55 ? "G" : "D");
    }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (Math.hypot((x + 0.5 - 10) / 2.4, (y + 0.5 - 22) / 1.4) <= 1) put(x, y, y <= 21 ? "W" : "w");
  for (const [x, y] of [
    [13, 14],
    [14, 15],
    [14, 16],
    [15, 17],
    [15, 18],
  ] as const)
    put(x, y, "p");
  put(16, 23, "l");
  put(8, 17, "r");
  put(12, 25, "s");

  // A house and a tree standing on top, and the bolt striking past on the right.
  sprite(TREE, 6, 11);
  sprite(HOUSE, 10, 8);
  sprite(BOLT, 17, 4);
  return grid;
}

// MARK: Output

/** RGBA pixels at `size` (a multiple of 32: whole pixels per cell; 16 averages 2×2 cells). */
function pixels(grid: Grid, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const scale = size / N;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cells: (string | null)[] = [];
      const [x0, y0] = [Math.floor(x / scale), Math.floor(y / scale)];
      const span = Math.max(1, Math.round(1 / scale));
      for (let j = 0; j < span; j++) for (let i = 0; i < span; i++) cells.push(grid[y0 + j]![x0 + i]!);
      let [r, g, b, a] = [0, 0, 0, 0];
      for (const c of cells)
        if (c) {
          r += Number.parseInt(c.slice(1, 3), 16);
          g += Number.parseInt(c.slice(3, 5), 16);
          b += Number.parseInt(c.slice(5, 7), 16);
          a += 255;
        }
      const solid = cells.filter(Boolean).length;
      const at = (y * size + x) * 4;
      out.set(solid ? [r / solid, g / solid, b / solid, a / cells.length] : [0, 0, 0, 0], at);
    }
  return out;
}

function png(rgba: Uint8Array, size: number): Buffer {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    rows.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(Bun.hash.crc32(Buffer.concat([head.subarray(4), data])) >>> 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** One rect per run of same-coloured cells: crisp at any size in a browser. */
function svg(grid: Grid): string {
  const rects: string[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < N;) {
      const c = row[x];
      let end = x + 1;
      while (end < N && row[end] === c) end++;
      if (c) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${c}"/>`);
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges"><title>Tokenmaxxing</title>${rects.join("")}</svg>\n`;
}

const grid = draw();
const write = (path: string, size: number) => writeFileSync(join(ROOT, path), png(pixels(grid, size), size));

const icons = "app/desktop/src-tauri/icons";
write(`${icons}/32x32.png`, 32);
write(`${icons}/128x128.png`, 128);
write(`${icons}/128x128@2x.png`, 256);
write(`${icons}/icon.png`, 1024);
const iconset = join(mkdtempSync(join(tmpdir(), "icon-")), "icon.iconset");
execFileSync("mkdir", [iconset]);
for (const size of [16, 32, 128, 256, 512]) {
  writeFileSync(join(iconset, `icon_${size}x${size}.png`), png(pixels(grid, size), size));
  writeFileSync(join(iconset, `icon_${size}x${size}@2x.png`), png(pixels(grid, size * 2), size * 2));
}
execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(ROOT, `${icons}/icon.icns`)]);
rmSync(join(iconset, ".."), { recursive: true });

writeFileSync(join(ROOT, "site/public/icon.svg"), svg(grid));
write("site/public/icon.png", 512);
console.log("icons written");
