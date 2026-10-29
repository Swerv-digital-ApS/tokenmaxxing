import { describe, expect, test } from "bun:test";
import {
  COOLDOWN_MS,
  cooldownLeft,
  isOver,
  type Jukebox,
  type Playing,
  settle,
  skipNeeded,
  start,
  trackIds,
  trackMs,
  voteSkip,
  votesOf,
  wire,
} from "../src/jukebox.ts";
import { drumHits, drumSteps, noteHz, notes, STEPS, TUNES, voiceSteps } from "../src/tunes.ts";

const on = (by = 1, now = 1000): Playing => {
  const r = start(null, "polka", by, undefined, now);
  if (!r.ok) throw new Error("should start");
  return r.jukebox;
};

describe("jukebox rules", () => {
  test("a player waits a minute between their own tracks", () => {
    expect(cooldownLeft(undefined, 5)).toBe(0);
    expect(cooldownLeft(1000, 1000 + 20_000)).toBe(COOLDOWN_MS - 20_000);
    expect(cooldownLeft(1000, 1000 + COOLDOWN_MS)).toBe(0);
    expect(start(null, "polka", 1, 1000, 1000 + 1)).toEqual({ ok: false, why: "cooldown" });
    expect(start(null, "polka", 1, 1000, 1000 + COOLDOWN_MS).ok).toBe(true);
  });

  test("one track at a time, and only a real one", () => {
    const j = on();
    expect(start(j, "green", 2, undefined, 2000)).toEqual({ ok: false, why: "busy" });
    expect(start(null, "nope", 2, undefined, 2000)).toEqual({ ok: false, why: "unknown" });
    // Once it has ended the next can start; the finished one doesn't block.
    const end = j.startedAt + trackMs("polka");
    expect(isOver(j, end - 1)).toBe(false);
    expect(start(j, "green", 2, undefined, end).ok).toBe(true);
    expect(settle(j, [1], end)).toBeNull();
  });

  test("skip needs two votes, or the majority of a small room", () => {
    expect([1, 2, 3, 4, 10].map(skipNeeded)).toEqual([1, 2, 2, 2, 2]);
    const room = [1, 2, 3];
    let j: Jukebox = on();
    j = voteSkip(j, 2, room);
    expect(settle(j, room, 2000)).not.toBeNull();
    j = voteSkip(j, 2, room); // the same vote again is still one
    expect(votesOf(j as Playing, room)).toBe(1);
    j = voteSkip(j, 3, room);
    expect(settle(j, room, 2000)).toBeNull();
  });

  test("a lone listener can skip; outsiders can't vote; leavers' votes stop counting", () => {
    const j = on();
    expect(settle(voteSkip(j, 1, [1]), [1], 2000)).toBeNull();
    expect(voteSkip(j, 9, [1, 2])).toBe(j);
    const voted = voteSkip(voteSkip(j, 2, [1, 2, 3]), 1, [1, 2, 3]) as Playing;
    expect(votesOf(voted, [1, 3])).toBe(1);
    // Two in the room, one voted and the other leaves: the one left is a majority of one.
    const one = voteSkip(j, 1, [1, 2]) as Playing;
    expect(settle(one, [1, 2], 2000)).not.toBeNull();
    expect(settle(one, [1], 2000)).toBeNull();
  });

  test("what clients are told", () => {
    expect(wire(on(7, 1000), "Ann", [7, 8], 4000)).toEqual({
      track: "polka",
      by: 7,
      byName: "Ann",
      elapsed: 3000,
      ms: trackMs("polka"),
      votes: 0,
      need: 2,
    });
  });
});

describe("tunes", () => {
  test("six tunes, each voice a whole loop and every note readable", () => {
    expect(trackIds().length).toBe(6);
    expect(new Set(trackIds()).size).toBe(6);
    for (const t of TUNES) {
      expect(voiceSteps(t.lead)).toBe(STEPS);
      expect(voiceSteps(t.bass)).toBe(STEPS);
      expect(drumSteps(t.drums)).toBe(STEPS);
      expect(notes(t.lead).length).toBeGreaterThan(4);
      expect(notes(t.bass).length).toBeGreaterThan(3);
      expect(drumHits(t.drums).length).toBeGreaterThan(0);
      // About a minute to a minute and a half.
      expect(trackMs(t.id)).toBeGreaterThanOrEqual(60_000);
      expect(trackMs(t.id)).toBeLessThan(130_000);
    }
  });

  test("note names", () => {
    expect(noteHz("a4")).toBeCloseTo(440);
    expect(noteHz("c5")!).toBeCloseTo(523.25, 1);
    expect(noteHz("bb3")!).toBeCloseTo(233.08, 1);
    expect(noteHz("h4")).toBeNull();
    expect(notes("c4 _ _ . d4")).toEqual([
      { step: 0, len: 3, hz: noteHz("c4")! },
      { step: 4, len: 1, hz: noteHz("d4")! },
    ]);
  });
});
