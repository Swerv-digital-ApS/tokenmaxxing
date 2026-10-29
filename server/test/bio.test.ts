import { describe, expect, test } from "bun:test";
import { BIO_MAX_LENGTH } from "@tokenmaxxing/core/world.ts";
import { parseBio } from "../src/validate.ts";

describe("parseBio", () => {
  test("a plain line passes, trimmed", () => {
    expect(parseBio("  Ships on Fridays.  ")).toBe("Ships on Fridays.");
    expect(parseBio("héllo 🚀 wörld")).toBe("héllo 🚀 wörld");
  });

  test("empty or only whitespace clears", () => {
    expect(parseBio("")).toBe("clear");
    expect(parseBio(" \n\t ")).toBe("clear");
    expect(parseBio("​‮")).toBe("clear");
  });

  test("one line: newlines and runs of space collapse", () => {
    expect(parseBio("a\n\nb\r\nc   d\te")).toBe("a b c d e");
  });

  test("control, zero-width and bidi characters are stripped", () => {
    expect(parseBio("a\u0000b\u0007c")).toBe("a b c");
    expect(parseBio("ab​cd‮def⁦x⁩")).toBe("abcddefx");
    expect(parseBio("a b")).toBe("a b");
  });

  test("120 code points at most, counted as characters", () => {
    expect(BIO_MAX_LENGTH).toBe(120);
    expect(parseBio("a".repeat(120))).toBe("a".repeat(120));
    expect(parseBio("a".repeat(121))).toBeNull();
    // An emoji is one, though it's two UTF-16 units.
    expect(parseBio("🚀".repeat(120))).toBe("🚀".repeat(120));
    expect(parseBio("🚀".repeat(121))).toBeNull();
    expect(parseBio("a".repeat(5000))).toBeNull();
  });

  test("links are refused, however they're dressed", () => {
    for (const bad of [
      "see https://acme.com",
      "http://x",
      "ftp://x.y/z",
      "www.acme.com",
      "acme.com",
      "visit Acme.IO today",
      "mail me at x.dev",
      "w​ww.acme.co",
    ])
      expect(parseBio(bad)).toBeNull();
    // Dots in ordinary text are fine.
    expect(parseBio("e.g. Rust, Go. Maybe v1.2")).toBe("e.g. Rust, Go. Maybe v1.2");
  });

  test("not a string is refused", () => {
    for (const bad of [null, undefined, 5, {}, ["a"]]) expect(parseBio(bad)).toBeNull();
  });
});
