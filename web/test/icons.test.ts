import { expect, test } from "bun:test";
import { IconQueue, LruCache } from "../src/render3d/icon-queue.ts";

/** A queue whose clock and frames we drive by hand; `cost` is how long each render pretends to take. */
function harness(budgetMs = 4, cost = 1.5) {
  let clock = 0;
  const frames: (() => void)[] = [];
  const log: string[] = [];
  const cache = new LruCache<string>(100, 1e9, () => 1);
  const q = new IconQueue<string>(
    cache,
    (key) => {
      log.push(key);
      clock += cost;
      return `img:${key}`;
    },
    { budgetMs, now: () => clock, schedule: (fn) => frames.push(fn) },
  );
  const frame = () => {
    const fns = frames.splice(0);
    for (const f of fns) f();
  };
  return { q, cache, log, frame, frames, tick: (ms: number) => (clock += ms) };
}

test("the LRU keeps the most recent, within the entry and cost caps, and tells what it drops", () => {
  const gone: number[] = [];
  const c = new LruCache<number>(
    3,
    10,
    (v) => v,
    (v) => gone.push(v),
  );
  c.set("a", 1);
  c.set("b", 2);
  c.set("c", 3);
  expect(c.get("a")).toBe(1); // a is now the most recent
  c.set("d", 4); // four entries: the oldest (b) goes
  expect(c.get("b")).toBeUndefined();
  expect(gone).toEqual([2]);
  expect(c.size).toBe(3);
  c.set("e", 6); // 1 + 3 + 4 + 6 = 14 > 10: c and a go until it fits
  expect(c.cost).toBeLessThanOrEqual(10);
  expect(c.get("e")).toBe(6);
  expect(gone).toEqual([2, 3, 1]);
  c.set("e", 7); // replacing frees the old value; 4 + 7 is over the cap, so d goes too
  expect(gone).toEqual([2, 3, 1, 6, 4]);
  expect(c.cost).toBe(7);
});

test("a frame renders until the budget is spent, at least one, and the rest wait for the next", async () => {
  const h = harness(4, 1.5);
  const got = Array.from({ length: 7 }, (_, i) => h.q.request(`k${i}@64v`).promise);
  expect(h.frames.length).toBe(1); // scheduled once, not per request
  h.frame();
  // 1.5 + 1.5 + 1.5 = 4.5 ≥ 4 after the third: three this frame.
  expect(h.log).toEqual(["k0@64v", "k1@64v", "k2@64v"]);
  expect(h.q.pending).toBe(4);
  expect(h.frames.length).toBe(1);
  h.frame();
  h.frame();
  expect(h.log.length).toBe(7);
  expect(await Promise.all(got)).toEqual(Array.from({ length: 7 }, (_, i) => `img:k${i}@64v`));
  expect(h.q.stats.frames).toBe(3);
  expect(h.q.stats.maxFrameMs).toBe(4.5);
  expect(h.q.stats.maxIconMs).toBe(1.5);
});

test("one slow icon still goes through on its own frame", () => {
  const h = harness(4, 30);
  h.q.request("slow");
  h.q.request("next");
  h.frame();
  expect(h.log).toEqual(["slow"]);
  h.frame();
  expect(h.log).toEqual(["slow", "next"]);
});

test("the same key asked twice is drawn once, and a hit is answered without a frame", async () => {
  const h = harness();
  const a = h.q.request("x");
  const b = h.q.request("x");
  h.frame();
  expect(h.log).toEqual(["x"]);
  expect(await a.promise).toBe("img:x");
  expect(await b.promise).toBe("img:x");
  const c = h.q.request("x");
  expect(h.frames.length).toBe(0);
  expect(await c.promise).toBe("img:x");
  expect(h.log).toEqual(["x"]);
});

test("cancelling the last asker drops the job; cancelling one of two does not", () => {
  const h = harness();
  const a = h.q.request("shared");
  const b = h.q.request("shared");
  const lone = h.q.request("lone");
  a.cancel();
  a.cancel(); // twice is harmless
  lone.cancel();
  expect(h.q.pending).toBe(1);
  h.frame();
  expect(h.log).toEqual(["shared"]);
  b.cancel(); // after the fact: nothing to drop
  expect(h.cache.get("shared")).toBe("img:shared");
});

test("a render that throws rejects its askers and the queue carries on", async () => {
  let clock = 0;
  const frames: (() => void)[] = [];
  const q = new IconQueue<string>(
    new LruCache<string>(10, 1e9, () => 1),
    (key) => {
      if (key === "bad") throw new Error("no model");
      return `img:${key}`;
    },
    { budgetMs: 4, now: () => clock++, schedule: (fn) => frames.push(fn) },
  );
  const bad = q.request("bad").promise;
  const good = q.request("good").promise;
  for (const f of frames.splice(0)) f();
  await expect(bad).rejects.toThrow("no model");
  expect(await good).toBe("img:good");
});

test("paused (a lost context) nothing is drawn; resumed, the backlog drains", () => {
  const h = harness();
  h.q.request("a");
  h.q.pause();
  h.frame();
  expect(h.log).toEqual([]);
  h.q.request("b");
  expect(h.frames.length).toBe(0);
  h.q.resume();
  h.frame();
  expect(h.log).toEqual(["a", "b"]);
});
