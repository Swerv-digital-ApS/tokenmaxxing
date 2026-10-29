import { expect, test } from "bun:test";
import { as, client, event, signUp } from "./rivet.ts";

test("a game session can pair a phone once, without granting usage-import permissions", async () => {
  const u = await signUp("phone");
  const primary = as(u.token).player(u.userId);
  const desktop = await client.player.get([String(u.userId)]).redeemLoginCode(await primary.mintLoginCode());
  const before = Date.now();
  const { code, expiresAt } = await as(desktop).player(u.userId).mintPhoneLoginCode();
  expect(expiresAt).toBeGreaterThanOrEqual(before + 120_000);
  expect(expiresAt).toBeLessThanOrEqual(Date.now() + 120_000);
  const phone = await client.player.get([String(u.userId)]).redeemLoginCode(code);
  expect(phone).not.toBe(desktop);
  expect((await as(phone).town.me()).name).toBe(u.name);
  await expect(client.player.get([String(u.userId)]).redeemLoginCode(code)).rejects.toThrow();
  await expect(as(phone).player(u.userId).ingest([event()])).rejects.toThrow();
  await expect(as(phone).player(u.userId).mintLinkCode()).rejects.toThrow();
});

test("anonymous users, other players and sync-only computers cannot make phone codes", async () => {
  const u = await signUp("phoneowner");
  const other = await signUp("phoneother");
  await expect(client.player.get([String(u.userId)]).mintPhoneLoginCode()).rejects.toThrow();
  await expect(as(other.token).player(u.userId).mintPhoneLoginCode()).rejects.toThrow();
  const link = await as(u.token).player(u.userId).mintLinkCode();
  const device = await client.player.get([String(u.userId)]).redeemLinkCode(link, "sync box", "linux");
  await expect(as(device.token).player(u.userId).mintPhoneLoginCode()).rejects.toThrow();
});

test("phone pairing is rate limited and codes remain bounded", async () => {
  const u = await signUp("phonecap");
  const p = as(u.token).player(u.userId);
  const first = await p.mintPhoneLoginCode();
  for (let i = 0; i < 4; i++) await p.mintPhoneLoginCode();
  await expect(p.mintPhoneLoginCode()).rejects.toThrow("Too many pairing codes");
  await p.mintLoginCode();
  await expect(client.player.get([String(u.userId)]).redeemLoginCode(first.code)).rejects.toThrow();
});

test("a phone code is short enough to type, and reads however it was typed", async () => {
  const u = await signUp("phoneshort");
  const { code } = await as(u.token).player(u.userId).mintPhoneLoginCode();
  expect(code).toMatch(new RegExp(`^${u.userId}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$`));
  const typed = ` ${code.replaceAll("-", " ").toLowerCase()} `;
  const phone = await client.player.get([String(u.userId)]).redeemLoginCode(typed);
  expect((await as(phone).town.me()).name).toBe(u.name);
});

test("guessing phone codes is rate limited", async () => {
  const u = await signUp("phoneguess");
  const { code } = await as(u.token).player(u.userId).mintPhoneLoginCode();
  const player = client.player.get([String(u.userId)]);
  for (let i = 0; i < 10; i++)
    await expect(player.redeemLoginCode(`${u.userId}-AAAA-AAAA`)).rejects.toThrow("expired");
  await expect(player.redeemLoginCode(code)).rejects.toThrow("Too many tries");
});
