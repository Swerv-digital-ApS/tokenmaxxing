import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { climbOf, type Fireworks, fireworksOn, rocketsAt, sparkAt, sparkFade } from "../src/fireworks.ts";
import { LEGEND, MAPS, PLAZA } from "../src/maps.ts";
import {
  GITHUB_REPO,
  milestoneOf,
  NO_STARS,
  nextMilestone,
  readStars,
  STAR_COUNTER,
  STAR_SHOW_MS,
  starFireworks,
  starsFrom,
} from "../src/stars.ts";

test("the repo is the one package.json names", () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf8"));
  expect(pkg.repository.url).toBe(`https://github.com/${GITHUB_REPO}`);
});

test("the counter stands on the square, in the way, with its own legend", () => {
  const [at, ...more] = MAPS.town.find(STAR_COUNTER);
  expect(more).toEqual([]);
  const [x, y] = at!;
  expect(x > PLAZA.left && x < PLAZA.right && y > PLAZA.top && y < PLAZA.bottom).toBe(true);
  expect(MAPS.town.walkable(x, y)).toBe(false);
  expect(MAPS.town.walkable(x, y + 1)).toBe(true);
  expect(LEGEND[STAR_COUNTER]?.name).toBe("star counter");
});

test("milestones go 100, 250, 500, then the same times ten", () => {
  expect(
    [0, 99, 100, 249, 250, 499, 500, 999, 1000, 2499, 2500, 9999, 10_000, 26_000].map(milestoneOf),
  ).toEqual([0, 0, 100, 100, 250, 250, 500, 500, 1000, 1000, 2500, 5000, 10_000, 25_000]);
  expect([0, 1, 100, 250, 999, 1000, 7500].map(nextMilestone)).toEqual([
    100, 100, 250, 500, 1000, 2500, 10_000,
  ]);
});

test("GitHub's answer gives the stars, or nothing", () => {
  expect(starsFrom({ full_name: GITHUB_REPO, stargazers_count: 412 })).toBe(412);
  for (const bad of [
    null,
    {},
    { stargazers_count: "412" },
    { stargazers_count: -1 },
    { stargazers_count: 1.5 },
  ])
    expect(starsFrom(bad)).toBeNull();
});

test("the first read notes the milestone already passed, without fireworks", () => {
  expect(readStars(NO_STARS, 312, 1)).toEqual({ count: 312, celebrated: 250, show: null });
  expect(readStars(NO_STARS, 3, 1)).toEqual({ count: 3, celebrated: 0, show: null });
  // A failed read keeps what was there.
  expect(readStars(NO_STARS, null, 1)).toBe(NO_STARS);
});

test("passing a milestone sets off fireworks once, even if the count dips and comes back", () => {
  let s = readStars(NO_STARS, 98, 1);
  s = readStars(s, 99, 2);
  expect(s.show).toBeNull();
  s = readStars(s, 101, 3);
  expect(s).toEqual({ count: 101, celebrated: 100, show: { milestone: 100, at: 3 } });
  s = readStars(s, 99, 4);
  s = readStars(s, 100, 5);
  expect(s).toEqual({ count: 100, celebrated: 100, show: { milestone: 100, at: 3 } });
  // A jump past two at once celebrates the higher.
  expect(readStars(s, 600, 6).show).toEqual({ milestone: 500, at: 6 });
});

test("a show's rockets are the same for everyone, go up, burst and fade within the show", () => {
  const show: Fireworks = starFireworks({ milestone: 500, at: 10_000 });
  expect(rocketsAt(show, 9_999)).toEqual([]);
  const mid = 10_000 + STAR_SHOW_MS / 2;
  expect(rocketsAt(show, mid)).toEqual(rocketsAt({ ...show }, mid));
  expect(rocketsAt(show, mid).length).toBeGreaterThan(3);
  for (const r of rocketsAt(show, mid)) {
    expect(Math.abs(r.x - show.x)).toBeLessThanOrEqual(show.w);
    expect(Math.abs(r.y - show.y)).toBeLessThanOrEqual(show.h);
    expect(climbOf(r)).toBeLessThanOrEqual(r.height);
    if (r.burst !== null) expect(r.burst).toBeLessThan(1);
  }
  // The finale sends them up in pairs.
  const finale = 10_000 + STAR_SHOW_MS - 1_000;
  expect(rocketsAt(show, finale).length).toBeGreaterThan(rocketsAt(show, mid).length);
  // A while after the last one goes up, the sky is empty again.
  expect(fireworksOn(show, 10_000 + STAR_SHOW_MS + 5_000)).toBe(false);
  expect(rocketsAt(show, 10_000 + STAR_SHOW_MS + 5_000)).toEqual([]);
});

test("a burst's sparks start together, fly out to its radius and fade", () => {
  const show = starFireworks({ milestone: 100, at: 0 });
  const r = rocketsAt(show, 0 + 2_000).find((r) => r.burst !== null)!;
  const start = { ...r, burst: 0 };
  expect(sparkAt(start, 3).map((n) => Math.round(n * 1e6) / 1e6)).toEqual([0, 0, 0]);
  const late = { ...r, burst: 0.99 };
  for (let i = 0; i < r.sparks; i++) {
    const [x, , z] = sparkAt(late, i);
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(r.radius + 1e-9);
  }
  expect(sparkFade(start)).toBe(1);
  expect(sparkFade(late)).toBeLessThan(0.05);
});
