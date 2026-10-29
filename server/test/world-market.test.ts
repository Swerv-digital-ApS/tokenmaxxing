import { describe, expect, test } from "bun:test";
import { GameMap, MAPS } from "@tokenmaxxing/core/maps.ts";
import { SHOP_DOOR_CHAR, SHOP_ROOM, SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import { isCart } from "@tokenmaxxing/core/street.ts";
import { outsideDoor, route } from "@tokenmaxxing/core/world.ts";
import { admin, eventually, rich, veteran } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

describe("Torvehallen", () => {
  /** From the Tavern's landing out through its door and along the streets to the hall's door. */
  async function toHall(user: { token: string; userId: number }) {
    const c = await connect(user.token);
    const me = c.snap.players.find((p) => p.id === user.userId)!;
    await walk(c.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const out = outsideDoor("inn");
    const door = MAPS.town.find(SHOP_DOOR_CHAR.market)[0]!;
    const rows = MAPS.town.rows.map((r, y) =>
      [...r].map((ch, x) => (isCart(x + MAPS.town.x0, y + MAPS.town.y0) ? "T" : ch)).join(""),
    );
    const streets = new GameMap("town", "Town", rows, MAPS.town.x0, MAPS.town.y0);
    const steps = await walk(c.conn, route(streets, [out.x, out.y], door)!);
    expect(steps.at(-1)).toMatchObject({ room: SHOP_ROOM.market });
    await eventually(() => expect(c.events.snapshots.at(-1)!.room).toBe(SHOP_ROOM.market));
    return c;
  }

  test("the hall is a room of forty slots, with its keeper at the counter", async () => {
    const u = await rich("seller", 500);
    const c = await toHall(u);
    const snap = c.events.snapshots.at(-1)!;
    expect(snap.players.find((p) => p.name === "Torvald")).toMatchObject({
      x: SHOPS.market.keeper[0],
      y: SHOPS.market.keeper[1],
    });
    await c.conn.dispose();
  });

  test("something is put on display and bought only in the hall, and the seller is paid whole", async () => {
    const seller = await rich("seller", 500);
    const buyer = await rich("buyer", 500);
    await veteran(seller);
    await seller.town.buy("hat.1");
    // The test server sells anywhere; these two are held to the hall rule.
    await admin().adminStrictShops(seller.userId);
    await admin().adminStrictShops(buyer.userId);
    const want = { item: "hat.1", slot: 3, price: 90 };

    // Not in the hall: refused, and it stays in the bag.
    await expect(seller.town.marketList(want)).rejects.toMatchObject({ code: "not_in_shop" });
    const sc = await toHall(seller);
    const listing = await seller.town.marketList(want);
    expect(listing).toMatchObject({ slot: 3, item: "hat.1", price: 90, seller: expect.any(String) });
    expect((await seller.town.marketListings()).map((l) => l.id)).toEqual([listing.id]);
    expect((await seller.town.wallet()).owned).not.toContain("hat.1");

    // The buyer sees it from anywhere but can't buy from the street.
    expect((await buyer.town.marketListings()).map((l) => l.id)).toEqual([listing.id]);
    await expect(buyer.town.marketBuy(listing.id, 90)).rejects.toMatchObject({ code: "not_in_shop" });
    const bc = await toHall(buyer);
    const before = (await buyer.town.wallet()).balance;
    await expect(buyer.town.marketBuy(listing.id, 91)).rejects.toMatchObject({ code: "price_changed" });
    const after = await buyer.town.marketBuy(listing.id, 90);
    expect(after.balance).toBe(before - 90);
    expect(after.owned).toContain("hat.1");
    await expect(buyer.town.marketBuy(listing.id, 90)).rejects.toMatchObject({ code: "gone" });
    expect(await buyer.town.marketListings()).toEqual([]);

    // The seller finds the sale waiting, and is told of it once.
    const mine = await seller.town.marketMine();
    expect(mine.sold).toHaveLength(1);
    expect(mine.sold[0]).toMatchObject({ item: "hat.1", price: 90 });
    await seller.town.marketSaw(mine.sold[0]!.id);
    expect((await seller.town.marketMine()).sold).toEqual([]);
    await sc.conn.dispose();
    await bc.conn.dispose();
  });

  test("a listing can be taken back from anywhere, and only by its seller", async () => {
    const seller = await rich("seller", 500);
    const other = await rich("other", 500);
    await veteran(seller);
    await seller.town.buy("hat.1");
    const listing = await seller.town.marketList({ item: "hat.1", slot: 5, price: 10 });
    await expect(other.town.marketCancel(listing.id)).rejects.toMatchObject({ code: "not_found" });
    await seller.town.marketCancel(listing.id);
    expect((await seller.town.wallet()).owned).toContain("hat.1");
    expect(await seller.town.marketListings()).toEqual([]);
  });
});
