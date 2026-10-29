import { afterAll, describe, expect, test } from "bun:test";
import { pushNewRequest } from "../src/request-push.ts";

const request = { id: 7, userId: 3, name: "ada", text: "a rooftop garden above the Tavern", createdAt: 1 };

// A receiver that turns away the first `fails` posts, then takes them.
const received: unknown[] = [];
let fails = 0;
const receiver = Bun.serve({
  port: 0,
  async fetch(req) {
    if (fails > 0) {
      fails--;
      return new Response("down", { status: 503 });
    }
    received.push(await req.json());
    return Response.json({ ok: true });
  },
});
afterAll(() => receiver.stop(true));
const url = `http://localhost:${receiver.port}/hook`;
const noWait = async () => {};

describe("pushing a new request to the agent webhook", () => {
  test("posts it as JSON, retrying a receiver that is down", async () => {
    received.length = 0;
    fails = 2;
    expect(await pushNewRequest(request, { NEW_REQUEST_PUSH_URL: url, NODE_ENV: "production" }, noWait)).toBe(
      true,
    );
    expect(received).toEqual([request]);

    fails = 10;
    expect(await pushNewRequest(request, { NEW_REQUEST_PUSH_URL: url, NODE_ENV: "production" }, noWait)).toBe(
      false,
    );
  });

  test("sends nothing outside production, or with no URL", async () => {
    received.length = 0;
    fails = 0;
    expect(await pushNewRequest(request, { NEW_REQUEST_PUSH_URL: url }, noWait)).toBe(false);
    expect(await pushNewRequest(request, { NODE_ENV: "production" }, noWait)).toBe(false);
    expect(received).toEqual([]);
  });
});
