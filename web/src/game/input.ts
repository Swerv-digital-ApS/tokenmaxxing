import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { slotAt } from "@tokenmaxxing/core/market.ts";
import { canTurn } from "@tokenmaxxing/core/office.ts";
import { greeting } from "@tokenmaxxing/core/shopkeepers.ts";
import {
  displayTab,
  SHOP_DOOR_CHAR,
  SHOP_ROOM,
  type ShopId,
  shelfAt,
  shopOfRoom,
} from "@tokenmaxxing/core/shoprooms.ts";
import { STAR_COUNTER } from "@tokenmaxxing/core/stars.ts";
import { STATUE_TILE } from "@tokenmaxxing/core/statue.ts";
import { stepPace } from "@tokenmaxxing/core/street.ts";
import { TAVERN } from "@tokenmaxxing/core/tavern.ts";
import {
  DIRS,
  dropName,
  type Facing,
  JUMP_MS,
  ownPieceAt,
  RUN_STEP_MS,
  route,
  type StepResult,
  stepTarget,
  WALK_STEP_MS,
} from "@tokenmaxxing/core/world.ts";
import { conn } from "../net.ts";
import { tossLanded } from "../render3d/town/world-logic.ts";
import { chatBeside, hud } from "../store.ts";
import { basementInteract } from "./basement.ts";
import { camera, viewHooks, zoom } from "./camera.ts";
import { chalkboardText } from "./chalkboard.ts";
import { clocksText } from "./clocks.ts";
import { barrelInteract, blocksBarrel } from "./fastelavn.ts";
import { bindGhost, recordTake, tickGhost } from "./furniture.ts";
import { gameHits } from "./games.ts";
import { blocksGrave, graveInteract } from "./graveyard.ts";
import { buildingAt, companyOnPlot, doorOf, peekHits } from "./houses.ts";
import { blocksTruck, truckInteract } from "./jdag.ts";
import { keynoteInteract } from "./keynote.ts";
import { chipHits, signHits } from "./labels.ts";
import { blocksLaunch, launchInteract } from "./launch.ts";
import { merchantAt, openCart } from "./merchant.ts";
import { setHover } from "./near.ts";
import { myPetTile } from "./pets.ts";
import { picnicSeat } from "./picnic.ts";
import { seated, sit, standUp } from "./raidseat.ts";
import { blocksBonfire, bonfireInteract } from "./sankthans.ts";
import { pickTile } from "./stage.ts";
import { statueText } from "./statue.ts";
import { blocksStep, streetInteract } from "./street.ts";
import { bandInteract } from "./tavern-band.ts";
import { interactAnimal, interactTownProp } from "./town-life.ts";
import { openTrophies } from "./trophies.ts";
import { type Turning, turnStep } from "./turn.ts";
import { windmillInteract } from "./windmill.ts";
import { avatarAt, beginStep, dropAt, self, showMyDance, stepping, world } from "./world.ts";

const KEYS: Record<string, Facing> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

/** Arrow keys currently held, most recent last. */
const held: Facing[] = [];
let running = false;
/** A key pressed and released between two frames still takes its step. */
let tapped: Facing | null = null;
/** Click-to-walk: the remaining steps, and whether to interact, or take what's there, on arrival. */
let path: Facing[] = [];
let interactOnArrival = false;
/** The room the last frame was in, and the keys held through a change of room (see `updateSelf`). */
let lastRoom = "";
const carried = new Set<Facing>();
let takeOnArrival = false;
/** A held key's direction I've turned to and not yet walked (see `turnStep`). */
let turning: Turning | null = null;
/** Runs once the clicked path is walked (the 3D renderer's furniture placement drops a piece there). */
let onArrival: (() => void) | null = null;
/** "Take me there": the shop the auto-walk is heading for, replanned in each room it passes through. */
let heading: ShopId | null = null;
let greetings = 0;

const typing = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

export function bindInput(canvas: HTMLElement): void {
  // Ahead of the keys and clicks below: the furniture ghost and Ctrl/Cmd+Z.
  bindGhost(canvas);
  window.addEventListener("keydown", (e) => {
    // Escape is ours (menus, chat): unhandled, macOS takes it to leave full screen.
    if (e.key === "Escape") e.preventDefault();
    if (typing(e) || e.metaKey || e.ctrlKey) return;
    const s = hud.get();
    if (e.key === "Escape") {
      if (s.petMenu) return void hud.set({ petMenu: false });
      hud.set({ panel: s.panel || s.dialog ? null : { kind: "menu" }, dialog: null });
      return;
    }
    // Beside a game the chat is still there: Enter goes to it, unless it's pressing a button.
    if (e.key === "Enter" && chatBeside(s.panel) && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      hud.set({ chatFocus: s.chatFocus + 1 });
      return;
    }
    if (s.panel) return;
    const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (dir) {
      e.preventDefault();
      // A key still held from the last room: its repeats don't walk back out of the door we arrived at.
      if (carried.has(dir) && e.repeat) return;
      carried.delete(dir);
      if (!held.includes(dir)) held.push(dir);
      tapped = dir;
      path = [];
      interactOnArrival = false;
      takeOnArrival = false;
      onArrival = null;
      return;
    }
    switch (e.key.toLowerCase()) {
      case "x":
      case "shift":
        running = true;
        return;
      case " ":
        e.preventDefault();
        jump();
        return;
      case "e":
        if (s.dialog) hud.set({ dialog: null });
        else interact();
        return;
      case "g":
        take();
        return;
      case "p":
        if (s.me?.look.pet) hud.set({ petMenu: !s.petMenu });
        return;
      case "enter":
        e.preventDefault();
        hud.set({ chatFocus: s.chatFocus + 1 });
        return;
      case "l":
        hud.set({ panel: { kind: "leaderboard" } });
        return;
      case "q":
      case "[":
        viewHooks.rotate?.(-1);
        return;
      case "r":
      case "]":
        viewHooks.rotate?.(1);
        return;
      case "+":
      case "=":
        zoom(1);
        return;
      case "-":
      case "_":
        zoom(-1);
        return;
      case "0":
        zoom(0);
        return;
    }
  });
  window.addEventListener("keyup", (e) => {
    const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (dir) {
      if (held.includes(dir)) held.splice(held.indexOf(dir), 1);
      carried.delete(dir);
    }
    if (e.key.toLowerCase() === "x" || e.key === "Shift") running = false;
  });
  window.addEventListener("blur", () => {
    held.length = 0;
    running = false;
  });
  // Wheel or trackpad pinch (which arrives as a ctrl+wheel): one zoom step per notch.
  let wheel = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      wheel += e.deltaY;
      const notch = e.ctrlKey ? 12 : 60;
      if (Math.abs(wheel) < notch) return;
      zoom(wheel < 0 ? 1 : -1);
      wheel = 0;
    },
    { passive: false },
  );
  // Pointing at (or, on touch, tapping) something far away brings its label back: see near.ts.
  let pointedAt = 0;
  const point = (e: PointerEvent) => {
    const now = performance.now();
    if (e.type === "pointermove" && now - pointedAt < 50) return;
    pointedAt = now;
    setHover(pickTile(e.clientX, e.clientY), now);
  };
  canvas.addEventListener("pointermove", point, { passive: true });
  canvas.addEventListener("pointerdown", point, { passive: true });
  canvas.addEventListener("pointerleave", () => setHover(null, performance.now()));
  canvas.addEventListener("click", (e) => {
    if (hud.get().panel) return;
    // Someone inside a house: their name chip (screen pixels) or their face in a window (world pixels).
    const sx = e.clientX * camera.dpr;
    const sy = e.clientY * camera.dpr;
    const gx = sx / camera.scale + camera.x;
    const gy = sy / camera.scale + camera.y;
    const inside = (h: { x: number; y: number; w: number; h: number }, px: number, py: number) =>
      px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h;
    const hit = gameHits.find((h) => inside(h, sx, sy));
    if (hit) return void hit.open();
    const peeked = chipHits.find((h) => inside(h, sx, sy)) ?? peekHits.find((h) => inside(h, gx, gy));
    if (peeked) return void hud.set({ panel: { kind: "card", userId: peeked.id } });
    const signed = signHits.find((h) => inside(h, sx, sy));
    if (signed) return void hud.set({ panel: { kind: "companyCard", companyId: signed.id } });
    const tile = pickTile(e.clientX, e.clientY);
    if (!tile) return;
    const { x, y } = tile;
    const other = avatarAt(x, y);
    if (other) return void hud.set({ panel: { kind: "card", userId: other.info.id } });
    if (interactAnimal(x, y) || interactTownProp(x, y) || bandInteract(x, y)) return;
    // My own pet, or me (it's always beside me): the pet menu.
    if (hud.get().me?.look.pet && (isMyPetAt(x, y) || avatarIsMe(x, y)))
      return void hud.set({ petMenu: true });
    // A building (its wall or roof, not something on it to use): walk to its door and in. Its sign opens its page.
    const door = world.room === "town" ? doorOf(world.map, x, y) : null;
    if (door) return void walkTo(...door);
    walkTo(x, y);
  });
  // Right-click a drop (or yourself, on one): take it, walking there first (onto it, into its seat, or
  // up to it). Never the browser's menu.
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (hud.get().panel) return;
    const tile = pickTile(e.clientX, e.clientY);
    const me = self();
    if (!tile || !me || !dropAt(tile.x, tile.y)) return;
    const { x, y } = tile;
    if (x === me.x && y === me.y) return void take();
    walkTo(x, y);
    // A seat is sat on first; anything else is only taken.
    interactOnArrival &&= world.map.kind(x, y).seat !== undefined;
    takeOnArrival = path.length > 0;
  });
}

/**
 * "Take me there": walks to a shop's door. In the town that is its storefront; from anywhere else it walks
 * out of the room first (each room's exit), room after room. Any key press or click on the map stops it.
 * False when the shop has no door in the town right now (a company holds its block).
 */
export function goToShopDoor(shop: ShopId): boolean {
  if (!MAPS.town.find(SHOP_DOOR_CHAR[shop])[0]) return false;
  heading = shop;
  hud.set({ panel: null });
  return true;
}

/** The next leg of the trip to `heading`: the shop's door in town, otherwise this room's way out. */
function planTrip(me: { x: number; y: number }): void {
  const shop = heading!;
  if (world.room === SHOP_ROOM[shop]) {
    heading = null;
    return;
  }
  const to = world.room === "town" ? MAPS.town.find(SHOP_DOOR_CHAR[shop])[0] : world.map.find("x")[0];
  const steps = to ? route(world.map, [me.x, me.y], to) : null;
  if (!steps?.length) {
    heading = null;
    return;
  }
  path = steps;
  interactOnArrival = false;
  takeOnArrival = false;
}

/** Click-to-walk (the world or the minimap): route there, and interact if it's a thing, not floor. */
export function walkTo(x: number, y: number): void {
  heading = null;
  const me = self();
  takeOnArrival = false;
  if (!me || (x === me.x && y === me.y)) return;
  path = route(world.map, [me.x, me.y], [x, y]) ?? [];
  interactOnArrival = path.length > 0 && !world.map.walkable(x, y) && !world.map.kind(x, y).portal;
}

/**
 * Walks to (`x`, `y`) and ends facing `dir`, then runs `then`: the route to the tile behind it, and one more step
 * the way it looks. False when there is no way (nothing changes).
 */
export function walkThen(x: number, y: number, dir: Facing, then: () => void): boolean {
  const me = self();
  if (!me) return false;
  const [dx, dy] = DIRS[dir];
  const behind: [number, number] = [x - dx, y - dy];
  const there = world.map.walkable(...behind) ? route(world.map, [me.x, me.y], behind) : null;
  const steps = there ? [...there, dir] : route(world.map, [me.x, me.y], [x, y]);
  if (!steps) return false;
  path = steps;
  interactOnArrival = false;
  takeOnArrival = false;
  onArrival = then;
  return true;
}

/** The server's answer to a move: a notice, a correction, or another room (its snapshot follows). */
export function send(result: Promise<StepResult>): void {
  result
    .then((r) => {
      if (!r) {
        world.portalPending = false;
        return;
      }
      if ("notice" in r) {
        world.portalPending = false;
        hud.set({ dialog: r.notice });
        return;
      }
      const me = self();
      // Same room: the server disagreed (too fast, a seat) — take its word. Another room: a snapshot follows.
      if (me && r.room === world.room) {
        Object.assign(me, { x: r.x, y: r.y, facing: r.facing, state: r.state, from: null });
        world.portalPending = false;
      }
    })
    .catch(() => {
      world.portalPending = false;
    });
}

/** Whether tile (x, y) is where my pet stands, or where I stand (the pet menu opens on either). */
const isMyPetAt = (x: number, y: number): boolean => {
  const tile = myPetTile();
  return tile !== null && tile[0] === x && tile[1] === y;
};
const avatarIsMe = (x: number, y: number): boolean => {
  const me = self();
  return me !== undefined && me.x === x && me.y === y;
};

/** Whether I hold a seat at the Tavern's poker table (a hand in play is mine to fold, so the arrow keys wait). */
const atPoker = (): boolean =>
  hud.get().poker?.seats.some((s) => s?.userId === world.selfId && !s.leaving) ?? false;

/** Whether I stand at a roulette spot with its panel open (the arrow keys wait, like at the poker table). */
const atRoulette = (): boolean => {
  const panel = hud.get().panel;
  return (
    panel?.kind === "roulette" &&
    !panel.watch &&
    (hud.get().roulette?.seats.some((s) => s.userId === world.selfId) ?? false)
  );
};

/** Takes a spot at the roulette table (`rouletteSit`); false, with the reason as a notice, if the server refuses. */
export async function sitRoulette(): Promise<boolean> {
  const me = self();
  if (!me) return false;
  const r = await conn.rouletteSit(me.facing);
  if (r) send(Promise.resolve(r)); // the spot I was moved onto, or the reason I wasn't
  if (r && !("notice" in r)) return true;
  return hud.get().roulette?.seats.some((s) => s.userId === world.selfId) ?? false;
}

/**
 * Roulette from anywhere (`rouletteJoin`): the table is always the net cafe's and shared, so this takes me down
 * there and onto a free spot, and opens the betting view. A full table leaves me in the net cafe, watching.
 */
export async function joinRoulette(): Promise<void> {
  hud.set({ panel: null });
  const r = await conn.rouletteJoin();
  if (r) send(Promise.resolve(r)); // where I ended up, or the reason I stayed put
  if (r && !("notice" in r)) hud.set({ panel: { kind: "roulette" } });
}

/** Called every frame: start the next step if a key is held or a clicked path remains. */
export function updateSelf(now: number): void {
  const me = self();
  updatePieceHint(me);
  tickGhost();
  if (!me || world.portalPending || stepping(me, now)) return;
  // Through a door with a key held, you arrive right in front of the way back (the Tavern's stairs and the
  // basement's, one tile from each other): let go of it, or the held key bounces you between the two.
  if (world.room !== lastRoom) {
    if (lastRoom) for (const d of held) carried.add(d);
    held.length = 0;
    tapped = null;
    turning = null;
    // Walking out of a shop closes its page; walking in, the keeper says hello.
    if (shopOfRoom(lastRoom) && hud.get().panel?.kind === "shop") hud.set({ panel: null });
    const shop = shopOfRoom(world.room);
    if (shop && lastRoom) hud.set({ dialog: greeting(shop, greetings++) });
    lastRoom = world.room;
  }
  if (heading && (held.length > 0 || tapped)) heading = null;
  if (heading && path.length === 0 && !onArrival) planTrip(me);
  // At a game table: stay put until the game is over. At the poker table: until you leave it.
  if (me.state === "playing" || atPoker() || atRoulette()) {
    tapped = null;
    path = [];
    return;
  }
  // Keys are kept as pressed; the 3D view may be turned since, so they mean a direction only now.
  const pressed = held.at(-1) ?? tapped;
  const dir = pressed ? (viewHooks.key?.(pressed) ?? pressed) : path.shift();
  tapped = null;
  if (!pressed) turning = null;
  // Moving stands you up from your war desk in the raid dungeon, and ends a dance (the server does too).
  if (dir) {
    standUp();
    if (me.info.dance) showMyDance(0);
  }
  if (!dir) {
    if (interactOnArrival) {
      interactOnArrival = false;
      interact();
    }
    if (takeOnArrival) {
      takeOnArrival = false;
      take();
    }
    if (onArrival) {
      const run = onArrival;
      onArrival = null;
      run();
    }
    return;
  }
  // Getting up from bed or desk: the server puts us back where we were before, so wait for it.
  if (me.state === "away" || me.state === "working") {
    world.portalPending = true;
    send(conn.step(dir));
    return;
  }
  // A key for another way than I face turns me first, and walks only if it stays held. A clicked path doesn't
  // wait: its steps are chosen, and turning at every corner would stutter. Nor does getting up from a seat.
  if (pressed && me.state === "idle") {
    const t = turnStep(turning, dir, me.facing, now);
    turning = t.turning;
    if (t.act === "turn") {
      me.facing = dir;
      send(conn.turn(dir));
    }
    if (t.act !== "walk") return;
  }
  const step = stepTarget(world.map, me.x, me.y, dir);
  const target =
    step.kind === "move" &&
    (blocksStep(step.x, step.y) ||
      blocksLaunch(step.x, step.y) ||
      blocksTruck(step.x, step.y) ||
      blocksBarrel(step.x, step.y) ||
      blocksBonfire(step.x, step.y) ||
      blocksGrave(step.x, step.y))
      ? { kind: "blocked" as const }
      : step;
  if (target.kind === "blocked") {
    if (me.facing !== dir || me.state !== "idle") send(conn.step(dir));
    me.facing = dir;
    if (!interactOnArrival) path = [];
    return;
  }
  if (hud.get().dialog) hud.set({ dialog: null });
  me.facing = dir;
  me.state = "idle";
  if (target.kind === "portal") world.portalPending = true;
  else
    beginStep(
      me,
      target.x,
      target.y,
      (running ? RUN_STEP_MS : WALK_STEP_MS) * stepPace(me.info.polseUntil, Date.now()),
    );
  send(conn.step(dir));
}

/** Facing one of my own pieces: the keys that take it back or move it, shown at the bottom. */
function updatePieceHint(me: ReturnType<typeof self>): void {
  const piece =
    me && me.state === "idle"
      ? ownPieceAt(world.room, me, world.drops, world.selfId, me.info.companyId)
      : undefined;
  const text = !piece
    ? null
    : `${dropName(piece)}: G ${piece.co === undefined ? "puts it in your bag" : "takes it back to the storeroom"} · M moves it${canTurn(piece.item.slice(5)) ? " · F turns it" : ""}`;
  if (hud.get().pieceHint !== text) hud.set({ pieceHint: text });
}

/** G, or a right-click: take what's there. It goes in the bag, so 🎒 counts one more. */
function take(): void {
  send(
    conn.take().then((r) => {
      if (r?.drop) {
        recordTake(r.drop);
        hud.set((s) => ({ wallet: s.wallet && { ...s.wallet, items: s.wallet.items + 1 } }));
      }
      return r;
    }),
  );
}

/** Space: a hop, standing or walking. Everyone in the room sees it. */
export function jump(): void {
  const me = self();
  const now = performance.now();
  if (me?.state !== "idle" || (me.jump !== null && now - me.jump < JUMP_MS)) return;
  me.jump = now;
  void conn.jump().catch(() => {});
}

/** What the shop pages open on at each shop's counter. */
const COUNTER_TAB = {
  furniture: "furniture",
  clothes: "outfit",
  barber: "look",
  pets: "pet",
  natmarked: "case",
  market: "market",
} as const;

/** E in a shop room on its counter or a display: the Shop page on the matching tab (the barber opens the Bag on You). */
function shopInteract(x: number, y: number): boolean {
  const shop = shopOfRoom(world.room);
  const kind = world.map.kind(x, y);
  if (!shop || !(kind.counter || kind.shop)) return false;
  const tab = kind.counter ? COUNTER_TAB[shop] : displayTab(shop, x, y);
  // Natmarked sells cases, not items: its counter opens the case page, and a shelf opens it on that shelf's case.
  if (tab === "case") {
    hud.set({ panel: { kind: "caseShop", shelf: kind.counter ? undefined : (shelfAt(x, y) ?? undefined) } });
    return true;
  }
  // Torvehallen sells what players put on display: its counter opens the market, a case or shelf is one slot.
  if (tab === "market") {
    const slot = kind.counter ? null : slotAt(x, y);
    hud.set({ panel: slot === null ? { kind: "market" } : { kind: "marketSlot", slot } });
    return true;
  }
  // The 3D renderer has its own buy card for a shelf of goods (the counter, the barber's mirror and
  // Møbelhuset's wallpaper, monitors and company supplies open the page's tab instead).
  const tabbed = tab === "decor" || tab === "desk" || tab === "company";
  if (kind.shop && !tabbed && viewHooks.shop?.(shop, x, y)) return true;
  hud.set({ panel: tab === "look" || tab === null ? { kind: "bag", tab: "you" } : { kind: "shop", tab } });
  return true;
}

/** E: talk to whoever or whatever is in front of you. */
function interact(): void {
  const me = self();
  if (!me) return;
  const [dx, dy] = DIRS[me.facing];
  const x = me.x + dx;
  const y = me.y + dy;
  // At your war desk in the raid dungeon, E stands you up again.
  if (seated()) return void standUp();
  const other = avatarAt(x, y);
  if (other) return void hud.set({ panel: { kind: "card", userId: other.info.id } });
  if (interactAnimal(x, y) || interactTownProp(x, y) || bandInteract(x, y)) return;
  // E on your own clone (or its laptop) in the raid dungeon takes your seat; others' seats are not yours.
  if (world.room === "dungeon" && sit(x, y)) return;
  if (streetInteract(me, x, y, send)) return;
  if (windmillInteract(x, y)) return;
  if (truckInteract(x, y)) return;
  if (barrelInteract(me, x, y, send)) return;
  if (bonfireInteract(x, y)) return;
  if (launchInteract(me)) return;
  if (graveInteract(me)) return;
  if (keynoteInteract(me)) return;
  if (merchantAt(x, y)) return void openCart();
  const ch = world.map.at(x, y);
  const kind = world.map.kind(x, y);
  if (world.room === "town" && ch === "~") return void hud.set({ panel: { kind: "fishing" } });
  if (ch === "N") return void hud.set({ panel: { kind: "leaderboard" } });
  if (ch === STAR_COUNTER) return void hud.set({ panel: { kind: "stars" } });
  if (kind.roulette || world.map.kind(me.x, me.y).roulette) {
    if (atRoulette()) return;
    return void sitRoulette().then((ok) => {
      if (ok) hud.set({ panel: { kind: "roulette" } });
    });
  }
  if (ch === "♦") return void hud.set({ panel: { kind: "roulette", watch: true } });
  if (ch === "♠") return void hud.set({ panel: { kind: "pokerWatch" } });
  if (kind.poker) return void send(conn.pokerSit(me.facing));
  if (kind.seat || picnicSeat(x, y)) return void send(conn.sit(me.facing));
  if (kind.pours) return void send(conn.drink(me.facing));
  if (kind.tosses)
    return void send(
      conn.toss(me.facing).then((r) => {
        if (r && "notice" in r && tossLanded(r.notice)) viewHooks.toss?.(x, y);
        return r;
      }),
    );
  if (kind.serves) return void send(conn.tavern(me.facing));
  // The Tavern's boards: the barkeep takes orders at the bar, the quest board gives out quests, the wall is the Hall of Fame.
  if (world.room === "inn") {
    if (kind.orders) return void hud.set({ panel: { kind: "bar" } });
    if (ch === "m") return void hud.set({ panel: { kind: "quests" } });
    if (ch === "A") return void hud.set({ panel: { kind: "hallOfFame" } });
    if (ch === "P" || ch === "J") return void hud.set({ panel: { kind: "regulars" } });
    if (ch === "z") return void hud.set({ panel: { kind: "jukebox" } });
    if (ch === "?") return void hud.set({ panel: { kind: "requests" } });
    if (ch === "◷") return void hud.set({ dialog: clocksText() });
  }
  if (shopInteract(x, y)) return;
  if (basementInteract(x, y)) return;
  if (ch === "K") return void hud.set({ dialog: chalkboardText() });
  if (ch === STATUE_TILE) return void hud.set({ dialog: statueText() });
  if (ch === "w") return void hud.set({ panel: { kind: "openOffices" } });
  if (ch === "ς") return void hud.set({ panel: { kind: "directory" } });
  if (ch === "U") return void openTrophies();
  if (ch === "H") {
    const b = buildingAt(x, y);
    const company = b?.plot ? companyOnPlot(b.plot) : null;
    // A company's house opens its page.
    if (company) return void hud.set({ panel: { kind: "companyCard", companyId: company.id } });
    return void hud.set({
      dialog:
        b?.plot === null ? `The ${TAVERN ? "Tavern" : "Inn"}. Beds for anyone without a company.` : null,
    });
  }
  if (kind.text) hud.set({ dialog: kind.text });
}
