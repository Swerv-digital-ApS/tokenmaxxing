import { auraOf } from "@tokenmaxxing/core/dances.ts";
import { effectiveDesk } from "@tokenmaxxing/core/desks.ts";
import { compact } from "@tokenmaxxing/core/format.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { BLOCK_W } from "@tokenmaxxing/core/maps.ts";
import { sideways, tilesOf, turnAt, withPieces } from "@tokenmaxxing/core/office.ts";
import { petOutfit } from "@tokenmaxxing/core/pets.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import type { Weather } from "@tokenmaxxing/core/sky.ts";
import { hasSpecial, specialBuff, TAVERN } from "@tokenmaxxing/core/tavern.ts";
import {
  type CompanyInfo,
  companyOfRoom,
  cupsLeft,
  type Facing,
  houseTier,
  JUMP_MS,
  memberRoomOf,
  ownerOfOffice,
  pieceOfDrop,
  TILE,
} from "@tokenmaxxing/core/world.ts";
import { clamp, typedSwitch, typedSwitchGroup } from "hanzio";
import { house, inn } from "../art/buildings.ts";
import { characterFrame, itemFrame, lookPalette, poseFor, sleeperFrame } from "../art/characters.ts";
import { deskFrame, type ScreenMode } from "../art/desks.ts";
import { type FancyPiece, fancyFrame, fancySprite, neonSprite } from "../art/furniture-fancy.ts";
import { drawSparkle, wearsLegendary } from "../art/loot.ts";
import { coloursOf } from "../art/merch.ts";
import { chairBack, objectAt, petBedFront, sortY } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { SLEEP_H, SLEEP_W, sleepingFrame } from "../art/pet-sleep.ts";
import { PET_H, PET_W, petFrame } from "../art/pets.ts";
import { initialsOf, perObject } from "../art/pixels.ts";
import { drawWaterGlints } from "../art/tiles.ts";
import { graphics } from "../settings/graphics.ts";
import { drawBasement, lightBasement } from "./basement.ts";
import { camera, zoomScale } from "./camera.ts";
import { drawChalkboards } from "./chalkboard.ts";
import { drawClocks } from "./clocks.ts";
import {
  breathPuff,
  type Chill,
  chillOf,
  drawBreath,
  drawScarf,
  sneezeJolt,
  sneezeOf,
  wearsScarf,
} from "./cold.ts";
import { drawCop, isCop } from "./cop.ts";
import { battlers, type Dance2D, dance2D, danceOf, rgbOf } from "./dance.ts";
import { doorSwing, drawDoorSwing } from "./doors.ts";
import { drawBarrel } from "./fastelavn.ts";
import { drawFireworks } from "./fireworks.ts";
import { drawFishing } from "./fishing.ts";
import { type Frame, inView } from "./frame.ts";
import { ghost } from "./furniture.ts";
import { drawGames } from "./games.ts";
import { drawGlow } from "./glow.ts";
import { drawGraveyard } from "./graveyard.ts";
import { lampDim } from "./grid.ts";
import { drawGrid } from "./grid-board.ts";
import { drawPumpkins, lightPumpkins } from "./halloween.ts";
import { buildings, companyOnPlot, drawFace, drawLogo, peekHits } from "./houses.ts";
import { drawTruck, lightTruck } from "./jdag.ts";
import { drawKeynote, lightKeynote } from "./keynote.ts";
import {
  avatarLabels,
  burst,
  chipHits,
  chips,
  chipsWidth,
  focusLabels,
  petLabel,
  pill,
  sign,
  signHits,
} from "./labels.ts";
import { drawLaunch } from "./launch.ts";
import { drawLeaves } from "./leaves.ts";
import { drawAura, drawPetCrown, labelLift } from "./legendary.ts";
import { drawLoot } from "./loot.ts";
import { drawMarket } from "./market.ts";
import { drawMerchant } from "./merchant.ts";
import { LABEL_FAR } from "./near.ts";
import { PLAY_LIFT } from "./petplay.ts";
import { followPet, prunePets, reactionOf } from "./pets.ts";
import { drawPicnic } from "./picnic.ts";
import { type Lap, racing } from "./race.ts";
import { drawRaid } from "./raid.ts";
import { drawBonfire, lightBonfire } from "./sankthans.ts";
import { seasonalCanvas, seasonLookNow, treeVariant } from "./seasons.ts";
import {
  drawLight,
  drawLights,
  drawNightSky,
  drawSway,
  drawWeather,
  type LitWindow,
  lightsNow,
  weatherNow,
  windPush,
} from "./sky.ts";
import { iceAmount, iceLayer, snowAmount, snowLayers } from "./snow.ts";
import { drawStars } from "./stars.ts";
import { drawStatue } from "./statue.ts";
import { drawStreet } from "./street.ts";
import { drawTavern, lightTavern } from "./tavern.ts";
import { drawTownAnimals } from "./town-life.ts";
import { tremor2d, tremorPhase } from "./tremor.ts";
import { drawTrophies } from "./trophies.ts";
import { drawWindmills } from "./windmill.ts";
import { type Avatar, drawPos, stepping, WARP_MS, world } from "./world.ts";

let lastFrame = performance.now();

/** Tiles within which other players' pet names show. */
const NAME_RANGE = LABEL_FAR;
/** How far (in canvas pixels, per device pixel) labels reach past what they're over: bubbles, emoji bursts. */
const LABEL_REACH = 160;

/** A pet's costume, once per look. */
const outfitOf = perObject(petOutfit);

export function render(canvas: HTMLCanvasElement, now: number, dpr = window.devicePixelRatio || 1): void {
  const g = canvas.getContext("2d")!;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const scale = zoomScale(dpr, w, h, now);
  const map = world.map;
  const viewW = w / scale;
  const viewH = h / scale;
  const me = world.avatars.get(world.selfId);
  const focus = me ? drawPos(me, now) : { x: map.x0 + map.width / 2, y: map.y0 + map.height / 2 };
  focusLabels(me ? focus : null, graphics.get().overrides.labels === "all", now);
  const clampCam = (center: number, view: number, start: number, size: number) =>
    start + (size <= view ? (size - view) / 2 : clamp(center - start - view / 2, 0, size - view));
  const camX =
    Math.round(clampCam((focus.x + 0.5) * TILE, viewW, map.x0 * TILE, map.width * TILE) * scale) / scale;
  // The chat sits over the bottom left: let the map scroll up past its last row by the chat's height, so
  // a door in the bottom wall (the Tavern's stairs, the basement's way out) isn't under it.
  const dock = document.querySelector<HTMLElement>(".chat-dock");
  const chatPad = dock ? (dock.offsetHeight * dpr) / scale : 0;
  const camY =
    Math.round(clampCam((focus.y + 0.5) * TILE, viewH, map.y0 * TILE, map.height * TILE + chatPad) * scale) /
    scale;
  Object.assign(camera, { x: camX, y: camY, scale, dpr });

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = typedSwitch(map.id, {
    town: () => C.leafInk,
    basement: () => "#100e1e",
    dungeon: () => "#110f16",
    ...typedSwitchGroup(
      map.id,
      [
        "hq",
        "common",
        "inn",
        "upstairs",
        "office",
        "shop-furniture",
        "shop-clothes",
        "shop-barber",
        "shop-pets",
        "shop-natmarked",
        "shop-market",
      ],
      () => "#1b1f2a",
    ),
  });
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
  const outdoors = map.id === "town";
  // The weather once a frame, for the trees leaning in the wind.
  const weather = outdoors ? weatherNow() : null;
  // Snow (town only): twins of the baked ground and sprites, cross-faded while it settles or melts.
  const snow = outdoors ? snowAmount(now) : 0;
  // Below freezing the pond ices over (`snow.ts`); in the cold, breath shows and the bots wear scarves (`cold.ts`).
  const ice = outdoors ? iceAmount(now) : 0;
  const chill = weather ? chillOf(weather) : null;
  // The season's look (`seasons.ts`): the town's trees, bushes and grass are drawn as its twins.
  const season = outdoors ? seasonLookNow() : null;
  const paint = (c: HTMLCanvasElement, x: number, y: number, ch: string) => {
    if (weather && (ch === "T" || ch === "^")) drawSway(g, c, ch, x, y, now, weather);
    else g.drawImage(c, x, y);
  };
  const snowy = (plain: HTMLCanvasElement, x: number, y: number, ch = "", ground = false) => {
    const plant = ground ? "ground" : ch === "T" ? "tree" : ch === "^" ? "bush" : null;
    const src =
      season && plant
        ? seasonalCanvas(plain, plant, season, plant === "tree" ? treeVariant(x, y) : 0)
        : plain;
    if (snow < 0.01) return paint(src, x, y, ch);
    for (const [c, a] of snowLayers(src, snow, ground, plain)) {
      g.globalAlpha = a;
      paint(c, x, y, ch);
    }
    g.globalAlpha = 1;
  };
  if (world.ground) snowy(world.ground, map.x0 * TILE, map.y0 * TILE, "", true);
  if (world.ground && ice > 0.01) {
    g.globalAlpha = ice;
    g.drawImage(iceLayer(world.ground), map.x0 * TILE, map.y0 * TILE);
    g.globalAlpha = 1;
  }
  if (snow < 0.7 && ice < 0.5) drawWaterGlints(g, map, now);

  const x0 = Math.max(map.x0, Math.floor(camX / TILE) - 1);
  const y0 = Math.max(map.y0, Math.floor(camY / TILE) - 1);
  const x1 = Math.min(map.x0 + map.width, Math.ceil((camX + viewW) / TILE) + 1);
  const y1 = Math.min(map.y0 + map.height, Math.ceil((camY + viewH) / TILE) + 3);
  const f: Frame = {
    g,
    items: [],
    labels: [],
    now,
    dpr,
    scale,
    view: { x0: camX, y0: camY, x1: camX + viewW, y1: camY + viewH },
    toScreen: (px, py) => [(px - camX) * scale, (py - camY) * scale] as const,
  };
  const { items, labels, toScreen } = f;
  peekHits.length = 0;
  chipHits.length = 0;
  signHits.length = 0;
  // Outdoors only: lamps and lit windows to shine over the night's tint (see `sky.ts`).
  const lamps: [number, number][] = [];
  const windows: LitWindow[] = [];
  // The trees in view (their sprites' top left), for the leaves that fall from them.
  const trees: [number, number][] = [];
  // At night the lit windows' faces are drawn again over the tint, opaque, so the first time is skipped.
  // Only at a whole-number zoom: in between, the panes' soft edges would show what was under them.
  const relit = outdoors && Number.isInteger(scale) && lightsNow(now) > 0.05;

  // Desk setups: who sits at a desk (on the chair below it) decides its screens; a house's fleet tier is
  // every desk's floor, empty ones too. `world.avatars` has everyone in the room.
  const fleet = world.companies.get(companyOfRoom(world.room) ?? -1)?.deskFleet;
  let seated: Map<number, Avatar> | undefined;
  const deskAt = (x: number, y: number): { tier: number; mode: ScreenMode } => {
    if (!seated) {
      seated = new Map();
      for (const a of world.avatars.values())
        if (a.state === "working" || a.state === "sit") seated.set(map.index(a.x, a.y), a);
    }
    const a = map.at(x, y + 1) === "c" ? seated.get(map.index(x, y + 1)) : undefined;
    const tier = effectiveDesk(a?.info.desk, fleet);
    return {
      tier,
      mode: !a ? "off" : a.state === "working" ? (Math.floor(now / 180) % 2 ? "typingA" : "typingB") : "lit",
    };
  };

  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = objectAt(map, x, y);
      const ch = map.at(x, y);
      if (o) {
        if (outdoors && ch === "L") lamps.push([x * TILE + TILE / 2, y * TILE - 11]);
        if (outdoors && ch === "T") trees.push([x * TILE + o.dx, y * TILE + o.dy]);
        // Upside down or turned the other way: each tile mirrored about the piece's middle (a piece lying down its
        // column has no sideways art: it is drawn as it is at its top tile).
        const turn = turnAt(map, x, y);
        const mirrored = turn?.rot === 2 ? turn : turn?.rot === 3 ? { x: turn.x, w: 1 } : null;
        items.push({
          y: y * TILE + sortY(ch),
          draw: () => {
            if (mirrored) mirror(g, mirrored.x, mirrored.w);
            const desk = ch === "d" ? deskAt(x, y) : null;
            if (desk && desk.tier > 0)
              g.drawImage(deskFrame(desk.tier, desk.mode), x * TILE, (y + 1) * TILE - 22);
            // The company building's pieces are indoors, out of the snow.
            else if (o.fancy) g.drawImage(fancyCanvas(o.fancy, now), x * TILE + o.dx, y * TILE + o.dy);
            else snowy(o.canvas, x * TILE + o.dx, y * TILE + o.dy, ch);
            if (mirrored) g.restore();
          },
        });
      }
      // The pet bed's near wall goes over whatever lies in it.
      if (ch === "Q") {
        const near = petBedFront();
        items.push({
          y: y * TILE + TILE - 1,
          draw: () => g.drawImage(near.canvas, x * TILE + near.dx, y * TILE + near.dy),
        });
      }
    }

  drawTrophies(f);

  // Where everyone is drawn this frame, for the doors (`doorSwing`) and the people themselves.
  const everyone = [...world.avatars.values(), ...world.leaving];
  const spots = everyone.map((a) => drawPos(a, now));
  for (const b of buildings(map)) {
    const company = b.plot === null ? null : companyOnPlot(b.plot);
    if (b.plot !== null && !company) continue; // the town catches up with a company closing
    const tier = company ? houseTier(company.tokens30d, company.members) : 0;
    // A cellar hatch (tier 0) is already open; every other building's door swings, seen or not.
    const swing = !company || tier > 0 ? doorSwing(b.x + 3, b.y + b.h - 1, now, spots) : 0;
    const plan = company ? house(tier, company.brand) : null;
    const sprite = plan?.canvas ?? inn();
    const left = b.x * TILE;
    const bottom = (b.y + b.h) * TILE;
    const top = bottom - sprite.height;
    const inside = company ? (world.houses[company.id] ?? []) : [];
    // Nothing of it on screen, its sign and name chips included (they can be wider than it): skip it.
    const cx = left + (b.w * TILE) / 2;
    const wide = Math.max((BLOCK_W - 0.5) * TILE * scale, inside.length ? chipsWidth(g, inside, dpr) : 0);
    const from = Math.min(left, cx - wide / 2 / scale);
    const to = Math.max(left + sprite.width, cx + wide / 2 / scale);
    const above = (21 * dpr) / scale;
    if (!inView(f, from, top - above, to - from, bottom - top + above, TILE)) continue;
    const panes = plan?.panes ?? [];
    const plaque = plan?.plaque;
    const logo = company?.brand?.logo;
    const faces = inside.slice(0, panes.length);
    for (const [i, p] of faces.entries()) {
      const pane = panes[i]!;
      peekHits.push({ x: left + pane.x, y: top + pane.y, w: pane.w, h: pane.h, id: p.id });
    }
    // At night each window shines: the people at home in it, or (for some empty rooms) just a lamp.
    if (outdoors)
      for (const [i, pane] of panes.entries()) {
        const p = faces[i];
        const activeOffice = company && world.officeLights.has(company.id) && i === 0;
        if (!activeOffice && (!p || p.state === "away")) continue;
        const [x, y] = [left + pane.x, top + pane.y];
        windows.push({ x, y, w: pane.w, h: pane.h, face: p ? () => drawFace(g, p, x, y, pane, now) : null });
      }
    items.push({
      y: bottom - 1,
      draw: () => {
        snowy(sprite, left, top);
        drawDoorSwing(g, sprite, left, top, swing);
        if (company && world.officeLights.has(company.id) && panes[0]) {
          const pane = panes[0];
          g.fillStyle = "#ffd98a";
          g.fillRect(left + pane.x, top + pane.y, pane.w, pane.h);
        }
        if (logo && plaque) drawLogo(g, logo, left + plaque.x, top + plaque.y, plaque.w, plaque.h);
        for (const [i, p] of faces.entries())
          if (!(relit && p.state !== "away"))
            drawFace(g, p, left + panes[i]!.x, top + panes[i]!.y, panes[i]!, now);
      },
    });
    const [sx, sy] = toScreen(cx, top);
    const text = company
      ? `🏢 ${company.name} · ${compact(company.todayTokens)} today`
      : `🛏 The ${TAVERN ? "Tavern" : "Inn"}`;
    labels.push(() => {
      const y = sy - 6 * dpr;
      const { w, h } = sign(g, sx, y, text, dpr, company !== null, (BLOCK_W - 0.5) * TILE * scale);
      if (company) signHits.push({ x: sx - w / 2, y: y - h, w, h, id: company.id });
    });
    if (inside.length) labels.push(() => chips(g, sx, sy + 4 * dpr, inside, dpr));
  }

  // Office doors: the owner's name over each; yours stands out.
  for (const d of world.doors) {
    const [sx, sy] = toScreen((d.x + 0.5) * TILE, d.y * TILE);
    labels.push(() => sign(g, sx, sy, d.name, dpr, d.userId === world.selfId, 1.9 * TILE * scale));
  }

  // Drops: furniture is in the map; a pet or a wearable lies there as itself.
  for (const d of world.drops) {
    const kind = itemById(d.item);
    if (!kind || kind.slot === "furniture") continue;
    const sprite = kind.slot === "pet" ? petFrame(kind.index, false, false) : itemFrame(kind);
    if (sprite)
      items.push({
        y: d.y * TILE + TILE / 2,
        draw: () =>
          g.drawImage(sprite, d.x * TILE + (TILE - sprite.width) / 2, (d.y + 1) * TILE - sprite.height - 1),
      });
  }

  drawGames(f);
  drawStreet(f);
  drawWindmills(f);
  drawLaunch(f);
  drawGraveyard(f);
  drawStatue(f);
  drawStars(f);
  drawFireworks(f);
  drawPicnic(f);
  drawGrid(f);
  drawPumpkins(f);
  drawTruck(f);
  drawBarrel(f);
  drawBonfire(f);
  drawChalkboards(f);
  drawClocks(f);
  drawTavern(f);
  drawKeynote(f);
  drawTownAnimals(f);
  drawFishing(f);
  drawBasement(f);
  drawMerchant(f);
  drawMarket(f);
  drawRaid(f);
  drawLoot(f);

  if (world.asleep > 0) {
    const [sx, sy] = toScreen((map.x0 + map.width / 2) * TILE, (map.y0 + 2) * TILE);
    labels.push(() =>
      pill(g, sx, sy - 2 * dpr, `💤 ${world.asleep} asleep`, dpr, "rgba(43, 36, 51, 0.7)", C.white),
    );
  }

  const dt = Math.min(100, now - lastFrame);
  lastFrame = now;
  prunePets();
  // In their own office the pet goes to its bed and sleeps there, whoever's looking.
  const owner = ownerOfOffice(world.room);
  const bedAt = owner === null ? undefined : map.find("Q")[0];
  // Off screen, someone (and their pet) still moves on, but nothing of them is drawn.
  const reach = 3 * TILE + (LABEL_REACH * dpr) / scale;
  const fights = battlers(everyone);
  for (const [i, a] of everyone.entries()) {
    // A Sprint Race's racers run laps of the square instead of standing at the table.
    const lap = racing(a.info.id, now);
    const pos = lap ?? spots[i]!;
    const px = pos.x * TILE;
    const py = pos.y * TILE;
    const tile = lap ? ":" : map.at(a.x, a.y);
    // The cop is always drawn: his siren works out whether he's on a case as he's drawn.
    const seen = isCop(a) || inView(f, px, py, TILE, TILE, reach);
    if (seen) {
      items.push({
        y: py + (tile === "b" || tile === "s" ? 1 : TILE - 0.5),
        draw: () => drawAvatar(g, a, px, py, tile, now, lap, chill, weather),
      });
      // A legendary sparkles on whoever wears it.
      if (wearsLegendary(a.info.look))
        items.push({ y: py + TILE, draw: () => drawSparkle(g, px, py - 2, now, a.info.id) });
    }
    const pet = a.warp ? null : followPet(a, px, py, dt, owner === a.info.id ? bedAt : undefined);
    const petSeen = pet !== null && inView(f, pet.x, pet.y, PET_W, PET_H, reach);
    if (pet && petSeen) {
      // A reaction (`petPlay`) lifts it off the ground; a trick flips it side to side as it turns in the air.
      const play = pet.asleep ? null : reactionOf(a.info.id, now);
      const lift = Math.round((play?.pose.lift ?? 0) * PLAY_LIFT);
      const spun = play?.act === "trick" && Math.floor(play.pose.spin * 8) % 2 === 1;
      const left = spun ? !pet.left : pet.left;
      const hop = (pet.moving && Math.floor(now / 140) % 2 === 0) || lift > PLAY_LIFT / 2;
      const worn = a.info.look;
      const outfit = outfitOf(worn);
      // In bed it curls up without its gear.
      const asleep = pet.asleep
        ? sleepingFrame(
            petFrame(worn.pet, pet.left, hop, worn.petVariant, outfit),
            pet.left,
            Math.floor(now / 600),
          )
        : null;
      const frame = asleep ?? petFrame(worn.pet, left, hop, worn.petVariant, outfit, worn.petwear);
      if (frame)
        items.push({
          y: pet.y + PET_H,
          draw: () => {
            if (asleep) {
              g.drawImage(
                asleep,
                Math.round(pet.x) - (SLEEP_W - 12) / 2,
                Math.round(pet.y) + PET_H - SLEEP_H,
              );
              return;
            }
            g.drawImage(frame, Math.round(pet.x), Math.round(pet.y) - lift + PET_H - frame.height);
            drawPetCrown(g, a, Math.round(pet.x), Math.round(pet.y) - lift, left, hop);
          },
        });
      // The hearts, treats or stars rise from it.
      if (play)
        labels.push(() => burst(g, ...toScreen(pet.x + PET_W / 2, pet.y - lift), play.emojis, play.age, dpr));
    }
    // A pet's name shows for mine and for those within a few tiles of me.
    const petName = a.info.look.petName;
    if (pet && petSeen && petName && (!me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE))
      labels.push(() => petLabel(g, ...toScreen(pet.x + PET_W / 2, pet.y + PET_H + 1), petName, dpr));
    if (seen)
      labels.push(() =>
        avatarLabels(
          g,
          a,
          ...toScreen(px + TILE / 2, py - labelLift(a)),
          tile,
          now,
          dpr,
          fights.has(a.info.id),
        ),
      );
  }

  items.sort((a, b) => a.y - b.y);
  for (const i of items) i.draw();
  if (season && weather) drawLeaves(g, trees, season.look.falling, weather, now);
  drawGhost(g, map, now, fancyCanvas);
  // The Tavern's fire and candles (and the dark, after sunset): `inn` only.
  lightTavern(f);
  lightKeynote(f);
  lightBasement(f);

  // The sky: the sun's tint over the town, lights shining through it, then the weather. Labels
  // (and the HTML HUD) come after, so they stay readable.
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (outdoors) {
    const glow = drawLight(g, w, h, now);
    if (glow > 0.05) {
      g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
      drawLights(g, lamps, windows, glow, lampDim());
      lightPumpkins(g, glow, now);
      lightTruck(g, glow, now);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    // The Sankt Hans bonfire is lit in the June dusk, before the lamps come on.
    g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    lightBonfire(g, glow, now);
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawNightSky(g, w, h, dpr, now);
    drawWeather(g, w, h, dpr, now);
  }
  for (const l of labels) l();
}

/** What a company's neon sign says: its name, or its initials when the name won't fit. Once per company. */
const neonText = perObject((company: CompanyInfo) => {
  const word = company.name
    .toUpperCase()
    .replace(/[^A-Z0-9&! ]/g, "")
    .trim();
  return word.length > 0 && word.length <= 7 ? word : initialsOf(company.name);
});

/** Company furniture as it is right now: its frame, and the neon sign with the company's name in its colours. */
function fancyCanvas(piece: FancyPiece, now: number): HTMLCanvasElement {
  const frame = fancyFrame(piece, now);
  if (piece.id !== "neon-sign") return fancySprite(piece.id, frame);
  const id = memberRoomOf(world.room);
  const company = id === null ? undefined : world.companies.get(id);
  if (!company) return fancySprite(piece.id, frame);
  return neonSprite(neonText(company), frame, coloursOf(company.id).glow);
}

function drawAvatar(
  g: CanvasRenderingContext2D,
  a: Avatar,
  px: number,
  py: number,
  tile: string,
  now: number,
  lap: Lap | null,
  chill: Chill | null,
  weather: Weather | null,
): void {
  const look = a.info.look;
  /** The cold on someone drawn at (`x`, `top`) facing `facing`: a scarf on the bots, then their breath. */
  const cold = (x: number, top: number, facing: Facing) => {
    if (wearsScarf(a, chill)) drawScarf(g, x, top, facing, a.info.id);
    const puff = chill && !a.warp ? breathPuff(a.info.id, now) : null;
    if (puff !== null) drawBreath(g, x, top, facing, puff, weather ? windPush(weather) : 0);
  };
  // Coffee: a small tremor off the clock in whole pixels (`tremor.ts`), the same at any frame rate. The
  // Tavern's special (15 minutes) is a buzz like one and a half cups, or a warm glow behind you.
  const until = a.info.specialUntil ?? 0;
  const special = hasSpecial(until, Date.now()) ? specialBuff(until) : null;
  const cups = Math.max(cupsLeft(a.info.coffeeUntil, Date.now()), special === "jitter" ? 1.5 : 0);
  if (cups > 0) {
    const shake = tremor2d(cups, Date.now(), tremorPhase(a.info.id));
    px += shake.dx;
    py += shake.dy;
  }
  if (special === "glow") drawGlow(g, px + 8, py + 8, 17, "255,222,120", 0.55 + 0.15 * Math.sin(now / 320));
  if (a.warp) {
    const t = Math.min(1, (now - a.warp.at) / WARP_MS);
    g.globalAlpha = a.warp.out ? 1 - t : t;
  }
  const lying = a.state === "away" || (a.state === "sit" && tile === "b");
  if (lying) {
    if (tile !== "b") {
      // A sleeping bag on the floor.
      g.fillStyle = C.ink;
      g.fillRect(px + 2, py + 1, 12, 15);
      g.fillStyle = C.fabricDark;
      g.fillRect(px + 3, py + 2, 10, 13);
    }
    g.drawImage(sleeperFrame(look), px, py + 1);
    const pal = lookPalette(look);
    g.fillStyle = pal.c!;
    g.fillRect(px + 3, py + 8, 10, 7);
    g.fillStyle = pal.C!;
    g.fillRect(px + 3, py + 8, 10, 1);
  } else if (a.state === "working" || (a.state === "sit" && (tile === "c" || tile === "r"))) {
    const typing = a.state === "working" && Math.floor(now / 180) % 2 === 0 ? 1 : 0;
    drawAura(g, a, px, py - 6 + typing, now);
    g.drawImage(characterFrame(look, "up", "sit"), px, py - 6 + typing);
    g.drawImage(chairBack(), px, py);
  } else if (a.state === "sit") {
    drawAura(g, a, px, py - 5, now);
    const facing = a.facing === "up" ? "up" : "down";
    g.drawImage(characterFrame(look, facing, "sit"), px, py - 5);
    cold(px, py - 5, facing);
  } else {
    const walking = lap ? lap.running : stepping(a, now);
    const dance = walking || lap ? undefined : danceOf(a);
    // A dance's 2D take: the sprite turned, moved, flipped and stretched (`dance.ts`), its aura behind it.
    const moves = dance ? dance2D(dance.move, now / 1000, a.facing) : null;
    if (dance?.aura) {
      const k = auraOf(a.info.danceSince ?? 0, Date.now());
      drawGlow(
        g,
        px + 8,
        py + 4,
        12 + 10 * k,
        rgbOf(dance.aura),
        0.3 + 0.5 * k * (0.85 + 0.15 * Math.sin(now / 140)),
      );
    }
    const facing = moves?.facing ?? lap?.facing ?? a.facing;
    const pose = moves?.pose ?? poseFor(a.state, walking, now);
    // A hop: up and down on an arc, the shadow shrinking while they're in the air.
    const t = a.jump === null ? 1 : (now - a.jump) / JUMP_MS;
    const lift = t < 1 ? Math.round(Math.sin(t * Math.PI) * 7) : 0;
    const shrink = lift > 3 ? 1 : 0;
    g.fillStyle = C.shadow;
    g.fillRect(px + 4 + shrink, py + 14, 8 - 2 * shrink, 2);
    drawAura(g, a, px, py - 2 - lift, now);
    // A sneeze dips the whole figure a pixel.
    const sneeze = sneezeOf(a);
    const top =
      py - 2 - lift - (pose === "walkA" ? 1 : 0) + (sneeze !== null && sneezeJolt(sneeze) > 0.5 ? 1 : 0);
    if (isCop(a)) drawCop(g, a, pose, px, top, py, now);
    else if (moves) drawDancing(g, characterFrame(look, facing, pose), px, top, moves);
    else g.drawImage(characterFrame(look, facing, pose), px, top);
    cold(px, top, facing);
  }
  g.globalAlpha = 1;
}

/** A sprite drawn at (x, y) as a dance has it this frame: moved, mirrored, turned and stretched about its feet. */
function drawDancing(
  g: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  m: Dance2D,
): void {
  const w = sprite.width;
  const h = sprite.height;
  g.save();
  // About the feet; upside down (a headspin), about the middle so it stays on its tile.
  const pivotY = m.angle === Math.PI ? h / 2 : h;
  g.translate(x + m.dx + w / 2, y + m.dy + pivotY);
  g.rotate(m.angle);
  g.scale(m.flip ? -1 / Math.sqrt(m.squash) : 1 / Math.sqrt(m.squash), m.squash);
  g.drawImage(sprite, -w / 2, -pivotY);
  g.restore();
}

/** Saves `g` and mirrors it left to right about the middle of the `w` tiles from tile column `x`; the caller restores. */
function mirror(g: CanvasRenderingContext2D, x: number, w: number): void {
  g.save();
  g.translate((2 * x + w) * TILE, 0);
  g.scale(-1, 1);
}

/** The ghost of a piece being moved or placed (`furniture.ts`): its art over the aimed tiles, tinted green where it fits, red where it does not. */
function drawGhost(
  g: CanvasRenderingContext2D,
  map: GameMap,
  now: number,
  fancy: (piece: FancyPiece, now: number) => HTMLCanvasElement,
): void {
  const mode = ghost.mode;
  const t = ghost.aim;
  const piece = mode && pieceOfDrop({ item: mode.kind === "move" ? mode.drop.item : mode.item });
  if (!mode || !t || !piece) return;
  const w = piece.w ?? 1;
  const colour = ghost.fits ? "91, 224, 138" : "232, 88, 79";
  g.save();
  const rot = mode.kind === "move" ? ghost.rot : 0;
  const o = objectAt(withPieces([{ ch: piece.ch, x: t.x, y: t.y, rot }], map), t.x, t.y);
  if (o) {
    g.globalAlpha = 0.6;
    const mirrored = rot === 2 || rot === 3;
    if (mirrored) mirror(g, t.x, sideways(rot) ? 1 : w);
    g.drawImage(o.fancy ? fancy(o.fancy, now) : o.canvas, t.x * TILE + o.dx, t.y * TILE + o.dy);
    if (mirrored) g.restore();
  }
  // Each tile it covers: along its row, or down its column when it is turned sideways.
  for (const [tx, ty] of tilesOf(t.x, t.y, w, rot)) {
    g.globalAlpha = 0.4;
    g.fillStyle = `rgb(${colour})`;
    g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    g.globalAlpha = 0.9;
    g.strokeStyle = `rgb(${colour})`;
    g.lineWidth = 1;
    g.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
  }
  g.restore();
}
