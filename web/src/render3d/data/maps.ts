/**
 * The 3D world's tile maps are the game's own: `core/src/maps.ts` is the single source of truth (the Tavern,
 * the dorm, the company house and common room, the basement, the dungeon, the four shops and the town with
 * their storefronts). This file used to be a snapshot of it; it now only re-exports it, so the two cannot drift.
 */
export * from "@tokenmaxxing/core/maps.ts";
