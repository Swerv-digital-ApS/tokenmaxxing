import { describe, expect, test } from "bun:test";
import { GRACE_MS, MAX_WPM, type SprintState, score, sprint, WORDS } from "../../src/games/sprint.ts";
import { isRefused } from "../../src/games/types.ts";

const T0 = 1_000_000;
const start = (players = [1, 2], seconds = 30) => sprint.setup(players, 7, { seconds }, T0);
const type = (s: SprintState, p: number, typed: string, now: number) => {
  const r = sprint.move(s, p, { typed }, now);
  if (isRefused(r)) throw new Error(r.refused);
  return r;
};
/** The first `n` words, typed right, with the space after each. */
const words = (s: SprintState, n: number) => s.words.slice(0, n).join(" ") + (n > 0 ? " " : "");
const finish = (s: SprintState) => sprint.tick!(s, s.endsAt + GRACE_MS);

describe("Sprint Race", () => {
  test("WPM is correct letters plus spaces ÷ 5 ÷ minutes, like Monkeytype", () => {
    const list = ["the", "quick", "brown"];
    // "the " and "quick " are 10 characters: 2 words in 30 seconds is 4 WPM.
    expect(score(list, "the quick ", 0, 30_000)).toMatchObject({
      correct: 10,
      typed: 10,
      wpm: 4,
      raw: 4,
      done: 2,
    });
    // A wrong word doesn't count, nor its space; raw still does.
    const s = score(list, "the quack br", 0, 60_000);
    expect(s.correct).toBe(4 + 2);
    expect(s.raw).toBeCloseTo(12 / 5);
    // 11 letters and spaces, one wrong (the a).
    expect(s.acc).toBeCloseTo((11 / 12) * 100);
    // A wrong last word doesn't count; a right one so far does.
    expect(score(list, "the qx", 0, 60_000).correct).toBe(4);
    // Letters fixed along the way count against accuracy.
    expect(score(list, "the ", 2, 60_000).acc).toBeCloseTo((4 / 6) * 100);
    expect(score(list, "", 0, 60_000)).toMatchObject({ wpm: 0, acc: 0 });
  });

  test("the words: common, lowercase, no punctuation, the same for everyone, set by the seed", () => {
    expect(WORDS).toHaveLength(200);
    expect(WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    const s = start([1, 2, 3]);
    expect(s.words.every((w) => WORDS.includes(w))).toBe(true);
    expect(s.words.some((w, i) => w === s.words[i + 1])).toBe(false);
    // Enough for the fastest anyone may type.
    expect(s.words.length).toBeGreaterThan(MAX_WPM / 2);
    const v = [1, 2, 3, null].map((p) => sprint.view(s, p, T0).words);
    expect(new Set(v.map((w) => w.join(" "))).size).toBe(1);
    expect(sprint.setup([1, 2], 8, { seconds: 30 }, T0).words).not.toEqual(s.words);
    expect(start([1, 2], 60).words.length).toBeGreaterThan(s.words.length);
  });

  test("only moves inside the race count, at the server's clock", () => {
    let s = start();
    expect(isRefused(sprint.move(s, 1, { typed: s.words[0]! }, s.startsAt - 1))).toBe(true);
    s = type(s, 1, words(s, 3), s.startsAt + 3_000);
    expect(isRefused(sprint.move(s, 1, { typed: words(s, 4) }, s.endsAt + GRACE_MS + 1))).toBe(true);
    // Just before the end, a little late by the network, it still counts.
    s = type(s, 2, words(s, 2), s.endsAt + GRACE_MS - 1);
    s = finish(s);
    expect(s.over).toBe(true);
    expect(isRefused(sprint.move(s, 2, { typed: words(s, 3) }, s.endsAt))).toBe(true);
    const v = sprint.view(s, null, s.endsAt + 60_000);
    expect(v.scores[1]!.correct).toBe(words(s, 3).length);
    // Scored over the race's 30 seconds, however long after.
    expect(v.scores[1]!.wpm).toBeCloseTo(words(s, 3).length / 5 / 0.5);
  });

  test("text that isn't typing is refused, and finished words stay finished", () => {
    const s = type(start(), 1, "the ", T0 + 4_000);
    for (const typed of ["The ", "the, ", "the  a", "the 1"])
      expect(isRefused(sprint.move(s, 1, { typed }, T0 + 5_000))).toBe(true);
    expect(isRefused(sprint.move(s, 1, { typed: "x".repeat(40) }, T0 + 5_000))).toBe(true);
    expect(isRefused(sprint.move(s, 1, { typed: "tho " }, T0 + 5_000))).toBe(true);
    expect(isRefused(sprint.move(s, 1, { typed: 42 }, T0 + 5_000))).toBe(true);
    // The same text again, or too soon after the last, changes nothing.
    expect(sprint.move(s, 1, { typed: "the " }, T0 + 5_000)).toBe(s);
    expect(sprint.move(s, 1, { typed: "the a" }, T0 + 4_010)).toBe(s);
  });

  test("backspacing a wrong letter in the current word counts against accuracy", () => {
    let s = start();
    const w = s.words[0]!;
    const wrong = w[0] === "z" ? "y" : "z";
    s = type(s, 1, wrong, s.startsAt + 1_000);
    s = type(s, 1, "", s.startsAt + 1_200);
    s = type(s, 1, `${w} `, s.startsAt + 2_000);
    expect(s.racers[1]!.fixed).toBe(1);
    expect(sprint.view(s, 1, s.startsAt + 2_000).scores[1]!.acc).toBeLessThan(100);
  });

  test("nobody types faster than the cap: a paste waits for the clock", () => {
    let s = start();
    const all = words(s, 60);
    expect(isRefused(sprint.move(s, 1, { typed: all }, s.startsAt + 2_000))).toBe(true);
    // 250 WPM is about 21 characters a second.
    const at = s.startsAt + Math.ceil((all.length / ((MAX_WPM * 5) / 60)) * 1000);
    s = type(s, 1, all, at);
    expect(s.racers[1]!.typed).toBe(all);
    s = finish(s);
    expect(sprint.view(s, null, s.endsAt).scores[1]!.wpm).toBeLessThanOrEqual(MAX_WPM);
  });

  test("highest WPM wins, then accuracy, then whoever got there first; nothing typed is last", () => {
    let s = start([1, 2, 3, 4, 5]);
    const w = s.words;
    s = type(s, 1, words(s, 5), s.startsAt + 10_000);
    s = type(s, 2, words(s, 6), s.startsAt + 10_000);
    // 3 and 4 type the same, but 4 got there later.
    s = type(s, 3, words(s, 4), s.startsAt + 9_000);
    s = type(s, 4, words(s, 4), s.startsAt + 9_500);
    // 5 types as much as 3, with a wrong letter fixed on the way: lower accuracy.
    s = type(s, 5, `${words(s, 3)}${w[3]!.slice(0, -1)}z`, s.startsAt + 8_000);
    s = type(s, 5, `${words(s, 3)}${w[3]!.slice(0, -1)}`, s.startsAt + 8_200);
    s = type(s, 5, words(s, 4), s.startsAt + 8_400);
    s = finish(s);
    expect(sprint.outcome(s)).toEqual({ places: [[2], [1], [3], [4], [5]] });
  });

  test("exact ties share a place; nothing typed is last; nobody typing is void", () => {
    let s = start([1, 2, 3]);
    s = type(s, 1, words(s, 3), s.startsAt + 5_000);
    s = type(s, 2, words(s, 3), s.startsAt + 5_000);
    expect(sprint.outcome(s)).toBeNull();
    expect(sprint.outcome(finish(s))).toEqual({ places: [[1, 2], [3]] });
    expect(sprint.outcome(finish(start()))).toEqual({ void: "Nobody typed a word right." });
  });

  test("leaving places you last, and the last one in wins", () => {
    let s = start([1, 2, 3]);
    s = type(s, 1, words(s, 5), s.startsAt + 5_000);
    s = sprint.forfeit(s, 1, s.startsAt + 6_000);
    expect(isRefused(sprint.move(s, 1, { typed: words(s, 6) }, s.startsAt + 7_000))).toBe(true);
    s = type(s, 2, words(s, 1), s.startsAt + 8_000);
    expect(sprint.outcome(finish(s))).toEqual({ places: [[2], [3], [1]] });
    expect(sprint.outcome(sprint.forfeit(s, 3, s.startsAt + 9_000))).toEqual({ places: [[2], [3], [1]] });
  });

  test("you see your own text; nobody sees anyone else's", () => {
    let s = start();
    s = type(s, 1, "secretword", s.startsAt + 1_000);
    s = { ...s, racers: { ...s.racers, 2: { ...s.racers[2]!, typed: "qqqzzz" } } };
    expect(sprint.view(s, 1, s.startsAt + 1_000).mine).toBe("secretword");
    expect(JSON.stringify(sprint.view(s, 1, s.startsAt + 1_000))).not.toContain("qqqzzz");
    const watching = JSON.stringify(sprint.view(s, null, s.startsAt + 1_000));
    expect(watching).not.toContain("secretword");
    expect(watching).not.toContain("qqqzzz");
    expect(sprint.view(s, null, s.startsAt + 1_000).mine).toBeNull();
    expect(sprint.view(s, 3, s.startsAt + 1_000).mine).toBeNull();
  });

  test("the race ends with everyone's WPM said out loud", () => {
    let s = start();
    s = type(s, 1, words(s, 10), s.startsAt + 20_000);
    const after = finish(s);
    expect(sprint.callouts!(s, after).map((c) => c.player)).toEqual([1, 2]);
    expect(sprint.callouts!(after, after)).toEqual([]);
    expect(sprint.status!(s, 1, s.startsAt + 20_000)).toMatch(/^⌨️ \d+ wpm · lap \d+$/);
  });

  test("the world's board: each racer's correct characters, furthest first, for laps of the square", () => {
    let s = start([1, 2, 3]);
    s = type(s, 2, words(s, 4), s.startsAt + 5_000);
    s = type(s, 3, words(s, 1), s.startsAt + 5_000);
    s = sprint.forfeit(s, 1, s.startsAt + 5_000);
    const board = sprint.board!(s, s.startsAt + 6_000);
    expect(board.map((r) => [r.player, r.value])).toEqual([
      [2, words(s, 4).length],
      [3, words(s, 1).length],
    ]);
    expect(board[0]!.label).toMatch(/^\d+ wpm$/);
  });
});
