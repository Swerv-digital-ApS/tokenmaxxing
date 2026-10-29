import { clockMinutes, parseClock } from "@tokenmaxxing/core/street.ts";
import { skyNow } from "./sky.ts";

const forced = parseClock(new URLSearchParams(location.search).get("clock") ?? "");
const openedAt = Date.now();
const pinned = forced === null ? null : skyNow() + (forced - clockMinutes(skyNow())) * 60_000;
/** The band uses the same Copenhagen clock for its stage, sign and music, including previews. */
export const tavernNow = (): number => (pinned === null ? skyNow() : pinned + Date.now() - openedAt);
