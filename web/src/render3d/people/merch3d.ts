/**
 * Company merch: a tee, a hoodie, a cap and a mug in a company's colours (its brand's roof and plaque, or a
 * pair picked by its id) with its initials, or the 8x6 print its people drew. Ports web/src/art/merch.ts:
 * `merchColours` is the same palette logic, `merchPrintTexture` / `merchShirtTexture` are textures for the
 * avatar's torso and `merchProp` is the piece on its own (the bag, the shop, the floor).
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { initialsOf, Pen } from "../../art/pixels.ts";
import { canvasTexture, Model, tint } from "../kit/kit.ts";

/** The company bits merch needs (`CompanyInfo` in core/src/world.ts). */
export interface MerchCompany {
  id: number;
  name: string;
  brand: { roof: string; plaque: string } | null;
  merch?: { main: string; accent: string; rows: string[] } | null;
}

export interface MerchColours {
  main: string;
  shade: string;
  accent: string;
  glow: string;
  initials: string;
  /** `.` bare, `a` accent, `w` white, `k` dark; 8 wide, 6 tall. */
  design: string[] | null;
}

/** Companies without a brand get one of these, by id: [main, accent]. */
const PAIRS: [string, string][] = [
  ["#3a6fb8", "#f5d14a"],
  ["#c4544b", "#fbf7ef"],
  ["#3f8c50", "#f4efe4"],
  ["#5b3fbf", "#3ddc84"],
  ["#2c3142", "#f08a3c"],
  ["#e0a15a", "#2b2433"],
  ["#cf6690", "#fbf7ef"],
  ["#1f2a24", "#3ddc84"],
];

export function merchColours(c: MerchCompany): MerchColours {
  if (c.merch)
    return {
      main: c.merch.main,
      shade: tint(c.merch.main, -0.25),
      accent: c.merch.accent,
      glow: tint(c.merch.main, 0.6),
      initials: initialsOf(c.name),
      design: c.merch.rows,
    };
  const [main, accent] = c.brand ? [c.brand.roof, c.brand.plaque] : PAIRS[c.id % PAIRS.length]!;
  // A plaque the colour of the roof would leave the logo invisible.
  const logo = accent.toLowerCase() === main.toLowerCase() ? C.white : accent;
  return {
    main,
    shade: tint(main, -0.25),
    accent: logo,
    glow: tint(main, 0.6),
    initials: initialsOf(c.name),
    design: null,
  };
}

/** The print: the drawing where there is one, else the initials in the accent. Transparent around it. */
export function merchPrintTexture(c: MerchCompany): THREE.CanvasTexture {
  const m = merchColours(c);
  return canvasTexture(8, 6, (g) => {
    const p = new Pen(g);
    if (m.design) p.grid(m.design, { a: m.accent, w: C.white, k: C.ink });
    else p.text(m.initials, Math.round(4 - (m.initials.length * 4 - 1) / 2), 0, m.accent);
  });
}

/** The front of a tee on a 16x16 texture (the torso map): the company's colour, a collar line, the print on the chest. */
export function merchShirtTexture(c: MerchCompany, hoodie = false): THREE.CanvasTexture {
  const m = merchColours(c);
  return canvasTexture(16, 16, (g) => {
    const p = new Pen(g);
    p.rect(0, 0, 16, 16, m.main);
    p.rect(0, 15, 16, 1, m.shade);
    if (hoodie) {
      p.rect(5, 0, 6, 1, m.shade);
      p.px(6, 1, C.white);
      p.px(9, 1, C.white);
      p.rect(4, 11, 8, 1, m.shade);
    } else p.rect(6, 0, 4, 1, m.shade);
    if (m.design) p.grid(m.design, { a: m.accent, w: C.white, k: C.ink }, 4, 3);
    else p.text(m.initials, Math.round(8 - (m.initials.length * 4 - 1) / 2), 4, m.accent);
  });
}

export type MerchKind = "tee" | "hoodie" | "cap" | "mug";

/** A piece of merch on its own, about the size of a small prop, front towards +z. */
export function merchProp(c: MerchCompany, kind: MerchKind): Model {
  const m = merchColours(c);
  const out = new Model();
  const decal = (w: number, h: number, at: [number, number, number]) => {
    const mat = new THREE.MeshToonMaterial({ map: merchPrintTexture(c), transparent: true });
    return out.plane(w, h, mat, at);
  };
  switch (kind) {
    case "tee":
    case "hoodie": {
      const hood = kind === "hoodie";
      // Laid flat: a body, two sleeves, a collar.
      out.box([0.34, 0.42, 0.06], m.main, [0, 0, 0], 0.03);
      for (const s of [-1, 1]) {
        const sleeve = out.box(
          [0.2, hood ? 0.38 : 0.16, 0.055],
          m.main,
          [s * 0.25, hood ? 0.04 : 0.26, 0],
          0.025,
        );
        sleeve.rotation.z = s * -0.5;
        out.box([0.2, 0.03, 0.06], m.shade, [s * 0.3, hood ? 0.0 : 0.22, 0], 0.01).rotation.z = s * -0.5;
      }
      out.box([0.14, 0.03, 0.065], m.shade, [0, 0.4, 0], 0.012);
      if (hood) {
        out.box([0.2, 0.1, 0.07], m.shade, [0, 0.38, -0.01], 0.04);
        out.box([0.01, 0.1, 0.065], C.white, [-0.04, 0.28, 0.005]);
        out.box([0.01, 0.1, 0.065], C.white, [0.04, 0.28, 0.005]);
        out.box([0.24, 0.08, 0.066], m.shade, [0, 0.02, 0.003], 0.02);
      }
      decal(0.2, 0.15, [0, 0.2, 0.034]);
      break;
    }
    case "cap": {
      out.ball(0.17, m.main, [0, 0.1, 0], [1, 0.8, 1], 16);
      out.cyl(0.18, 0.04, m.shade, [0, 0.0, 0], 0.18, 16);
      out.box([0.26, 0.025, 0.2], m.shade, [0, 0.02, 0.2], 0.012);
      out.box([0.025, 0.03, 0.01], C.ink, [0, 0.27, 0]);
      decal(0.14, 0.1, [0, 0.14, 0.158]).rotation.x = -0.2;
      break;
    }
    case "mug": {
      out.cyl(0.11, 0.24, m.main, [0, 0, 0], 0.1, 16);
      out.cyl(0.1, 0.012, m.glow, [0, 0.235, 0], 0.1, 16);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.016, 6, 12),
        new THREE.MeshToonMaterial({ color: m.shade }),
      );
      handle.position.set(0.12, 0.12, 0);
      handle.castShadow = true;
      out.add(handle);
      decal(0.14, 0.1, [0, 0.12, 0.108]);
      break;
    }
  }
  return out;
}
