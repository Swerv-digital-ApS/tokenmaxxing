import { expect, test } from "bun:test";
import { BARKEEP } from "../src/barkeep.ts";
import { BOTS, lineFor } from "../src/bots.ts";
import {
  ANNOUNCE_MS,
  CHEERS,
  CROWD,
  facesScreen,
  forcedKeynotes,
  hostAccent,
  isScreen,
  type Keynote,
  keynoteTalk,
  liveKeynote,
  nextKeynote,
  SCREEN,
  sameKeynotes,
  screenOf,
  signOf,
  startsIn,
  upcoming,
  whenText,
} from "../src/keynote.ts";
import { PROVIDERS } from "../src/launch.ts";
import { MAPS } from "../src/maps.ts";
import { roomEntry, route } from "../src/world.ts";

/** Copenhagen wall time on Wednesday 21 October 2026 (summer time, UTC+2) as epoch ms. */
const cph = (h: number, m = 0, day = 21) => Date.UTC(2026, 9, day, h - 2, m);
const H = 3_600_000;

const keynote = (id: number, startsAt: number, hours = 2, title = `Keynote ${id}`): Keynote => ({
  id,
  title,
  host: "OpenAI",
  startsAt,
  endsAt: startsAt + hours * H,
  url: "https://example.com/live",
});

test("live is the one on now; the first to start wins an overlap", () => {
  const now = cph(19);
  const a = keynote(1, cph(18, 30));
  const b = keynote(2, cph(18));
  const over = keynote(3, cph(12));
  const later = keynote(4, cph(21));
  const list = [a, b, over, later];
  expect(liveKeynote(list, now)).toEqual(b);
  expect(liveKeynote([later], now)).toBeNull();
  // It ends on the dot.
  expect(liveKeynote([b], b.endsAt)).toBeNull();
  expect(liveKeynote([b], b.endsAt - 1)).toEqual(b);
});

test("upcoming drops what's over, and sorts by start", () => {
  const now = cph(19);
  const list = [keynote(1, cph(21)), keynote(2, cph(10)), keynote(3, cph(18))];
  expect(upcoming(list, now).map((k) => k.id)).toEqual([3, 1]);
});

test("the poster announces the next one a week ahead, not sooner", () => {
  const now = cph(12);
  const soon = keynote(1, now + ANNOUNCE_MS);
  const far = keynote(2, now + ANNOUNCE_MS + 1);
  expect(nextKeynote([far, soon], now)).toEqual(soon);
  expect(nextKeynote([far], now)).toBeNull();
  expect(screenOf([far], now)).toBeNull();
  expect(screenOf([soon], now)).toEqual({ live: false, keynote: soon });
  // On the screen once it starts.
  expect(screenOf([soon], soon.startsAt)).toEqual({ live: true, keynote: soon });
});

test("when it starts, said on the world's clock", () => {
  const now = cph(9);
  expect(whenText(cph(19), now)).toBe("today at 19:00");
  expect(whenText(cph(18, 30, 22), now)).toBe("tomorrow at 18:30");
  // Clocks go back on 25 October: from then on Copenhagen is UTC+1.
  expect(whenText(Date.UTC(2026, 9, 26, 16), now)).toBe("on Monday at 17:00");
  // A week or more away: the date.
  expect(whenText(Date.UTC(2026, 9, 29, 18), now)).toBe("on 29 Oct at 19:00");
  expect(startsIn(now + 30_000, now)).toBe("any minute");
  expect(startsIn(now + 25 * 60_000, now)).toBe("in 25 min");
  expect(startsIn(now + 5 * H, now)).toBe("in 5 h");
  expect(startsIn(now + 3 * 24 * H, now)).toBe("in 3 days");
});

test("the sign over the screen", () => {
  const k = keynote(1, cph(19), 2, "OpenAI DevDay");
  expect(signOf({ live: true, keynote: k }, cph(19, 30))).toBe("🔴 LIVE · OpenAI DevDay");
  expect(signOf({ live: false, keynote: k }, cph(9))).toBe("📽️ OpenAI DevDay · today at 19:00");
});

test("a host the launch stand knows gets its colour, by name or OpenRouter's", () => {
  const accent = (id: string) => PROVIDERS.find((p) => p.id === id)!.accent;
  expect(hostAccent("OpenAI")).toBe(accent("codex"));
  expect(hostAccent("Anthropic")).toBe(accent("claude"));
  expect(hostAccent("Google")).toBe(accent("google"));
  expect(hostAccent("xAI")).toBe(accent("grok"));
  expect(hostAccent("Mistral")).toMatch(/^#[0-9a-f]{6}$/);
});

test("?keynote= forces one for screenshots, or none", () => {
  const now = cph(12);
  const [live] = forcedKeynotes("live:Google I/O", now)!;
  expect(live).toMatchObject({ title: "Google I/O" });
  expect(liveKeynote([live!], now)).toEqual(live!);
  const [soon] = forcedKeynotes("soon", now)!;
  expect(screenOf([soon!], now)?.live).toBe(false);
  expect(forcedKeynotes("off", now)).toEqual([]);
  expect(forcedKeynotes("", now)).toBeUndefined();
  expect(forcedKeynotes("nonsense", now)).toBeUndefined();
});

test("sameKeynotes compares what a player would see", () => {
  const a = [keynote(1, cph(19))];
  expect(sameKeynotes(a, [keynote(1, cph(19))])).toBe(true);
  expect(sameKeynotes(a, [keynote(1, cph(20))])).toBe(false);
});

test("the screen hangs on the Tavern's west wall beside the stage, off the map", () => {
  const inn = MAPS.inn;
  for (let y = SCREEN.y; y < SCREEN.y + SCREEN.h; y++) {
    expect(inn.at(SCREEN.x, y)).toBe("W");
    expect(isScreen(SCREEN.x, y)).toBe(true);
  }
  expect(isScreen(SCREEN.x, SCREEN.y - 1)).toBe(false);
  // From the stage, facing the wall, you're looking at it.
  const stage = inn.find("e").filter(([x, y]) => x === 1 && isScreen(0, y));
  expect(stage.length).toBeGreaterThan(0);
  for (const [x, y] of stage) expect(facesScreen(x, y, "left")).toBe(true);
  expect(facesScreen(3, 12, "left")).toBe(false);
});

test("the crowd stands on open floor in front of the stage, reachable from the door", () => {
  const inn = MAPS.inn;
  const door = roomEntry("inn");
  expect(new Set(CROWD.map(([x, y]) => `${x},${y}`)).size).toBe(CROWD.length);
  for (const [x, y] of CROWD) {
    expect(inn.at(x, y)).toBe("_");
    expect(route(inn, [door.x, door.y], [x, y])).not.toBeNull();
    // Nearer the screen than the door.
    expect(x).toBeLessThan(door.x);
  }
  // At least as many spots as the town has characters who wander.
  expect(CROWD.length).toBeGreaterThanOrEqual(BOTS.filter((b) => !b.still && !b.home).length);
});

test("the barkeep talks about what's coming, and the crowd cheers while it's on", () => {
  const list = [keynote(1, cph(19), 2, "OpenAI DevDay")];
  const soon = keynoteTalk(list, cph(9))!;
  expect(soon).toEqual({ title: "OpenAI DevDay", when: "today at 19:00", live: false });
  // Before it: one of his room lines (a third of the time), filled in. Its lines come last in that pool.
  const rolls = [0, 0.999];
  const announced = lineFor(BARKEEP, cph(9), { keynote: soon }, () => rolls.shift() ?? 0);
  expect(BARKEEP.keynoteLines?.soon?.length).toBeGreaterThan(0);
  expect(announced).toContain("OpenAI DevDay");
  expect(announced).not.toContain("{");
  const live = keynoteTalk(list, cph(19, 30))!;
  expect(live.live).toBe(true);
  expect(lineFor(BARKEEP, cph(19, 30), { keynote: live }, () => 0)).toBe("Shh! OpenAI DevDay is on.");
  // A wanderer has no lines of its own for it: it cheers.
  const goer = BOTS.find((b) => !b.still && !b.home)!;
  expect(CHEERS).toContain(lineFor(goer, cph(19, 30), { keynote: live }, () => 0));
  expect(keynoteTalk([], cph(9))).toBeUndefined();
});
