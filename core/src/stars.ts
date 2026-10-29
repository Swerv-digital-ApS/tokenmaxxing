/**
 * The star counter on the square (`★` in `maps.ts`): the project's own GitHub stars. `world` reads them
 * a few times an hour (`server/src/github-stars.ts`) and sends them to everyone (the `stars` event).
 * When the count passes a milestone (100, 250, 500, 1000, 2500…) the town sets off fireworks over the
 * square for everyone online. The last milestone celebrated is kept in `world`'s state, so a restart
 * never sets off the same one again, and neither does a count that dips under one and comes back.
 */
import { COLOURS as FIREWORK_COLOURS, type Fireworks } from "./fireworks.ts";
import { PLAZA } from "./maps.ts";

/** The repo, as in `package.json`'s `repository` and the git remote. */
export const GITHUB_REPO = "HansKristoffer/tokenmaxxing";
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;
/** GitHub's REST API for the repo: `stargazers_count` is the stars. */
export const STARS_API = `https://api.github.com/repos/${GITHUB_REPO}`;

/** The counter's map tile. */
export const STAR_COUNTER = "★";

/** A milestone being celebrated: which, and when the fireworks went up (ms). */
export interface StarShow {
  milestone: number;
  at: number;
}

/** What `world` sends: the count (null until it has been read once) and the last celebration. */
export interface Stars {
  count: number | null;
  show: StarShow | null;
}

/** What `world` keeps: `Stars`, and the last milestone celebrated (null before the first read ever). */
export interface StarsState extends Stars {
  celebrated: number | null;
}

export const NO_STARS: StarsState = { count: null, show: null, celebrated: null };

/** 1, 2.5 and 5 of each power of ten from 100: 100, 250, 500, 1000, 2500, 5000, 10 000… */
const STEPS = [1, 2.5, 5];

/** The highest milestone `count` has reached, or 0 below the first. */
export function milestoneOf(count: number): number {
  let reached = 0;
  for (let decade = 100; ; decade *= 10)
    for (const step of STEPS) {
      if (step * decade > count) return reached;
      reached = step * decade;
    }
}

/** The next milestone above `count`. */
export function nextMilestone(count: number): number {
  for (let decade = 100; ; decade *= 10)
    for (const step of STEPS) if (step * decade > count) return step * decade;
}

/** `stargazers_count` from GitHub's answer for a repo, or null when the answer isn't one. */
export function starsFrom(json: unknown): number | null {
  const n = (json as { stargazers_count?: unknown } | null)?.stargazers_count;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * The state after a read of `count` at `now` (null: the read failed, nothing changes). The first read
 * ever only notes the milestone already reached: the fireworks are for passing one while the town is up.
 */
export function readStars(prev: StarsState, count: number | null, now: number): StarsState {
  if (count === null) return prev;
  const reached = milestoneOf(count);
  if (prev.celebrated === null) return { ...prev, count, celebrated: reached };
  if (reached > prev.celebrated) return { count, celebrated: reached, show: { milestone: reached, at: now } };
  return { ...prev, count };
}

/** How long the rockets keep going up for a milestone. */
export const STAR_SHOW_MS = 45_000;

/** The fireworks for a milestone: over the whole square, gold first among the colours. */
export const starFireworks = (show: StarShow): Fireworks => ({
  at: show.at,
  ms: STAR_SHOW_MS,
  x: (PLAZA.left + PLAZA.right) / 2,
  y: (PLAZA.top + PLAZA.bottom) / 2,
  w: (PLAZA.right - PLAZA.left) / 2 - 1,
  h: (PLAZA.bottom - PLAZA.top) / 2 - 1,
  seed: show.milestone,
  colours: ["#ffd23f", "#ffe98a", ...FIREWORK_COLOURS],
});

/** What the town says when the fireworks go up. */
export const milestoneLine = (milestone: number): string =>
  `🎆 Tokenmaxxing just passed ${milestone.toLocaleString("en-US")} stars on GitHub! Fireworks over the square. ⭐ Add yours at the star counter.`;
