import { expect, test } from "bun:test";
import { TURN_DELAY_MS, type Turning, turnStep } from "../src/game/turn.ts";

/** Presses `dir` while facing `facing` on each frame in `frames` (ms), carrying `turning` between them. */
function play(dir: "up" | "right", facing: "up" | "right", frames: number[]) {
  let turning: Turning | null = null;
  let face = facing;
  return frames.map((now) => {
    const t = turnStep(turning, dir, face, now);
    turning = t.turning;
    if (t.act === "turn") face = dir;
    return t.act;
  });
}

test("a different direction turns first, then walks once it has stayed held", () => {
  expect(play("up", "right", [0, 16, TURN_DELAY_MS - 1, TURN_DELAY_MS, TURN_DELAY_MS + 16])).toEqual([
    "turn",
    "wait",
    "wait",
    "walk",
    "walk",
  ]);
});

test("the way you already face walks at once", () => {
  expect(play("right", "right", [0, 16])).toEqual(["walk", "walk"]);
});

test("a tap only turns: the key is gone before the delay, and the next press starts over", () => {
  let turning: Turning | null = null;
  const first = turnStep(turning, "up", "right", 0);
  expect(first.act).toBe("turn");
  turning = first.turning;
  // Released: the caller drops `turning` (no key), so the same key later turns afresh from "up".
  turning = null;
  expect(turnStep(turning, "up", "up", 1000).act).toBe("walk");
});

test("changing the held key again restarts the delay", () => {
  let turning: Turning | null = null;
  let t = turnStep(turning, "up", "right", 0);
  turning = t.turning;
  t = turnStep(turning, "right", "up", 100);
  expect(t.act).toBe("turn");
  expect(turnStep(t.turning, "right", "right", 100 + TURN_DELAY_MS - 1).act).toBe("wait");
  expect(turnStep(t.turning, "right", "right", 100 + TURN_DELAY_MS).act).toBe("walk");
});
