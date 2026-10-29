import { describe, expect, test } from "bun:test";
import { THEME_STEPS, THEMES, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

describe("room themes", () => {
  test("every voice fills the whole loop and parses", () => {
    for (const t of THEMES) {
      expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t.drums)).toBe(THEME_STEPS);
      expect(() => notes(t.lead)).not.toThrow();
      expect(() => notes(t.bass)).not.toThrow();
    }
  });

  test("each kind of room has its own theme", () => {
    expect(themeOf("town").id).toBe("town");
    expect(themeOf("hq:3").id).toBe("company");
    expect(themeOf("office:7").id).toBe("office");
    expect(themeOf("inn", Date.UTC(2026, 9, 28, 10)).id).toBe("tavern");
    expect(themeOf("basement").id).toBe("tavern");
    expect(themeOf("dungeon").id).toBe("raid");
  });
});
