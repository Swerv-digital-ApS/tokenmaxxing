import { describe, expect, test } from "bun:test";
import { publicOrigin } from "../src/install.ts";

describe("/install.sh", () => {
  test("behind the proxy, the public scheme is the forwarded one", () => {
    const req = (host: string, proto?: string) =>
      new Request(`http://${host}/install.sh`, proto ? { headers: { "x-forwarded-proto": proto } } : {});
    expect(publicOrigin(req("tokenmaxxing.app", "https"))).toBe("https://tokenmaxxing.app");
    expect(publicOrigin(req("localhost:8787"))).toBe("http://localhost:8787");
    expect(publicOrigin(req("tokenmaxxing.app", "https;rm -rf"))).toBeNull();
  });
});
