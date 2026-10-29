import { expect, test } from "bun:test";
import { copenhagenToMs } from "../src/sky.ts";
import { tavernSet } from "../src/tavern-band.ts";
import { themeOf } from "../src/themes.ts";

const at = (s: string) => copenhagenToMs(s)!;
test("the band starts at 16:00 and finishes at midnight, in Copenhagen in summer and winter", () => {
  for (const date of ["2026-07-12", "2026-12-12"]) {
    expect(tavernSet(at(`${date}T15:59`))).toBeNull();
    expect(tavernSet(at(`${date}T16:00`))).toBe("hearth-jig");
    expect(tavernSet(at(`${date}T16:05`))).toBe("lantern-reel");
    expect(tavernSet(at(`${date}T16:10`))).toBe("hearth-jig");
    expect(tavernSet(at(`${date}T23:59`))).not.toBeNull();
    expect(tavernSet(at(`${date}T00:00`))).toBeNull();
  }
});
test("only the Tavern floor changes music for the performance", () => {
  const evening = at("2026-10-28T18:00");
  expect(themeOf("inn", evening).id).toBe("hearth-jig");
  expect(themeOf("inn", at("2026-10-28T15:59")).id).toBe("tavern");
  expect(themeOf("basement", evening).id).toBe("tavern");
  expect(themeOf("upstairs", evening).id).toBe("tavern");
  expect(themeOf("town", evening).id).toBe("town");
});
