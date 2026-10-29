import { describe, expect, test } from "bun:test";
import { EMPLOYEE_MERCH_DISCOUNT, merchId } from "@tokenmaxxing/core/shop.ts";
import { admit, rich, signUp } from "./rivet.ts";

describe("company merch, worn", () => {
  test("anyone can buy and wear a company's merch, and only the kinds they hold", async () => {
    const owner = await signUp("merchco");
    const co = await owner.town.createCompany("Merch Worn Co");
    const fan = await rich("merchfan", 500);
    const look = (await fan.town.me()).look;
    // Not before it's bought, and not another company's.
    await expect(fan.town.setLook({ ...look, merch: co.id, merchWorn: 1 })).rejects.toThrow("bag");
    await fan.town.buy(merchId(co.id, "tee"));
    await fan.town.setLook({ ...look, merch: co.id, merchWorn: 1 });
    expect((await fan.town.me()).look).toMatchObject({ merch: co.id, merchWorn: 1 });
    // The cap isn't in the bag yet: the tee alone doesn't cover it.
    await expect(fan.town.setLook({ ...look, merch: co.id, merchWorn: 1 | 4 })).rejects.toThrow("bag");
    await expect(fan.town.setLook({ ...look, merch: co.id + 1000, merchWorn: 1 })).rejects.toThrow("bag");
    // Bits past the four pieces aren't a look.
    await expect(fan.town.setLook({ ...look, merch: co.id, merchWorn: 16 })).rejects.toThrow("look");
  });

  test("a tee and a hoodie are saved as the hoodie: one top at a time", async () => {
    const owner = await signUp("merchtop");
    const co = await owner.town.createCompany("Merch Top Co");
    const fan = await rich("merchtopfan", 500);
    await fan.town.buy(merchId(co.id, "tee"));
    await fan.town.buy(merchId(co.id, "hoodie"));
    const look = (await fan.town.me()).look;
    await fan.town.setLook({ ...look, merch: co.id, merchWorn: 1 | 2 });
    // The tee is still in the bag; it just isn't on.
    expect((await fan.town.me()).look).toMatchObject({ merch: co.id, merchWorn: 2 });
    expect((await fan.town.bag()).map((r) => r.item)).toContain(merchId(co.id, "tee"));
  });

  test("employees' free merch stays with them after they leave, and so does what they wear", async () => {
    const owner = await signUp("merchboss");
    const co = await owner.town.createCompany("Merch Staff Co");
    const staff = await signUp("merchstaff");
    await admit(owner, staff, co.id);
    expect(EMPLOYEE_MERCH_DISCOUNT).toBe(1);
    await staff.town.buy(merchId(co.id, "cap"));
    const look = (await staff.town.me()).look;
    await staff.town.setLook({ ...look, merch: co.id, merchWorn: 4 });
    await staff.town.leaveCompany();
    expect((await staff.town.me()).look).toMatchObject({ merch: co.id, merchWorn: 4 });
    // Outside, the same cap costs what it costs outsiders; nobody can buy it for free twice.
    await expect(staff.town.buy(merchId(co.id, "cap"))).rejects.toThrow("coins");
  });

  test("a closed company's merch is still in the bag and worn, but can't be bought again", async () => {
    const owner = await signUp("merchgone");
    const co = await owner.town.createCompany("Merch Gone Co");
    const fan = await rich("merchgonefan", 500);
    await fan.town.buy(merchId(co.id, "mug"));
    const look = (await fan.town.me()).look;
    await fan.town.setLook({ ...look, merch: co.id, merchWorn: 8 });
    await owner.town.leaveCompany();
    expect((await fan.town.me()).look).toMatchObject({ merch: co.id, merchWorn: 8 });
    await expect(fan.town.buy(merchId(co.id, "tee"))).rejects.toThrow("gone");
    // They can take it off and put it on again.
    await fan.town.setLook({ ...look, merch: 0, merchWorn: 0 });
    await fan.town.setLook({ ...look, merch: co.id, merchWorn: 8 });
    expect((await fan.town.me()).look).toMatchObject({ merch: co.id, merchWorn: 8 });
  });
});
