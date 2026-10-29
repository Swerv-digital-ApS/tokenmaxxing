import { expect, test } from "bun:test";
import { coloursOf, merchKey, setMerchCompanies } from "../src/art/merch.ts";
import { iconKey } from "../src/render3d/icon-key.ts";
import { lookFrom2D, merchFor } from "../src/render3d/people/gear3d.ts";

const brand = { roof: "#1d3557", wall: "#f1faee", trim: "#457b9d", plaque: "#e63946", logo: null };
const rows = ["aaaaaaaa", "a......a", "a.wwww.a", "a.wwww.a", "a......a", "aaaaaaaa"];

test("merch worn in 3D is the company's own: its colours, initials and print, as in 2D and the shop", () => {
  setMerchCompanies([
    { id: 3, name: "Serpier", brand },
    { id: 4, name: "Drawn Co", brand: null, merch: { main: "#202020", accent: "#ff8800", rows } },
  ]);
  expect(merchFor(3)).toEqual({
    main: "#1d3557",
    shade: expect.any(String),
    accent: "#e63946",
    initials: "SE",
    design: null,
  });
  expect(merchFor(4)).toMatchObject({ main: "#202020", accent: "#ff8800", initials: "DC", design: rows });
  // The tee is the company's colour on the body too.
  expect(lookFrom2D({ style: 0, skin: 0, hair: 0, outfit: 0, merch: 3, merchWorn: 1 }).outfit[0]).toBe(
    "#1d3557",
  );
  // A company the world hasn't heard of still gets a pair by its id.
  expect(merchFor(99).initials).toBe("TM");
});

test("a company the world doesn't have is dressed the same in 2D, in 3D and in the shop", () => {
  setMerchCompanies([]);
  for (const id of [3, 99, 1000]) {
    const gone = merchFor(id);
    expect(coloursOf(id)).toMatchObject({ main: gone.main, accent: gone.accent, initials: gone.initials });
  }
  // It keeps a pair by its id, not a grey one, and no two ids of one pair share a cache key by accident.
  expect(coloursOf(99).main).not.toBe(coloursOf(0).main);
  expect(merchKey(99)).not.toBe(merchKey(98));
});

test("a character in merch is another icon when the company redraws it, or closes", () => {
  const look = { style: 0, skin: 0, hair: 0, outfit: 0, merch: 3, merchWorn: 1 };
  const key = () => iconKey({ kind: "avatar", look });
  setMerchCompanies([{ id: 3, name: "Serpier", brand }]);
  const brandKey = key();
  setMerchCompanies([{ id: 3, name: "Serpier", brand, merch: { main: "#202020", accent: "#ff8800", rows } }]);
  const drawnKey = key();
  expect(drawnKey).not.toBe(brandKey);
  setMerchCompanies([]);
  const goneKey = key();
  expect(goneKey).not.toBe(drawnKey);
  // Nothing worn, nothing to go stale.
  const bare = iconKey({ kind: "avatar", look: { ...look, merch: 0, merchWorn: 0 } });
  setMerchCompanies([{ id: 3, name: "Serpier", brand }]);
  expect(iconKey({ kind: "avatar", look: { ...look, merch: 0, merchWorn: 0 } })).toBe(bare);
});
