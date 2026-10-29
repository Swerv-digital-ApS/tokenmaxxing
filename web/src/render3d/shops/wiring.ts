/** The real connection and HUD store, as the `GameBackend` wants them. */
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { world as gameWorld } from "../../game/world.ts";
import { refreshMe, refreshWallet, town } from "../../net.ts";
import { hud } from "../../store.ts";
import type { GameNet, GameStore } from "./gameBackend.ts";

export const realNet = (): GameNet => ({
  buy: (id) => town.buy(id),
  buyDecor: (kind, id) => town.buyDecor(kind, id),
  setDecor: (kind, id) => town.setDecor(kind, id),
  buyDesk: (id) => town.buyDesk(id),
  setDesk: (id) => town.setDesk(id),
  buyPiece: (id) => town.buyPiece(id),
  placePiece: (id) => town.placePiece(id),
  setLook: (look) => town.setLook(look),
  drop: (id) => town.drop(id),
  decorOwned: () => town.decorOwned(),
  deskOwned: () => town.deskOwned(),
  bag: () => town.bag(),
  refreshMe,
  refreshWallet,
});

export const realStore = (): GameStore => ({
  me: () => hud.get().me,
  wallet: () => hud.get().wallet,
  level: () => hud.get().stats?.level ?? 1,
  decorInUse: () => ({ wall: gameWorld.owner?.wall, floor: gameWorld.owner?.floor }),
  setWallet: (wallet) => hud.set({ wallet }),
  setMe: (me) => hud.set({ me }),
  subscribe: (f) => hud.subscribe(f),
});

/** Item names for toasts about things the shop specs do not know. */
export const nameOf = (id: string): string => itemById(id)?.name ?? id;
