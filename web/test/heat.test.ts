import { expect, test } from "bun:test";
import { daysAgoText, sourceName } from "../src/hud/heat.ts";

test("how long ago", () => {
  expect(daysAgoText("2026-10-22", "2026-10-22")).toBe("today");
  expect(daysAgoText("2026-10-21", "2026-10-22")).toBe("yesterday");
  expect(daysAgoText("2026-10-19", "2026-10-22")).toBe("3 days ago");
  expect(daysAgoText("2026-07-22", "2026-10-22")).toBe("3 months ago");
});

test("source names fall back to what the server sent", () => {
  expect(sourceName("claude_code")).toBe("Claude Code");
  expect(sourceName("brand_new")).toBe("brand_new");
});
