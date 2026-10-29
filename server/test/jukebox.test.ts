import { expect, test } from "bun:test";
import type { JukeboxNow } from "@tokenmaxxing/core/jukebox.ts";
import { eventually, signUp } from "./rivet.ts";
import { connect } from "./world-client.ts";

/** What a tab has heard from the jukebox, newest last. */
function listen(c: Awaited<ReturnType<typeof connect>>) {
  const heard: (JukeboxNow | null)[] = [];
  c.conn.on("jukebox", (j: JukeboxNow | null) => heard.push(j));
  return heard;
}

test("the Tavern's jukebox: one track at a time for the room, a minute each, two votes skip", async () => {
  const a = await signUp("juke");
  const b = await signUp("juke");
  const ca = await connect(a.token);
  const cb = await connect(b.token);
  expect(ca.snap.room).toBe("inn");
  expect(cb.snap.room).toBe("inn");
  const heardA = listen(ca);
  const heardB = listen(cb);

  expect(await ca.conn.jukeboxPlay("polka")).toBeNull();
  for (const heard of [heardA, heardB])
    await eventually(() => expect(heard.at(-1)).toMatchObject({ track: "polka", by: a.userId, votes: 0 }));

  // One at a time.
  expect(await cb.conn.jukeboxPlay("green")).toMatch(/already playing/);

  // One vote isn't enough; the second skips it for the whole room.
  expect(await ca.conn.jukeboxSkip()).toBeNull();
  await eventually(() => expect(heardB.at(-1)).toMatchObject({ track: "polka", votes: 1 }));
  expect(await cb.conn.jukeboxSkip()).toBeNull();
  for (const heard of [heardA, heardB]) await eventually(() => expect(heard.at(-1)).toBeNull());

  // A waits a minute for their next track; B can start theirs.
  expect(await ca.conn.jukeboxPlay("green")).toMatch(/minute/);
  expect(await cb.conn.jukeboxPlay("green")).toBeNull();
  await eventually(() => expect(heardA.at(-1)).toMatchObject({ track: "green", by: b.userId }));

  await ca.conn.dispose();
  await cb.conn.dispose();
});
