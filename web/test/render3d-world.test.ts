import { expect, test } from "bun:test";
import type { PinView } from "@tokenmaxxing/core/collection.ts";
import { SIREN, TICKET_MARK } from "@tokenmaxxing/core/cop.ts";
import { lineup, weekOf } from "@tokenmaxxing/core/merchant.ts";
import { BLANKETS } from "@tokenmaxxing/core/picnic.ts";
import { earnedBy, signature, sigOf, watchShelf } from "../src/render3d/furniture/trophies3d.ts";
import {
  burstCap,
  CART_SIGN_AWAY,
  CART_SIGN_HERE,
  CHASE_MS,
  CopWatch,
  chipsOf,
  crossed,
  goodsColors,
  grassSpot,
  isGrassNotice,
  jukeboxSign,
  polseSign,
  ShowcaseCache,
  snailSign,
  tavernDim,
  tossLanded,
} from "../src/render3d/town/world-logic.ts";

test("the cop's siren starts with his pull-over line and goes out a minute later", () => {
  const w = new CopWatch();
  expect(w.read("", 1000)).toEqual({ siren: false, writing: false });
  expect(w.read(`${SIREN} @dax pull over!`, 2000)).toEqual({ siren: true, writing: false });
  // The line is gone from his bubble: the chase goes on.
  expect(w.read("", 30_000).siren).toBe(true);
  expect(w.read("", 2000 + CHASE_MS + 1).siren).toBe(false);
});

test("writing the ticket keeps the siren on and shows the pad, and ends the chase clock", () => {
  const w = new CopWatch();
  w.read(`${SIREN} @dax pull over!`, 2000);
  expect(w.read(`${SIREN}${TICKET_MARK} Failure to /compact at 290M tokens/hour.`, 9000)).toEqual({
    siren: true,
    writing: true,
  });
  // Once the ticket line is gone, so is the siren (the chase was over when he wrote it).
  expect(w.read("", 10_000)).toEqual({ siren: false, writing: false });
  expect(w.read("Nothing to see here.", 11_000).siren).toBe(false);
});

test("the cart's goods are four colours from this week's editions", () => {
  const colours = goodsColors(lineup(weekOf(Date.UTC(2026, 9, 23, 12))));
  expect(colours).toHaveLength(4);
  for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  expect(goodsColors([])).toHaveLength(4);
  expect(CART_SIGN_HERE).not.toBe(CART_SIGN_AWAY);
});

test("street signs and the snail's finish", () => {
  expect(polseSign(true)).toContain("Gratis");
  expect(polseSign(false)).toContain("Lukket");
  expect(snailSign("queued")).toBe("queued");
  expect(snailSign("deployed")).toBe("✓ deployed");
  // The finish fires once, for a page that saw the minute go by.
  expect(crossed(1019.9, 1020.1, 1020)).toBe(true);
  expect(crossed(1020.1, 1020.2, 1020)).toBe(false);
  expect(crossed(null, 1020.1, 1020)).toBe(false);
  expect(crossed(600, 1100, 1020)).toBe(false);
});

test("the picnic's grass notice and blankets", () => {
  expect(
    isGrassNotice(
      "🧺 I was there. The outage picnic is on your card now, and 🌱 Touched grass is in your bag for your office.",
    ),
  ).toBe(true);
  expect(isGrassNotice("Someone's already there.")).toBe(false);
  expect(isGrassNotice(undefined)).toBe(false);
  const b = BLANKETS[0]!;
  expect(grassSpot(b.x, b.y)).toBe(true);
  expect(grassSpot(0, 0)).toBe(false);
});

test("a toss only lands when the server says plink", () => {
  expect(tossLanded("⛲ Plink. You toss a coin in and wish for a green CI.")).toBe(true);
  expect(tossLanded("⛲ One coin at a time.")).toBe(false);
  expect(tossLanded("⛲ Not a coin to spare right now.")).toBe(false);
  expect(tossLanded(undefined)).toBe(false);
});

test("the jukebox sign says who put it on and the skip votes", () => {
  expect(jukeboxSign(null, null)).toContain("pick a track");
  expect(jukeboxSign({ byName: "bo", votes: 1, need: 2 }, "🎷 Smooth")).toBe("🎷 Smooth · on by bo · ⏭ 1/2");
});

test("the Tavern dims with the sky but never goes black", () => {
  expect(tavernDim(0, 0)).toBe(0);
  expect(tavernDim(1, 0)).toBeCloseTo(0.66);
  expect(tavernDim(1, 1)).toBe(0.7);
});

const flush = () => new Promise((r) => setTimeout(r, 0));

const pin = (
  kind: PinView["kind"],
  id: string,
  frame: PinView["frame"] = null,
  emoji: string | null = "🏅",
): PinView => ({
  id,
  kind,
  name: id,
  emoji,
  tier: 1,
  frame,
  rarity: "common",
  at: 1,
});

test("showcase pins become a tag's badge and trophy chips", () => {
  const { badges, trophies } = chipsOf([
    pin("badge", "badge:shipper", "gold"),
    pin("trophy", "trophy:3am", null, null),
    pin("title", "title:30"),
  ]);
  expect(badges).toEqual([{ emoji: "🏅", title: "badge:shipper", frame: "gold" }]);
  expect(trophies).toEqual([{ emoji: undefined, title: "trophy:3am" }]);
});

test("showcases are asked one at a time, slowly, never for bots, and kept", async () => {
  const asked: number[] = [];
  const cache = new ShowcaseCache({
    every: 1000,
    fetch: async (id) => {
      asked.push(id);
      return id === 9 ? Promise.reject(new Error("no")) : [pin("badge", "badge:streak", "silver")];
    },
  });
  cache.want(-3, 0);
  cache.want(5, 0);
  // Busy: a second ask while the first is in flight is dropped.
  cache.want(6, 10);
  await flush();
  expect(asked).toEqual([5]);
  expect(cache.get(5)?.chips.badges[0]?.frame).toBe("silver");
  // Too soon after the last request.
  cache.want(6, 500);
  expect(asked).toEqual([5]);
  cache.want(6, 1500);
  cache.want(5, 5000);
  await flush();
  // 5 is still fresh: only 6 was asked.
  expect(asked).toEqual([5, 6]);
  // A failure is left alone for a while.
  cache.want(9, 9000);
  await flush();
  cache.want(9, 10_000);
  expect(asked.filter((id) => id === 9)).toHaveLength(1);
  expect(cache.get(9)).toBeNull();
});

test("a trophy shelf is asked for once a minute and its signature follows what is on it", async () => {
  expect(sigOf([{ id: "b" }, { id: "a" }])).toBe("a,b");
  expect(signature(77)).toBe("");
  let calls = 0;
  const ask = async () => {
    calls++;
    return [{ id: "3am", day: "2026-10-01" }];
  };
  watchShelf(77, 0, ask);
  watchShelf(77, 100, ask);
  await flush();
  expect(calls).toBe(1);
  expect(earnedBy(77).has("3am")).toBe(true);
  expect(signature(77)).toBe("3am");
  watchShelf(77, 30_000, ask);
  expect(calls).toBe(1);
  watchShelf(77, 61_000, ask);
  expect(calls).toBe(2);
});

test("bunting is two meshes whatever its length", async () => {
  const { buntingMeshes } = await import("../src/render3d/town/bunting3d.ts");
  const g = buntingMeshes([
    { a: [0, 2, 0], b: [10, 2, 0], sag: 0.5 },
    { a: [0, 2, 4], b: [10, 2, 4], sag: 0.5 },
  ]);
  const meshes: unknown[] = [];
  g.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes.push(o);
  });
  expect(meshes).toHaveLength(2);
});

test("emoji bursts are capped by the tier's particle density", () => {
  expect(burstCap(1)).toBe(10);
  expect(burstCap(0.5)).toBe(5);
  expect(burstCap(0)).toBe(2);
  expect(burstCap(9)).toBe(10);
});
