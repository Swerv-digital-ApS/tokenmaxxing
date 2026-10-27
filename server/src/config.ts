import { weekOf } from "@tokenmaxxing/core/raid.ts";
import { parseOrgFeedSecrets } from "./org-feed-secrets.ts";

interface Config {
  port: number;
  host: string;
  version: string;
  development: boolean;
  /** Per client IP, at the gateway (`proxy.ts`). */
  gateway: { ipHeader: string; requestsPerMin: number; socketsPerMin: number };
}

function positiveInt(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const n = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`invalid ${name}: ${env[name]}`);
  return n;
}

/** Parsed once at boot; a bad value fails fast instead of surfacing mid-request. */
export function loadConfig(env: Record<string, string | undefined>, version: string): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid PORT: ${env.PORT}`);
  // It opens every account to whoever has it, so no short ones.
  if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length < 32)
    throw new Error("ADMIN_TOKEN is too short: use at least 32 characters (openssl rand -hex 32)");
  // Read by `raidStart`; checked here so a typo fails at boot, not on the first raid poll.
  const raidStart = env.RAID_START_WEEK;
  if (raidStart && (!/^\d{4}-\d{2}-\d{2}$/.test(raidStart) || weekOf(raidStart) !== raidStart))
    throw new Error(`invalid RAID_START_WEEK: ${raidStart} (a Monday, YYYY-MM-DD)`);
  // Read by `lootBoost`: dev and testing only, so a typo can't quietly hand out legendaries.
  const boost = env.RAID_LOOT_BOOST;
  if (boost !== undefined && boost !== "" && !(Number(boost) >= 1 && Number(boost) <= 1000))
    throw new Error(`invalid RAID_LOOT_BOOST: ${boost} (1 to 1000)`);
  // Hashes only. A bad value fails boot. Unset means the feed answers 401.
  parseOrgFeedSecrets(env.ORG_FEED_SECRETS);
  return Object.freeze({
    port,
    host: env.TOKENMAXXING_HOST ?? "0.0.0.0",
    version,
    development: env.NODE_ENV !== "production",
    gateway: Object.freeze({
      // Railway's edge sets it to the client's address.
      ipHeader: (env.CLIENT_IP_HEADER ?? "x-real-ip").toLowerCase(),
      requestsPerMin: positiveInt(env, "GATEWAY_REQUESTS_PER_MIN", 1200),
      socketsPerMin: positiveInt(env, "GATEWAY_SOCKETS_PER_MIN", 300),
    }),
  });
}
