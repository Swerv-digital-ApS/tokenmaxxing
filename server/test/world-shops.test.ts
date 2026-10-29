import { describe, expect, test } from "bun:test";
import { GameMap, MAPS } from "@tokenmaxxing/core/maps.ts";
import { SHOPKEEPERS } from "@tokenmaxxing/core/shopkeepers.ts";
import { SHOP_DOOR_CHAR, SHOP_ROOM, SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import { isCart } from "@tokenmaxxing/core/street.ts";
import { outsideDoor, roomEntry, route } from "@tokenmaxxing/core/world.ts";
import { admin, eventually, rich, signUp } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

describe("the shops", () => {
  /** From the Tavern's landing out through its door, then along the streets to `shop`'s door. */
  async function toShop(shop: "pets" | "clothes", user?: { token: string; userId: number }) {
    const a = user ?? (await signUp("shop"));
    const c = await connect(a.token);
    const me = c.snap.players.find((p) => p.id === a.userId)!;
    await walk(c.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const out = outsideDoor("inn");
    const door = MAPS.town.find(SHOP_DOOR_CHAR[shop])[0]!;
    // The sausage cart is a prop nobody walks through: a town without it, for the route.
    const rows = MAPS.town.rows.map((r, y) =>
      [...r].map((ch, x) => (isCart(x + MAPS.town.x0, y + MAPS.town.y0) ? "T" : ch)).join(""),
    );
    const streets = new GameMap("town", "Town", rows, MAPS.town.x0, MAPS.town.y0);
    const steps = await walk(c.conn, route(streets, [out.x, out.y], door)!);
    expect(steps.at(-1)).toMatchObject({ room: SHOP_ROOM[shop] });
    return { a, c, door, steps };
  }

  test("a storefront's door leads into the shop, where the shopkeeper minds the counter", async () => {
    const { c, steps } = await toShop("pets");
    expect(steps.at(-1)).toEqual({ ...roomEntry(SHOP_ROOM.pets), state: "idle" });
    const snap = await eventually(() => {
      const s = c.events.snapshots.at(-1)!;
      expect(s.room).toBe(SHOP_ROOM.pets);
      return s;
    });
    const wren = SHOPKEEPERS.find((k) => k.home?.room === SHOP_ROOM.pets)!;
    expect(wren.name).toBe("Wren");
    expect(snap.players.find((p) => p.id === wren.id)).toMatchObject({
      x: SHOPS.pets.keeper[0],
      y: SHOPS.pets.keeper[1],
    });
    await c.conn.dispose();
  });

  test("the shop is a public room: chat reaches those inside, not the street, and the exit leads back out", async () => {
    const one = await toShop("clothes");
    const two = await signUp("shop");
    const other = await connect(two.token);
    await one.c.conn.say("anyone in town?");
    await Bun.sleep(100);
    expect(other.events.chat.map((l) => l.text)).not.toContain("anyone in town?");
    await one.c.conn.say("nice hats");
    await eventually(() => expect(one.c.events.chat.map((l) => l.text)).toContain("nice hats"));
    expect(other.events.chat.map((l) => l.text)).not.toContain("nice hats");
    const entry = roomEntry(SHOP_ROOM.clothes);
    const out = await walk(
      one.c.conn,
      route(MAPS[SHOP_ROOM.clothes], [entry.x, entry.y], MAPS[SHOP_ROOM.clothes].find("x")[0]!)!,
    );
    expect(out.at(-1)).toEqual({ ...outsideDoor("clothes"), state: "idle" });
    await one.c.conn.dispose();
    await other.conn.dispose();
  });

  test("a stray drop in a shop is refused", async () => {
    const u = await rich("shop", 1000);
    await u.town.buy("hat.1");
    const { c } = await toShop("pets", u);
    await eventually(() => expect(c.events.snapshots.at(-1)!.room).toBe(SHOP_ROOM.pets));
    expect(await u.town.drop("hat.1")).toMatchObject({ notice: expect.stringContaining("shop floor") });
    expect(c.events.drops).toHaveLength(0);
    await c.conn.dispose();
  });

  test("buying is done in the shop that sells it: not in the street, not in another shop", async () => {
    const u = await rich("shop", 1000);
    // The test server sells anywhere; this player is held to the rule.
    await admin().adminStrictShops(u.userId);
    // Not in the world at all: nowhere to be buying from.
    await expect(u.town.buy("hat.1")).rejects.toMatchObject({ code: "not_in_shop" });
    const { c } = await toShop("pets", u);
    await eventually(() => expect(c.events.snapshots.at(-1)!.room).toBe(SHOP_ROOM.pets));
    // In the pet shop: a hat is Thread & Token's, furniture is Møbelhuset's.
    await expect(u.town.buy("hat.1")).rejects.toMatchObject({
      code: "not_in_shop",
      message: expect.stringContaining("Thread & Token"),
    });
    await expect(u.town.buy("furn.p")).rejects.toMatchObject({ code: "not_in_shop" });
    await expect(u.town.buyDesk("dual")).rejects.toMatchObject({ code: "not_in_shop" });
    await expect(u.town.buyDecor("wall", "nyhavn")).rejects.toMatchObject({ code: "not_in_shop" });
    expect((await u.town.wallet()).owned).not.toContain("hat.1");
    // Here a pet is sold.
    expect((await u.town.buy("pet.2")).owned).toContain("pet.2");
    await c.conn.dispose();
  });

  test("outside every shop nothing is sold", async () => {
    const u = await rich("shop", 1000);
    await admin().adminStrictShops(u.userId);
    const c = await connect(u.token);
    await expect(u.town.buy("pet.2")).rejects.toMatchObject({ code: "not_in_shop" });
    await expect(u.town.buyPiece("furn.ρ")).rejects.toMatchObject({ code: "not_in_shop" });
    await expect(u.town.buy("furn.p")).rejects.toMatchObject({
      message: expect.stringContaining("Møbelhuset"),
    });
    await c.conn.dispose();
  });
});
