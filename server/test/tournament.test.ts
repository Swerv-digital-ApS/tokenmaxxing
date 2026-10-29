import { describe, expect, test } from "bun:test";
import { waiting } from "@tokenmaxxing/core/tournament.ts";
import { eventually, rich } from "./rivet.ts";

type Rich = Awaited<ReturnType<typeof rich>>;

describe("the tournament board", () => {
  test("sign up, start when full, matches played in the arcade advance the bracket to a champion", async () => {
    const users = [await rich("t1"), await rich("t2"), await rich("t3"), await rich("t4")];
    const [host, ...rest] = users as [Rich, Rich, Rich, Rich];
    const byId = new Map(users.map((u) => [u.userId, u]));

    await expect(host.town.tournamentOpen("tokenmaxxing", 4)).rejects.toThrow("can't have a bracket");
    await host.town.tournamentOpen("spr", 4);
    await expect(rest[0].town.tournamentOpen("spr", 4)).rejects.toThrow("on already");
    await rest[0].town.tournamentJoin(true);
    await expect(rest[0].town.tournamentJoin(true)).rejects.toThrow("already");
    await rest[0].town.tournamentJoin(false);
    for (const u of rest) await u.town.tournamentJoin(true);

    // Full: it started.
    let board = await host.town.tournament();
    expect(board.current).toMatchObject({ game: "spr", status: "running", size: 4 });
    expect(board.champion).toBeNull();

    // One match, the usual way: a table, a join, and the other side gives up.
    const play = async (winner: number, loser: number, round: number) => {
      const w = byId.get(winner)!;
      const l = byId.get(loser)!;
      const id = (await w.arcade.open("spr", { stake: 0 })).me.table!;
      await l.arcade.join(id);
      await l.match(id).forfeit();
      await eventually(async () => {
        // The final's win ends the bracket: nothing live is left.
        const cur = (await host.town.tournament()).current;
        expect(cur === null || cur.bracket![round]!.some((m) => m.winner === winner)).toBe(true);
      });
    };

    for (const m of waiting(board.current!.bracket!)) await play(m.a!, m.b!, 0);
    board = await host.town.tournament();
    const final = waiting(board.current!.bracket!);
    expect(final).toHaveLength(1);
    await play(final[0]!.a!, final[0]!.b!, 1);

    board = await host.town.tournament();
    // Done: no live bracket, and the champion has their name on the board.
    expect(board.current).toBeNull();
    expect(board.champion).toMatchObject({ userId: final[0]!.a!, game: "spr" });

    // A new tournament can open, and the champion stays until it has its own.
    await host.town.tournamentOpen("dice", 8);
    board = await host.town.tournament();
    expect(board.current).toMatchObject({ game: "dice", status: "open", size: 8 });
    expect(board.champion?.userId).toBe(final[0]!.a!);
  });
});
