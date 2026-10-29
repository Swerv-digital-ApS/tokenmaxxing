import { describe, expect, test } from "bun:test";
import { rich } from "./rivet.ts";

describe("the Tavern's request pile", () => {
  test("write one, 👍 it, take back your own; a few rules keep the pile tidy", async () => {
    const a = await rich("rq1");
    const b = await rich("rq2");

    await expect(a.town.requestAdd("hats")).rejects.toThrow("8 to 280");
    await expect(a.town.requestAdd("add a shop at https://example.com please")).rejects.toThrow("no links");
    await a.town.requestAdd("a rooftop garden above the Tavern");
    // One a minute, and the same one twice is a 👍 instead.
    await expect(a.town.requestAdd("a second thing I would like")).rejects.toThrow("a minute");
    await expect(b.town.requestAdd("A rooftop garden above the Tavern")).rejects.toThrow(
      "on the pile already",
    );

    let pile = await b.town.requests();
    const mine = pile.find((r) => r.text.startsWith("a rooftop"))!;
    expect(mine).toMatchObject({ votes: 1, voted: false, status: "open" });
    await b.town.requestVote(mine.id, true);
    await b.town.requestVote(mine.id, true);
    pile = await b.town.requests();
    expect(pile.find((r) => r.id === mine.id)).toMatchObject({
      votes: 2,
      voted: true,
    });
    await b.town.requestVote(mine.id, false);
    expect((await b.town.requests()).find((r) => r.id === mine.id)?.votes).toBe(1);

    // Only the author takes it back.
    await expect(b.town.requestWithdraw(mine.id)).rejects.toThrow("your own");
    await a.town.requestWithdraw(mine.id);
    expect((await b.town.requests()).some((r) => r.id === mine.id)).toBe(false);
  });
});
