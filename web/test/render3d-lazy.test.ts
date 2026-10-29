import { expect, test } from "bun:test";
import { prepareRoom, registerRoomPrep, roomReady, roomsNextTo } from "../src/render3d/rooms/rooms.ts";

test("a room with code to fetch is not ready until prepared, and shares one fetch", async () => {
  let runs = 0;
  registerRoomPrep("lazy-test", async () => {
    runs++;
    await Promise.resolve();
  });
  expect(roomReady("lazy-test")).toBe(false);
  expect(roomReady("lazy-test:7")).toBe(false);
  await Promise.all([prepareRoom("lazy-test"), prepareRoom("lazy-test:7")]);
  expect(runs).toBe(1);
  expect(roomReady("lazy-test")).toBe(true);
  await prepareRoom("lazy-test");
  expect(runs).toBe(1);
});

test("a failed fetch can be tried again", async () => {
  let n = 0;
  registerRoomPrep("flaky-test", async () => {
    if (n++ === 0) throw new Error("offline");
  });
  await expect(prepareRoom("flaky-test")).rejects.toThrow("offline");
  expect(roomReady("flaky-test")).toBe(false);
  await prepareRoom("flaky-test");
  expect(roomReady("flaky-test")).toBe(true);
});

test("rooms nobody registered are ready, and the doors of a room are known", () => {
  expect(roomReady("never-heard-of")).toBe(true);
  expect(roomsNextTo("inn")).toContain("basement");
  expect(roomsNextTo("office:12")).toEqual(["hq"]);
});
