import { expect, test } from "bun:test";
import { FrameCadence } from "../src/game/cadence.ts";

test("a 60 fps cap holds on both 60 Hz and 144 Hz displays", () => {
  for (const refresh of [60, 144]) {
    const cadence = new FrameCadence();
    let frames = 0;
    for (let i = 0; i < refresh; i++) {
      const now = (i * 1000) / refresh;
      cadence.wake(now);
      if (cadence.step(now, 60, true, false)) frames++;
    }
    expect(frames).toBe(60);
  }
});

test("quiet scenes throttle, input and action wake immediately, hidden tabs do not step", () => {
  const cadence = new FrameCadence();
  expect(cadence.step(0, 60, false, false)?.idle).toBe(false);
  expect(cadence.step(11_000, 60, false, false)?.idle).toBe(true);
  expect(cadence.step(11_010, 60, false, false)).toBeNull();
  cadence.wake(11_011);
  expect(cadence.step(11_011, 60, false, false)?.idle).toBe(false);
  expect(cadence.step(22_000, 60, false, false)?.idle).toBe(true);
  expect(cadence.step(22_001, 60, true, false)?.idle).toBe(false);
  expect(cadence.step(22_100, 60, true, true)).toBeNull();
  expect(cadence.step(32_100, 60, true, false)?.gap).toBe(0);
});

test("uncapped play follows display refresh, while a slow frame does not cause a catch-up burst", () => {
  const cadence = new FrameCadence();
  for (let i = 0; i < 10; i++) expect(cadence.step(i, 0, true, false)).not.toBeNull();
  cadence.step(100, 60, true, false);
  expect(cadence.step(200, 60, true, false)).not.toBeNull();
  expect(cadence.step(201, 60, true, false)).toBeNull();
});
