/**
 * The company's common room: a second floor up the stairs `u` from the house (`hq:<id>`), room
 * `common:<id>`, for its members only (`portal`). A lounge for the team: sofas and armchairs round a rug and a
 * TV, a kitchenette, a stage for stand-ups, a ping-pong and a foosball table, a pet corner, a wall of wins and
 * windows. Cosmetic and additive: nothing here pays, buffs or counts anything. The tiles are `MAPS.common`;
 * this module names its zones and seats so the 2D client and a 3D builder read them from one place.
 * Company furniture (the wallet's `COMPANY_FURNITURE`, never posters, which need the house's wall) can be
 * placed in it like in the house, each room with its own `OFFICE_PIECES` cap.
 */
import { MAPS } from "./maps.ts";
import type { RoomId } from "./world.ts";

/** Company `id`'s common room. Its chat and presence are the room's own, so they stay within the company. */
export const commonRoom = (companyId: number): RoomId => `common:${companyId}`;

/** A zone of the room, in tiles: `x`, `y` its top-left, `w` × `h` its size. */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where things are, in `MAPS.common`'s tiles. */
export const COMMON_ZONES = {
  /** The stand-up stage (`e`), with its whiteboard. */
  stage: { x: 1, y: 4, w: 6, h: 2 },
  /** The TV lounge: the rug with the TV on it, armchairs, a coffee table and a long sofa facing the TV. */
  lounge: { x: 8, y: 7, w: 8, h: 5 },
  /** The kitchenette along the top wall: fridge, counters, espresso bar and coffee machine, with stools. */
  kitchen: { x: 15, y: 2, w: 8, h: 2 },
  /** The ping-pong table (3 wide) and the foosball table (2 wide). */
  games: { x: 17, y: 7, w: 5, h: 3 },
  /** The pet corner: the basket and its nook. */
  petCorner: { x: 1, y: 11, w: 3, h: 2 },
  /** The wall of wins on the top wall (`Θ`), and the windows (`Ψ`) along it. */
  wall: { x: 7, y: 1, w: 4, h: 1 },
} as const satisfies Record<string, Zone>;

export interface CommonSeat {
  x: number;
  y: number;
  /** The tile's character: `s` sofa, `μ` lounge chair, `ε` beanbag, `v` stool. */
  ch: string;
  kind: "sofa" | "chair";
  /** Where you face when sat there (`sit`): a stool faces up to its counter, the rest face down. */
  facing: "up" | "down";
}

/** Every seat in the common room, in reading order: each is a tile you sit on by pressing E facing it. */
export const commonSeats = (): CommonSeat[] =>
  MAPS.common.rows.flatMap((row, y) =>
    [...row].flatMap((ch, x) => {
      const seat = MAPS.common.kind(x, y).seat;
      return seat === "sofa" || seat === "chair"
        ? [{ x, y, ch, kind: seat, facing: seat === "chair" ? ("up" as const) : ("down" as const) }]
        : [];
    }),
  );

/** The windows' tiles (`Ψ`) in the top wall, the wall of wins' (`Θ`), and the stairs down (`x`). */
export const commonWindows = (): readonly [number, number][] => MAPS.common.find("Ψ");
export const wallOfWins = (): readonly [number, number][] => MAPS.common.find("Θ");
export const commonStairs = (): readonly [number, number][] => MAPS.common.find("x");
/** The house's stairs up (`u`), in its bottom wall. */
export const houseStairs = (): readonly [number, number][] => MAPS.hq.find("u");
