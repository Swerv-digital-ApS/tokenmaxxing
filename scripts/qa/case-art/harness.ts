// Browser entry for the 2D case-art contact sheets (see sheets.mjs). Builds one <canvas id="sheet-..."> per group
// from the real art modules, so what you see is what the game draws. ?case=ragnarok-eve | night-market, ?scale=4.
import { caseAt } from "../../../core/src/case.ts";
import { casePieceOf } from "../../../core/src/case-furniture.ts";
import { caseById } from "../../../core/src/cases.ts";
import { FISHING_ITEMS } from "../../../core/src/fishing-loot.ts";
import { defaultLook, type Look } from "../../../core/src/world.ts";
import { CA_H, CA_MS, CA_W, CA_X, CA_Y, caseAuraFrame } from "../../../web/src/art/case-aura.ts";
import { CASE_BOX_FRAMES, CASE_BOX_SIZE, caseBoxSprite } from "../../../web/src/art/case-box.ts";
import { characterFrame, itemFrame } from "../../../web/src/art/characters.ts";
import { fancyPiece, fancySprite } from "../../../web/src/art/furniture-fancy.ts";
import { petFrame } from "../../../web/src/art/pets.ts";

const q = new URLSearchParams(location.search);
const caseId = q.get("case") ?? "ragnarok-eve";
const S = Number(q.get("scale") ?? 4);
// `?case=pond`: the pond's treasures (`fishing-loot.ts`), which have no case and no box.
const def = caseId === "pond" ? { name: "Pond treasures", items: FISHING_ITEMS } : caseById(caseId)!;

type Sprite = HTMLCanvasElement;
interface Cell {
  label: string;
  sprites: (Sprite | null)[];
  bg?: string;
}

const base: Look = { ...defaultLook(1), skin: 0, hair: 1, style: 0, outfit: 3 };
const look = (over: Partial<Look>): Look => ({ ...base, ...over });
const pad = 6;

function sheet(id: string, title: string, cells: Cell[], cols: number, bg: string): void {
  const spriteMax = (c: Cell) => c.sprites.reduce((a, s) => a + (s ? s.width * S + pad : 0), 0);
  const cellW = Math.max(110, ...cells.map(spriteMax)) + pad;
  const cellH = Math.max(16, ...cells.flatMap((c) => c.sprites.map((s) => (s ? s.height * S : 0)))) + 36;
  const rows = Math.ceil(cells.length / cols);
  const cv = document.createElement("canvas");
  cv.id = `sheet-${id}`;
  cv.width = cols * cellW;
  cv.height = rows * cellH + 24;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#1c2230";
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#fff";
  g.font = "bold 13px sans-serif";
  g.fillText(title, 6, 16);
  cells.forEach((c, i) => {
    const x0 = (i % cols) * cellW;
    const y0 = 24 + Math.floor(i / cols) * cellH;
    g.fillStyle = c.bg ?? bg;
    g.fillRect(x0 + 2, y0 + 2, cellW - 4, cellH - 4);
    let x = x0 + pad;
    for (const s of c.sprites) {
      if (!s) continue;
      g.drawImage(s, x, y0 + 6, s.width * S, s.height * S);
      x += s.width * S + pad;
    }
    g.fillStyle = "#111";
    g.font = "11px sans-serif";
    g.fillText(c.label, x0 + 6, y0 + cellH - 8);
  });
  document.body.append(cv);
}

const items = (slot: string) => def.items.filter((i) => i.slot === slot);
const LAND = "#cfd3c4";

// Character views: front, side, back (and the second walking frame when it differs).
const views = (l: Look): Sprite[] => [
  characterFrame(l, "down", "stand"),
  characterFrame(l, "right", "stand"),
  characterFrame(l, "up", "stand"),
];

for (const slot of ["hat", "glasses", "outfit", "held", "back"] as const) {
  const cells = items(slot).map((it): Cell => {
    const key = slot as "hat";
    const l = look({ [key]: it.index } as Partial<Look>);
    const sp = [...views(l)];
    if (slot === "back") sp.push(characterFrame(l, "right", "walkB"));
    sp.push(itemFrame(it));
    return { label: `${it.id} ${it.name}`, sprites: sp };
  });
  if (cells.length) sheet(slot, `${def.name}: ${slot}`, cells, slot === "back" ? 2 : 3, LAND);
}

// Pets: both frames alone, then beside an owner.
{
  const cells = items("pet").map((it): Cell => {
    const l = look({ pet: it.index });
    return {
      label: `${it.id} ${it.name}`,
      sprites: [
        petFrame(it.index, false, false),
        petFrame(it.index, false, true),
        characterFrame(l, "right", "stand"),
        petFrame(it.index, false, false),
      ],
    };
  });
  if (cells.length) sheet("pets", `${def.name}: pets (frame 0, frame 1, with owner)`, cells, 2, LAND);
}

// Auras: eight frames on a dark sky, character in the middle.
{
  const cells: Cell[] = [];
  for (const it of items("aura")) {
    const l = look({ aura: it.index });
    for (const half of [0, 4]) {
      const sp: Sprite[] = [];
      for (let f = half; f < half + 4; f++) {
        const fr = caseAuraFrame(it.index, f * CA_MS);
        const cv = document.createElement("canvas");
        cv.width = CA_W;
        cv.height = CA_H;
        const g = cv.getContext("2d")!;
        if (fr) g.drawImage(fr, 0, 0);
        g.drawImage(characterFrame(l, "down", "stand"), CA_X, CA_Y);
        sp.push(cv);
      }
      cells.push({ label: `${it.id} ${it.name} frames ${half}-${half + 3}`, sprites: sp });
    }
  }
  if (cells.length) sheet("auras", `${def.name}: auras`, cells, 2, "#27304a");
}

// Furniture: every frame.
{
  const cells = def.items
    .filter((i) => i.slot === "furniture")
    .map((i): Cell => {
      const p = casePieceOf(i.id.slice(5))!;
      const a = fancyPiece(p.art);
      const sp = a ? Array.from({ length: a.frames }, (_, f) => fancySprite(p.art, f)) : [];
      return { label: `${p.art} ${p.name} (${a?.frames ?? 0}f)`, sprites: sp };
    });
  if (cells.length) sheet("furniture", `${def.name}: furniture`, cells, 2, "#8a7a62");
}

// The box: closed, open (two frames), key; also at the game's 3x for the opening screen.
if (caseId !== "pond") {
  const sp = (k: "closed" | "open" | "key", f: number) => caseBoxSprite(k, f, caseId);
  sheet(
    "box",
    `${def.name}: box and key`,
    [
      { label: "closed", sprites: [sp("closed", 0)] },
      { label: "open 0", sprites: [sp("open", 0)] },
      { label: "open 1", sprites: [sp("open", 1)] },
      { label: "key", sprites: [sp("key", 0)] },
    ],
    4,
    "#3a4560",
  );
}
void CASE_BOX_FRAMES;
void CASE_BOX_SIZE;
void caseAt;
document.title = "ready";
