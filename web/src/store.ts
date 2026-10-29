import type { Barrel } from "@tokenmaxxing/core/fastelavn.ts";
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import type { Frame, Lobby, MatchChatLine } from "@tokenmaxxing/core/games/wire.ts";
import type { JukeboxNow } from "@tokenmaxxing/core/jukebox.ts";
import type { LootNews } from "@tokenmaxxing/core/loot.ts";
import type { Listing, MyMarket, Sale } from "@tokenmaxxing/core/market.ts";
import type { Card, PokerState } from "@tokenmaxxing/core/poker.ts";
import type { QuestBoard } from "@tokenmaxxing/core/quests.ts";
import type { RouletteState } from "@tokenmaxxing/core/roulette.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { CALM, type Weather } from "@tokenmaxxing/core/sky.ts";
import type { Stars } from "@tokenmaxxing/core/stars.ts";
import type { TournamentBoard } from "@tokenmaxxing/core/tournament.ts";
import type { ChatLine, CompanyInfo, Notice, RoomId } from "@tokenmaxxing/core/world.ts";
import type { Me, Raid, Today, Wallet } from "@tokenmaxxing/server/registry";
import { useSyncExternalStore } from "react";
import { storage } from "./storage.ts";

/** A tab of the Shop page: an item slot, or one of Møbelhuset's: wallpaper and floors, monitors, company supplies. */
export type ShopPageTab = Item["slot"] | "decor" | "desk" | "company";

/** Set on the first visit to town (see FirstVisit in hud/Hud.tsx). */
export const FIRST_VISIT_KEY = "tokenmaxxing.pickedCompany";

export type Panel =
  | { kind: "leaderboard" }
  | { kind: "card"; userId: number }
  | { kind: "companyCard"; companyId: number }
  | { kind: "company" }
  | { kind: "companyShop" }
  | { kind: "merch"; companyId: number }
  | { kind: "shop"; tab?: ShopPageTab }
  | { kind: "shops" }
  /** Natmarked's counter and shelves: the cases on sale (`hud/CaseShop.tsx`). `shelf`: the one E was pressed on, whose case it opens on. */
  | { kind: "caseShop"; shelf?: number }
  /** Torvehallen's counter: what is on display (the default), or my own shelf and sales (`hud/Market.tsx`). */
  | { kind: "market"; tab?: "display" | "shelf" }
  /** E on a display slot in the hall: a listing's item, price and seller with Buy, or an empty slot to fill. */
  | { kind: "marketSlot"; slot: number }
  /** The net cafe's roulette table (`hud/Roulette.tsx`); `watch` is the read-only view from the sidelines. */
  | { kind: "roulette"; watch?: boolean }
  /** A read-only view of the net cafe's poker table (`hud/PokerWatch.tsx`). */
  | { kind: "pokerWatch" }
  | { kind: "merchant" }
  | { kind: "julekalender" }
  | { kind: "bag"; tab?: "you" | "pet" | "things" }
  | { kind: "arcade" }
  | { kind: "newTable"; invite?: number; inviteName?: string; game?: GameId }
  | { kind: "match"; id: number }
  | { kind: "trade"; userId: number }
  | { kind: "trades" }
  | { kind: "paper" }
  | { kind: "pamphlet" }
  | { kind: "tombstone"; id: string }
  | { kind: "keynote" }
  | { kind: "stars" }
  | { kind: "trophies"; userId: number; name: string }
  | { kind: "openOffices" }
  | { kind: "directory" }
  | { kind: "decor" }
  | { kind: "desk" }
  | { kind: "raid" }
  | { kind: "quests" }
  /** The Tavern's bar: order a coffee or the special from the barkeep (`hud/Bar.tsx`). */
  | { kind: "bar" }
  | { kind: "tournament" }
  | { kind: "requests" }
  | { kind: "hallOfFame" }
  | { kind: "collection" }
  | { kind: "regulars" }
  | { kind: "jukebox" }
  | { kind: "fishing" }
  | { kind: "graphics" }
  | { kind: "menu" }
  | { kind: "changelog" }
  /** Dev: the case-opening screen on mock data (QA flag, then `__tm.hud.set({ panel: { kind: "caseOpening" } })`). */
  | { kind: "caseOpening" };

/** The jukebox's mute and volume, kept on this device. */
export interface JukeSettings {
  muted: boolean;
  volume: number;
}
export const JUKE_KEY = "tokenmaxxing.jukebox";

function loadJukeSettings(): JukeSettings {
  try {
    const s = JSON.parse(storage.getItem(JUKE_KEY) ?? "{}") as Partial<JukeSettings>;
    const volume = typeof s.volume === "number" ? Math.min(1, Math.max(0, s.volume)) : 0.6;
    return { muted: s.muted === true, volume };
  } catch {
    return { muted: false, volume: 0.6 };
  }
}

/** Game panels keep the chat usable beside them. */
export const chatBeside = (panel: Panel | null): boolean =>
  panel?.kind === "arcade" || panel?.kind === "newTable" || panel?.kind === "match";

/** Everything the React HUD shows. The canvas world keeps its own state in `game/world.ts`. */
interface HudState {
  status: "connecting" | "ready" | "signedOut" | "expired" | "offline";
  me: Me | null;
  stats: Today["me"] | null;
  wallet: Wallet | null;
  /** Today's quests and the week's. */
  questBoard: QuestBoard | null;
  /** The basement's tournament: the live bracket, and the champion (who has a title in chat). */
  tournament: TournamentBoard | null;
  /** This week's boss and the town's fight with it. */
  raid: Raid | null;
  /** Today's top players by tokens, with me appended when I'm outside them. */
  board: Today["top"];
  room: RoomId;
  occupancy: Partial<Record<RoomId, number>>;
  companies: CompanyInfo[];
  chat: ChatLine[];
  panel: Panel | null;
  /** A line of text at the bottom (inspecting things, locked doors). */
  dialog: string | null;
  /** Facing one of my own pieces of furniture: what G and M do to it (null: none). */
  pieceHint: string | null;
  /** The dance I'm doing (`DANCES`), 0 for none: lit on the dance bar. */
  dancing: number;
  /** My pet's menu (stroke, treat, trick) is open over the world. */
  petMenu: boolean;
  /** The room name, shown briefly on entering. */
  banner: { text: string; at: number } | null;
  /** Bumped to ask the chat input to take focus. */
  chatFocus: number;
  /** A line from the server for me: someone asked to join my company, or offered me a trade. */
  notice: (Notice & { at: number }) | null;
  /** Tables, games and where I am in them, live from the arcade. */
  lobby: Lobby | null;
  /** The open match panel's latest frame. */
  frame: Frame | null;
  /** The open match's own chat. */
  matchChat: MatchChatLine[];
  /** How far my clock is ahead of the server's, for countdowns. */
  clockSkew: number;
  /** The table of an invite that just came in, shown as a toast. */
  inviteTable: number | null;
  /** The last time someone @-mentioned me from another room. */
  mention: { line: ChatLine; at: number } | null;
  /** The weather over Copenhagen, from the server. */
  weather: Weather;
  /** The day of the year the server pins the town's season to (`SKY_SEASON`), or null for the date's own. */
  seasonDay: number | null;
  /** The project's GitHub stars and the last milestone's fireworks (`world` sends `stars`). */
  stars: Stars;
  /** The fastelavn barrel on Fastelavn Sunday: its whacks and its king; null the rest of the year (`barrel`). */
  barrel: Barrel | null;
  /** What the raid's last kills dropped, for everyone (`world` sends `loot`). */
  lootNews: { news: LootNews[]; at: number } | null;
  /** What the Tavern's jukebox is playing for the room, or null (`world` sends `jukebox`). */
  jukebox: JukeboxNow | null;
  jukeSettings: JukeSettings;
  /** The Tavern's poker table as the room sees it, and when it arrived (its clocks are counted from then); null away from the Tavern. */
  poker: (PokerState & { at: number }) | null;
  /** My two cards at the poker table (`world` sends `pokerHole` to me alone). */
  pokerHole: Card[];
  /** The net cafe's roulette table as the room sees it, and when it arrived; null away from the net cafe. */
  roulette: (RouletteState & { at: number }) | null;
  /**
   * Torvehallen as I last read it (`net.ts` `refreshMarket`, every few seconds while I'm in the hall and
   * when the panel opens): everything on display, by slot, and my own listings and sales. `at` is when.
   */
  market: { listings: Listing[]; mine: MyMarket | null; at: number } | null;
  /**
   * My sales in the hall that I have been told of, newest first and kept on this device (the server only keeps
   * the ones I haven't heard of). `marketSold` is the batch I came back to, for one toast.
   */
  marketLog: Sale[];
  marketSold: { sales: Sale[]; at: number } | null;
}

let state: HudState = {
  status: "connecting",
  me: null,
  stats: null,
  wallet: null,
  questBoard: null,
  tournament: null,
  raid: null,
  board: [],
  room: "town",
  occupancy: {},
  companies: [],
  chat: [],
  panel: null,
  dialog: null,
  pieceHint: null,
  dancing: 0,
  petMenu: false,
  banner: null,
  chatFocus: 0,
  mention: null,
  lootNews: null,
  jukebox: null,
  jukeSettings: loadJukeSettings(),
  poker: null,
  pokerHole: [],
  roulette: null,
  market: null,
  marketLog: [],
  marketSold: null,
  notice: null,
  lobby: null,
  frame: null,
  matchChat: [],
  clockSkew: 0,
  inviteTable: null,
  weather: CALM,
  seasonDay: null,
  stars: { count: null, show: null },
  barrel: null,
};
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  set(patch: Partial<HudState> | ((s: HudState) => Partial<HudState>)) {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useHud<T>(select: (s: HudState) => T): T {
  return useSyncExternalStore(hud.subscribe, () => select(state));
}
