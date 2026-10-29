import { describe, expect, test } from "bun:test";
import { BARKEEP, BARKEEP_HOME } from "../src/barkeep.ts";
import {
  blocksOutward,
  doorOf,
  frontier,
  type GameMap,
  LEGEND,
  layoutOf,
  MAPS,
  plotBlock,
  plotId,
  SHOP_BLOCKS,
  shopBlocks,
  TOWN_SPAWN,
  townMap,
} from "../src/maps.ts";
import {
  displayTab,
  SHOP_DOOR_CHAR,
  SHOP_IDS,
  SHOP_ROOM,
  SHOP_TABS,
  SHOPS,
  SUPPLIES_DESK,
} from "../src/shoprooms.ts";
import { portal, RAIDERS_SHOWN, roomEntry } from "../src/world.ts";

/** Tiles you can walk onto or stand next to (to sit, read or open a door) from (x, y). */
function reachable(map: GameMap, x: number, y: number): Set<string> {
  const seen = new Set([`${x},${y}`]);
  const queue = [[x, y] as [number, number]];
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = cx + dx!;
      const ny = cy + dy!;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (map.walkable(nx, ny)) queue.push([nx, ny]);
    }
  }
  return seen;
}

describe("maps", () => {
  for (const map of Object.values(MAPS)) {
    test(`${map.id}: rectangular, every tile in the legend`, () => {
      for (const row of map.rows) expect(row.length).toBe(map.width);
      for (const row of map.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    });
  }

  test("town: grows around its companies, and the spawn reaches every door, bench and the Inn", () => {
    // Companies on every side, with a gap left by one that closed (a park).
    let plots: number[] = [];
    for (let i = 0; i < 12; i++) plots.push(frontier(plots)[i % 3]!);
    plots = plots.filter((_, i) => i !== 4);
    const town = townMap(plots);
    for (const row of town.rows) expect(row.length).toBe(town.width);
    for (const row of town.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    expect(town.walkable(...TOWN_SPAWN)).toBe(true);
    const seen = reachable(town, ...TOWN_SPAWN);
    expect(town.find("D")).toHaveLength(plots.length);
    for (const plot of plots) {
      expect(town.at(...doorOf(plot))).toBe("D");
      expect(seen.has(doorOf(plot).join(","))).toBe(true);
    }
    for (const ch of ["I", "B", "N", "o", "G"])
      for (const t of town.find(ch)) expect(seen.has(t.join(","))).toBe(true);
    expect(town.x0).toBeLessThan(0);
  });

  test("town: you can build on any empty block next to it, nearest the square first", () => {
    const first = frontier([]);
    expect(first).toHaveLength(6); // around the 2×2 core, less the blocks Natmarked and Torvehallen stand on
    expect(first).not.toContain(plotId(0, 0));
    const next = frontier([plotId(2, 0)]);
    expect(next).toContain(plotId(3, 0));
    expect(next).not.toContain(plotId(2, 0));
    for (const p of next) expect(plotId(...plotBlock(p))).toBe(p);
  });

  test("dungeon: a war desk in front of every seat, one per raider shown, all on aisles you can walk", () => {
    const map = MAPS.dungeon;
    expect(map.find("x")).toHaveLength(1);
    const seats = map.find("r");
    expect(seats).toHaveLength(RAIDERS_SHOWN);
    const entry = roomEntry("dungeon");
    const seen = reachable(map, entry.x, entry.y);
    for (const [x, y] of seats) {
      expect(map.at(x, y - 1)).toBe("l");
      expect(seen.has(`${x},${y}`)).toBe(true);
    }
    // You can walk up to the boss.
    expect(map.find("Z").some((t) => seen.has(t.join(",")))).toBe(true);
  });

  for (const id of ["hq", "inn", "basement"] as const) {
    test(`${id}: one exit, and every bed and chair is reachable from it`, () => {
      const map = MAPS[id];
      expect(map.find("x")).toHaveLength(1);
      const entry = roomEntry(id === "hq" ? "hq:1" : id);
      const seen = reachable(map, entry.x, entry.y);
      for (const ch of ["b", "c"]) for (const t of map.find(ch)) expect(seen.has(t.join(","))).toBe(true);
    });
  }

  describe("the net cafe's tables", () => {
    const map = MAPS.basement;
    const entry = roomEntry("basement");
    const seen = reachable(map, entry.x, entry.y);
    const box = (ch: string) => {
      const t = map.find(ch);
      const xs = t.map(([x]) => x);
      const ys = t.map(([, y]) => y);
      return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1, t.length];
    };

    test("one 4x2 poker table with six chairs, one 3x2 roulette table with four spots on each side", () => {
      expect(box("♠")).toEqual([4, 2, 8]);
      expect(map.find("♣")).toHaveLength(6);
      expect(box("♦")).toEqual([3, 2, 6]);
      expect(box("♥")).toEqual([4, 4, 8]);
      expect(map.kind(...map.find("♥")[0]!).roulette).toBe(true);
      expect(map.walkable(...map.find("♦")[0]!)).toBe(false);
      expect(map.walkable(...map.find("♠")[0]!)).toBe(false);
    });

    test("the spots sit right above and below the table, and every walkable tile is reachable from the stairs", () => {
      const table = map.find("♦");
      const top = Math.min(...table.map(([, y]) => y));
      const bottom = Math.max(...table.map(([, y]) => y));
      const rows = map.find("♥").map(([, y]) => y);
      expect(rows.filter((y) => y === top - 1)).toHaveLength(4);
      expect(rows.filter((y) => y === bottom + 1)).toHaveLength(4);
      const spotXs = map.find("♥").map(([x]) => x);
      for (const [x] of table) expect(spotXs).toContain(x);
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++)
          if (map.walkable(x, y)) expect(seen.has(`${x},${y}`), `${x},${y}`).toBe(true);
    });

    test("the Tavern has neither table", () => {
      for (const ch of ["♠", "♣", "♦", "♥"]) expect(MAPS.inn.find(ch)).toHaveLength(0);
    });
  });

  describe("the Tavern", () => {
    const map = MAPS.inn;
    const entry = roomEntry("inn");
    const seen = reachable(map, entry.x, entry.y);
    const cells = (ch: string) => map.find(ch);

    test("28x19 (26x16 inside), one exit, the door steps in just above it", () => {
      expect([map.width, map.height]).toEqual([28, 19]);
      expect(map.name).toBe("The Tavern");
      expect(cells("x")).toEqual([[13, 18]]);
      expect([entry.x, entry.y]).toEqual([13, 17]);
      expect(map.walkable(entry.x, entry.y)).toBe(true);
    });

    test("every chair, stool, sofa and bench is reachable from the door", () => {
      for (const ch of ["c", "v", "s", "B"]) {
        expect(cells(ch).length).toBeGreaterThan(0);
        for (const t of cells(ch)) expect(seen.has(t.join(","))).toBe(true);
      }
    });

    test("the bar is sealed: the barkeep's cell can't be reached, and isn't floor to sleep on", () => {
      expect(map.walkable(BARKEEP_HOME.x, BARKEEP_HOME.y)).toBe(true);
      expect(seen.has(`${BARKEEP_HOME.x},${BARKEEP_HOME.y}`)).toBe(false);
      expect(BARKEEP.home).toEqual(BARKEEP_HOME);
      // Everything behind the bar line is rug or shelf, never `_`.
      for (let x = 1; x <= 9; x++) expect(map.at(x, 3)).toBe("=");
      for (const t of cells("=").filter(([x, y]) => y === 3 && x < 10))
        expect(seen.has(t.join(","))).toBe(false);
    });

    test("the boards, the tap, the tip jar and the coat stands are all there, each walkable up to", () => {
      for (const ch of [
        "a",
        "y",
        "$",
        "m",
        "A",
        "P",
        "f",
        "n",
        "e",
        "h",
        "K",
        "o",
        "z",
        "J",
        "O",
        "S",
        "u",
      ]) {
        expect(cells(ch).length).toBeGreaterThan(0);
        const standable = cells(ch).some(([x, y]) =>
          [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].some(([dx, dy]) => map.walkable(x + dx!, y + dy!) && seen.has(`${x + dx!},${y + dy!}`)),
        );
        expect(standable).toBe(true);
      }
      expect(cells("A")).toHaveLength(4);
      expect(cells("P")).toHaveLength(2);
      expect(LEGEND.y!.serves).toBe(true);
      expect(LEGEND.$!.tosses).toBe(true);
      // The tip jar sits on the bar, within the tap's run; no fountain indoors.
      expect(cells("$")).toEqual([[8, 4]]);
      expect(cells("F")).toHaveLength(0);
      // The stage is walkable; the stairs are in the corners.
      expect(LEGEND.e!.walk).toBe(true);
      expect(cells("S")).toEqual([[26, 16]]);
      expect(cells("u")).toEqual([[1, 17]]);
    });

    test("the stage can be walked across", () => {
      for (const t of cells("e")) expect(seen.has(t.join(","))).toBe(true);
    });
  });
});

describe("the shops", () => {
  const none = new Map();
  const corner = new Set([plotId(0, 0), plotId(1, 0), plotId(0, 1), plotId(1, 1)]);
  const reservedShops = new Set(SHOP_IDS.map((id) => plotId(...SHOP_BLOCKS[id])));
  // A busy town, so the shops sit among companies on every side.
  const plots: number[] = [];
  for (let i = 0; i < 12; i++) plots.push(frontier(plots)[i % 3]!);
  const towns = [townMap([]), townMap(plots)];

  test("companies never build on a shop's block", () => {
    const blocks = SHOP_IDS.map((id) => plotId(...SHOP_BLOCKS[id]));
    expect(frontier([]).filter((p) => blocks.includes(p))).toEqual([]);
    for (const p of plots) expect(blocks).not.toContain(p);
  });

  test("a company that held a shop's block before the shop moves the shop, not the house", () => {
    const held = plotId(...SHOP_BLOCKS.natmarked);
    const old = [held, ...frontier([held]).slice(0, 4)];
    const placed = shopBlocks(old);
    expect(placed.natmarked).not.toEqual(SHOP_BLOCKS.natmarked);
    expect(old).not.toContain(plotId(...placed.natmarked));
    expect(new Set(Object.values(placed).map(([x, y]) => plotId(x, y))).size).toBe(SHOP_IDS.length);
    expect(frontier(old)).not.toContain(plotId(...placed.natmarked));
    expect(frontier(old)).not.toContain(held);
    const town = townMap(old);
    expect(town.find("Ħ")).toHaveLength(SHOP_IDS.length * 19);
    for (const id of SHOP_IDS) expect(town.find(SHOP_DOOR_CHAR[id])).toHaveLength(1);
    expect(town.find("D")).toHaveLength(old.length);
    expect(reachable(town, ...TOWN_SPAWN).has(town.find(SHOP_DOOR_CHAR.natmarked)[0]!.join(","))).toBe(true);
  });

  describe("growing the town", () => {
    const fromSquare = ([bx, by]: [number, number]) => Math.hypot(bx + 0.5 - 1, by + 0.5 - 1);
    const take = (n: number) => {
      const out: [number, number][] = [];
      for (const block of blocksOutward()) {
        out.push(block);
        if (out.length === n) break;
      }
      return out;
    };

    test("blocksOutward goes nearest the square first, ties by plot number, each block once", () => {
      const first = take(600);
      expect(new Set(first.map(([x, y]) => plotId(x, y))).size).toBe(600);
      // The same order as sorting a window that is certainly wide enough.
      const window: [number, number][] = [];
      for (let by = -15; by <= 16; by++) for (let bx = -15; bx <= 16; bx++) window.push([bx, by]);
      const sorted = window.sort((a, b) => fromSquare(a) - fromSquare(b) || plotId(...a) - plotId(...b));
      expect(first).toEqual(sorted.slice(0, 600));
      // The core is the nearest four.
      expect(new Set(first.slice(0, 4).map(([x, y]) => plotId(x, y)))).toEqual(
        new Set([plotId(0, 0), plotId(1, 0), plotId(0, 1), plotId(1, 1)]),
      );
    });

    test("a shop that is moved takes the nearest free block, wherever that is", () => {
      // A company on three shop blocks and on every block nearer the square than a few free ones.
      const held = [SHOP_BLOCKS.natmarked, SHOP_BLOCKS.market, SHOP_BLOCKS.pets].map(([x, y]) =>
        plotId(x, y),
      );
      const near = take(40)
        .map(([x, y]) => plotId(x, y))
        .filter((p) => !reservedShops.has(p));
      const plots = [...new Set([...held, ...near])].filter((p) => !corner.has(p));
      const placed = shopBlocks(plots);
      const wanted = take(300)
        .map(([x, y]) => plotId(x, y))
        .filter((p) => !plots.includes(p) && !corner.has(p) && !reservedShops.has(p));
      // Moved in the shops' own order: the pet shop, Natmarked, the hall.
      expect([placed.pets, placed.natmarked, placed.market].map(([x, y]) => plotId(x, y))).toEqual(
        wanted.slice(0, 3),
      );
      // The shops that kept their blocks did not move.
      expect(placed.furniture).toEqual(SHOP_BLOCKS.furniture);
    });

    test("a town of a few hundred companies builds, quickly, and every door can be walked to", () => {
      const plots: number[] = [];
      while (plots.length < 300) plots.push(frontier(plots)[0]!);
      const started = performance.now();
      const town = townMap(plots);
      expect(performance.now() - started).toBeLessThan(500);
      expect(town.width * town.height).toBeLessThan(300_000);
      const seen = reachable(town, ...TOWN_SPAWN);
      for (const id of SHOP_IDS) {
        const [door] = town.find(SHOP_DOOR_CHAR[id]);
        expect(door, id).toBeDefined();
        expect(seen.has(door!.join(","))).toBe(true);
      }
      expect(town.find("D")).toHaveLength(plots.length);
    });

    test("the shops still have blocks when the houses reach far past where the search used to stop", () => {
      const far: number[] = [];
      for (let by = -12; by <= 13; by++)
        for (let bx = -12; bx <= 13; bx++) if (!corner.has(plotId(bx, by))) far.push(plotId(bx, by));
      const placed = shopBlocks(far);
      const ids = SHOP_IDS.map((id) => plotId(...placed[id]));
      expect(new Set(ids).size).toBe(SHOP_IDS.length);
      for (const [bx, by] of Object.values(placed)) {
        expect(Number.isInteger(bx) && Number.isInteger(by)).toBe(true);
        expect(far).not.toContain(plotId(bx, by));
      }
      const town = townMap(far);
      const seen = reachable(town, ...TOWN_SPAWN);
      for (const id of SHOP_IDS) expect(seen.has(town.find(SHOP_DOOR_CHAR[id])[0]!.join(","))).toBe(true);
    });
  });

  describe("a town with every block round the square taken", () => {
    // A house on every block a company could hold, the shops' own included: they started before the shops.
    const full: number[] = [];
    for (let by = -4; by <= 5; by++)
      for (let bx = -4; bx <= 5; bx++) if (!corner.has(plotId(bx, by))) full.push(plotId(bx, by));

    test("every shop still gets a block of its own, outside the houses", () => {
      const placed = shopBlocks(full);
      const ids = SHOP_IDS.map((id) => plotId(...placed[id]));
      for (const [bx, by] of Object.values(placed)) {
        expect(Number.isInteger(bx)).toBe(true);
        expect(Number.isInteger(by)).toBe(true);
      }
      expect(new Set(ids).size).toBe(SHOP_IDS.length);
      for (const id of ids) {
        expect(full).not.toContain(id);
        expect(corner.has(id)).toBe(false);
      }
    });

    test("and each door is reachable from the spawn, with the street below it open", () => {
      const town = townMap(full);
      const seen = reachable(town, ...TOWN_SPAWN);
      for (const id of SHOP_IDS) {
        const doors = town.find(SHOP_DOOR_CHAR[id]);
        expect(doors).toHaveLength(1);
        const [dx, dy] = doors[0]!;
        expect(seen.has(`${dx},${dy}`)).toBe(true);
        expect(town.walkable(dx, dy + 1)).toBe(true);
      }
    });
  });

  for (const [i, town] of towns.entries()) {
    test(`town ${i}: each storefront has one door, reachable from the spawn, and a 5x4 front`, () => {
      const seen = reachable(town, ...TOWN_SPAWN);
      for (const id of SHOP_IDS) {
        const doors = town.find(SHOP_DOOR_CHAR[id]);
        expect(doors).toHaveLength(1);
        expect(seen.has(doors[0]!.join(","))).toBe(true);
        expect(LEGEND[SHOP_DOOR_CHAR[id]]!.portal).toBe(true);
        const [dx, dy] = doors[0]!;
        // The door is in the middle of the front's bottom row, and the street below it is open.
        expect(town.at(dx - 2, dy)).toBe("Ħ");
        expect(town.at(dx + 2, dy - 3)).toBe("Ħ");
        expect(town.walkable(dx, dy + 1)).toBe(true);
        expect(town.find("Ħ")).toHaveLength(SHOP_IDS.length * 19);
      }
    });
  }

  for (const id of SHOP_IDS) {
    const shop = SHOPS[id];
    const map = MAPS[SHOP_ROOM[id]];
    const entry = roomEntry(SHOP_ROOM[id]);
    const seen = reachable(map, entry.x, entry.y);

    test(`${id}: ${shop.w}x${shop.d} inside like the 3D room, one exit, the entry steps in above it`, () => {
      expect([map.width, map.height]).toEqual([shop.w + 2, shop.d + 3]);
      for (const row of map.rows) expect(row.length).toBe(map.width);
      expect(map.name).toBe(shop.name);
      expect(map.find("x")).toEqual([shop.door]);
      expect([entry.x, entry.y]).toEqual([shop.door[0], shop.door[1] - 1]);
      expect(map.walkable(entry.x, entry.y)).toBe(true);
    });

    test(`${id}: the counter, the keeper's spot, every seat and every display can be reached`, () => {
      expect(map.kind(...shop.counter).counter).toBe(true);
      expect(map.walkable(...shop.keeper)).toBe(true);
      expect(shop.displays.length).toBeGreaterThan(0);
      const next = (x: number, y: number) =>
        [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].some(([dx, dy]) => seen.has(`${x + dx!},${y + dy!}`) && map.walkable(x + dx!, y + dy!));
      expect(next(...shop.counter)).toBe(true);
      for (const [x, y, tab] of shop.displays) {
        expect(map.kind(x, y).shop).toBe(id);
        expect(displayTab(id, x, y)).toBe(tab);
        expect(next(x, y)).toBe(true);
      }
      for (const s of layoutOf(map).seats) expect(seen.has(`${s.x},${s.y}`) || next(s.x, s.y)).toBe(true);
    });

    test(`${id}: every display opens a tab this shop carries`, () => {
      for (const [, , tab] of shop.displays)
        expect(tab === "look" ? id === "barber" : SHOP_TABS[id].includes(tab)).toBe(true);
    });

    test(`${id}: the door leads in from the town and back out below the storefront`, () => {
      const [dx, dy] = MAPS.town.find(SHOP_DOOR_CHAR[id])[0]!;
      expect(portal("town", { ch: SHOP_DOOR_CHAR[id], x: dx, y: dy }, null, none)).toEqual(entry);
      expect(portal(SHOP_ROOM[id], { ch: "x", ...{ x: shop.door[0], y: shop.door[1] } }, null, none)).toEqual(
        {
          room: "town",
          x: dx,
          y: dy + 1,
          facing: "down",
        },
      );
    });
  }

  test("layoutOf reads a room's size, doors and seats", () => {
    const tavern = layoutOf(MAPS.inn);
    expect([tavern.width, tavern.height]).toEqual([28, 19]);
    expect(tavern.doors.map((d) => d.ch).sort()).toEqual(["S", "u", "x"]);
    expect(tavern.seats.length).toBeGreaterThan(20);
    expect(layoutOf(MAPS["shop-barber"]).displays.some((d) => d.shop === "counter")).toBe(true);
  });
});

describe("Møbelhuset sells everything a room needs, at displays you walk up to", () => {
  const shop = SHOPS.furniture;
  const map = MAPS[SHOP_ROOM.furniture];
  const entry = roomEntry(SHOP_ROOM.furniture);
  const seen = reachable(map, entry.x, entry.y);
  const stand = (x: number, y: number) =>
    [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ].some(([dx, dy]) => seen.has(`${x + dx!},${y + dy!}`) && map.walkable(x + dx!, y + dy!));

  test("it has tabs for furniture, wallpaper and floors, monitors and company supplies", () => {
    expect(SHOP_TABS.furniture).toEqual(["furniture", "decor", "desk", "company"]);
    for (const tab of SHOP_TABS.furniture)
      expect(shop.displays.filter(([, , t]) => t === tab).length).toBeGreaterThanOrEqual(5);
  });

  test("the monitor setups, the wallpaper and floor samples and the supplies desk each open their tab", () => {
    expect(displayTab("furniture", 3, 3)).toBe("desk");
    expect(displayTab("furniture", 15, 3)).toBe("desk");
    expect(displayTab("furniture", 0, 3)).toBe("decor");
    expect(displayTab("furniture", 0, 18)).toBe("decor");
    const [sx, sy] = SUPPLIES_DESK;
    expect(displayTab("furniture", sx, sy)).toBe("company");
    expect(displayTab("furniture", sx + 1, sy)).toBe("company");
  });

  test("a customer can stand at every tab's display tiles", () => {
    for (const tab of SHOP_TABS.furniture) {
      const tiles = shop.displays.filter(([, , t]) => t === tab);
      expect(tiles.filter(([x, y]) => stand(x, y)).length).toBe(tiles.length);
    }
    const [sx, sy] = SUPPLIES_DESK;
    expect(map.kind(sx, sy).shop).toBe("furniture");
    expect(stand(sx, sy) && stand(sx + 1, sy)).toBe(true);
  });
});
