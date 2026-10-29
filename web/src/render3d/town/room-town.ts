import { compact } from "@tokenmaxxing/core/format.ts";
import { nextMilestone } from "@tokenmaxxing/core/stars.ts";
import { STATUE_TILE } from "@tokenmaxxing/core/statue.ts";
import * as THREE from "three";
import { seasonLookNow } from "../../game/seasons.ts";
import { lightsNow, weatherNow, windPush } from "../../game/sky.ts";
import { starCount } from "../../game/stars.ts";
import { world } from "../../game/world.ts";
import { hud } from "../../store.ts";
import { GateLive } from "../dungeon/gate3d.ts";
import { disposeObject } from "../engine/dispose.ts";
import { ExitMarkers } from "../rooms/exit-markers.ts";
import { type RoomCtx, type RoomView, registerRoom, type Sign, withTicks } from "../rooms/rooms.ts";
import { Barrel3d } from "./barrel3d.ts";
import { Bonfire3d } from "./bonfire3d.ts";
import { Fireworks3d } from "./fireworks3d.ts";
import { GamesLayer } from "./games3d.ts";
import { Graveyard3D } from "./graveyard3d.ts";
import { FallingLeaves } from "./leaves3d.ts";
import { dropPropsNight, setPropsNight } from "./props.ts";
import { Pumpkins } from "./pumpkins3d.ts";
import { StatueLayer } from "./statue3d.ts";
import { TownEvents } from "./town-events.ts";
import { buildTown3d, type Town3d } from "./town3d.ts";
import { Truck3d } from "./truck3d.ts";

/** The picture height the town starts at: the square and a few houses. */
const TOWN_VIEW = 12;

/**
 * The town, from `buildTown3d` (so its tiles are the 2D game's): houses for the real companies,
 * the Tavern, the pond, the boards. The street's schedules (the pølsevogn, the snail, the paperboy) follow
 * the game's clock, and the windmill turns with its weather.
 */
export function buildTownView(id: string, ctx: RoomCtx): RoomView {
  const built = withTicks(() => buildTown3d([...ctx.companies], { arcade: false }));
  const town: Town3d = built.value;
  town.setClock(ctx.minutes);
  town.setWeather(weatherNow);
  const [W, D] = town.size;
  const events = new TownEvents((tx, ty) => town.toWorld(tx, ty));
  const statue = new StatueLayer(town.map.find(STATUE_TILE)[0], (tx, ty) => town.toWorld(tx, ty));
  events.group.add(statue.group);
  const group = new THREE.Group();
  group.add(town.group);
  const officeWindows: { companyId: number; window: THREE.Mesh }[] = [];
  for (const door of town.doors) {
    if (door.kind !== "hq" || door.companyId === undefined || door.plot === undefined) continue;
    const panes: THREE.Mesh[] = [];
    town.houses.get(door.plot)?.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.officeWindow) panes.push(node);
    });
    // Light a single actual pane, preserving the house's architecture and ordinary day/night lighting.
    const pane = panes[0];
    if (!pane) continue;
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.42),
      new THREE.MeshBasicMaterial({ color: "#ffd98a" }),
    );
    window.position.set(0, 0.22, 0.031);
    window.userData.live = true;
    window.visible = false;
    pane.add(window);
    officeWindows.push({ companyId: door.companyId, window });
  }
  // What changes with the game: the raid gate's boards, and the tables of the games on the square.
  const gate = town.doors.find((d) => d.kind === "dungeon");
  const gateLive = gate ? new GateLive([gate.at[0], gate.at[1] + 0.25]) : null;
  const games = new GamesLayer((tx, ty) => town.toWorld(tx, ty));
  const graveyard = new Graveyard3D((tx, ty) => town.toWorld(tx, ty));
  if (gateLive) group.add(gateLive.group);
  group.add(games.group, graveyard.group);
  const leaves = new FallingLeaves(town.canopies);
  group.add(leaves.group);
  const wind = new THREE.Vector2();
  // The leaderboard on the square shows today's top five, as the HUD's mini board has them.
  let board: ReturnType<typeof hud.get>["board"] | null = null;
  const showBoard = () => {
    if (board === hud.get().board) return;
    board = hud.get().board;
    town.boards.leaderboard.show(
      board
        .filter((r) => r.rank <= 5 && r.tokens > 0)
        .map((r) => ({ name: r.name, value: compact(r.tokens) })),
    );
  };
  // The star counter shows the repo's GitHub stars, and the milestone they're heading for.
  let stars: number | null | undefined;
  const showStars = () => {
    const { count } = hud.get().stars;
    if (count === stars) return;
    stars = count;
    town.boards.stars.show(
      starCount(count),
      count === null ? "Press E to star it" : `Next: ${nextMilestone(count).toLocaleString("en-US")}`,
    );
  };
  const fireworks = new Fireworks3d((tx, ty) => town.toWorld(tx, ty));
  group.add(fireworks.group);
  const markers = new ExitMarkers(ctx.map, (tx, ty) => town.toWorld(tx, ty));
  group.add(markers.group);
  // Halloween's jack-o'-lanterns, on the doorsteps: hidden the rest of the year.
  const pumpkins = new Pumpkins(ctx.map, (tx, ty) => town.toWorld(tx, ty));
  group.add(pumpkins.group);
  // J-dag's truck, on the road under the square on the first Friday night of November.
  const truck = new Truck3d((tx, ty) => town.toWorld(tx, ty));
  group.add(truck.group);
  // Fastelavn's barrel, on the lawn under the square on Fastelavn Sunday.
  const barrel = new Barrel3d((tx, ty) => town.toWorld(tx, ty));
  group.add(barrel.group);
  // The Sankt Hans bonfire, in front of the Tavern on 23 June.
  const bonfire = new Bonfire3d((tx, ty) => town.toWorld(tx, ty));
  group.add(bonfire.group);
  const signs = (): Sign[] =>
    town.doors.flatMap((d): Sign[] => {
      const at: [number, number, number] = [d.at[0], 3.2, d.at[1]];
      if (d.kind === "inn") return [{ key: "inn", at: [d.at[0], 3.4, d.at[1]], kind: "inn" }];
      if (d.kind === "hq" && d.companyId !== undefined)
        return [{ key: `co:${d.companyId}`, at, kind: "company", companyId: d.companyId }];
      if (d.kind === "shop")
        return [{ key: d.id, at: [d.at[0], 2.6, d.at[1] + 0.2], kind: "door", text: `🛍 ${d.label}` }];
      return [];
    });
  return {
    id,
    group,
    outdoors: true,
    bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D, height: 3 },
    view: TOWN_VIEW,
    toWorld: (tx, ty) => town.toWorld(tx, ty),
    toTile: (x, z) => town.toTile(x, z),
    seatY: (_x, _y, kind) => (kind === "bench" ? 0.3 : 0.32),
    tick(t, _dt, toward) {
      for (const f of built.ticks) f(t);
      gateLive?.update(t);
      games.update(t, toward);
    },
    extras: events.group,
    frame(f) {
      for (const entry of officeWindows) {
        const active = world.officeLights.has(entry.companyId);
        entry.window.visible = active || lightsNow(f.now) > 0.5;
        (entry.window.material as THREE.MeshBasicMaterial).color.set(active ? "#ffd98a" : "#354656");
      }
      showBoard();
      showStars();
      fireworks.update();
      markers.update(f.me, f.t);
      pumpkins.update(f.now);
      truck.update();
      barrel.update(f.t);
      bonfire.update(f.t);
      events.update(f);
      graveyard.update(f.now);
      statue.update(f);
      const [x, z] = f.me ?? [W / 2, D / 2];
      wind.set(windPush(weatherNow()) * 2.5, 0);
      leaves.update(f.dt, f.t, seasonLookNow().look.falling, f.density, wind, x, z);
    },
    onToss: (tx, ty) => events.toss(tx, ty),
    leave: () => {
      events.leave();
      statue.leave();
    },
    signs,
    liveSigns: () => [
      ...truck.signs(),
      ...barrel.signs(),
      ...(gateLive?.signs() ?? []),
      ...games.signs(),
      ...graveyard.signs(),
    ],
    night: (on) => setPropsNight(on),
    dispose() {
      markers.dispose();
      statue.dispose();
      fireworks.dispose();
      events.dispose();
      games.dispose();
      graveyard.dispose();
      gateLive?.dispose();
      dropPropsNight(group);
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

registerRoom("town", buildTownView);
