import { expect, test } from "bun:test";
import { formatPhoneCode, parsePhoneCode, phoneSecret } from "../src/pairing.ts";

test("a phone code is the player's number and eight typeable characters", () => {
  const secret = phoneSecret();
  expect(secret).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  expect(parsePhoneCode(formatPhoneCode(42, secret))).toEqual({ userId: 42, secret });
});

test("a phone code reads however it was typed", () => {
  const want = { userId: 42, secret: "K7QF0M21" };
  for (const typed of ["42-K7QF-0M21", " 42 k7qf om2l ", "42K7QF0M2I", "42-k7qf-0m21"])
    expect(parsePhoneCode(typed)).toEqual(want);
  expect(parsePhoneCode("7-AAAA-BBBB")).toEqual({ userId: 7, secret: "AAAABBBB" });
});

test("anything else is not a phone code", () => {
  for (const typed of [
    "",
    "42",
    "K7QF-M2XP",
    "42-K7QF-M2X",
    "42-K7QF-M2XU",
    "42.Abcdefghijklmnop_0123",
    null,
    42,
  ])
    expect(parsePhoneCode(typed)).toBeNull();
});
