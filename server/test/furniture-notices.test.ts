import { describe, expect, test } from "bun:test";
import { placeAllNotice, putAwayNotice } from "../src/furniture-notices.ts";

describe("furniture summaries", () => {
  test("putting a room away says how many went, and how many stayed", () => {
    expect(putAwayNotice(7, 0, true)).toBe("Put away 7 pieces.");
    expect(putAwayNotice(1, 0, true)).toBe("Put away 1 piece.");
    expect(putAwayNotice(7, 0, false)).toBe("Put 7 pieces in the storeroom.");
    expect(putAwayNotice(2, 1, true)).toBe("Put away 2 pieces, 1 stayed where it was.");
    expect(putAwayNotice(2, 3, false)).toBe("Put 2 pieces in the storeroom, 3 stayed where they were.");
    expect(putAwayNotice(0, 0, true)).toBe("Nothing to put away here.");
    expect(putAwayNotice(0, 2, true)).toBe("That didn't work. Try again.");
  });

  test("putting the storeroom out says how many went down and how many had no room", () => {
    expect(placeAllNotice(4, 0)).toBe("Placed 4 pieces.");
    expect(placeAllNotice(1, 0)).toBe("Placed 1 piece.");
    expect(placeAllNotice(4, 3)).toBe("Placed 4, no room for 3.");
    expect(placeAllNotice(0, 3, "There's no room on the floor here.")).toBe(
      "There's no room on the floor here.",
    );
    expect(placeAllNotice(0, 3)).toBe("Nothing to put out.");
  });
});
