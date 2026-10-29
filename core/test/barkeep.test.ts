import { describe, expect, test } from "bun:test";
import { BADGES, frameOf } from "../src/badges.ts";
import { awardRemark, mayRemark, REMARK_GAP_MS } from "../src/barkeep.ts";

describe("barkeep awards", () => {
  test("names the player, the tier and the badge", () => {
    const b = BADGES[0]!;
    expect(awardRemark("Ada", b.id, b.tiers.length)).toBe(
      `Ada just hit ${frameOf(b.tiers.length, b.tiers.length)} in ${b.name}`,
    );
    expect(awardRemark("Ada", "level", 30)).toContain("Ada just hit level 30");
  });

  test("says nothing of a badge or tier that doesn't exist", () => {
    expect(awardRemark("Ada", "nope", 1)).toBeNull();
    expect(awardRemark("Ada", BADGES[0]!.id, 99)).toBeNull();
  });

  test("speaks up at most once per gap", () => {
    expect(mayRemark(0, 1_000_000)).toBe(true);
    expect(mayRemark(1_000, 1_000 + REMARK_GAP_MS - 1)).toBe(false);
    expect(mayRemark(1_000, 1_000 + REMARK_GAP_MS)).toBe(true);
  });
});
