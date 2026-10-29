const LEVEL_TITLES = [
  "Newcomer",
  "Prompt Intern",
  "Context Goblin",
  "Cache Enjoyer",
  "Agent Wrangler",
  "Subagent Shepherd",
  "Token Baron",
  "Gigamaxxer",
  "Context Lord",
  "Teramaxxer",
  "Petamaxxer",
  "Datacenter Tycoon",
  "Compute Overlord",
  "Examaxxer",
  "Rate Limit Survivor",
  "Cluster Captain",
  "GPU Hoarder",
  "Zettamaxxer",
  "Inference Warlord",
  "Hyperscaler",
  "Yottamaxxer",
  "Benchmark Breaker",
  "Transformer Tamer",
  "Foundation Model",
  "Frontier Lab",
  "Planetary Compute",
  "Dyson Sphere",
  "AGI Candidate",
  "Superintelligence",
  "Event Horizon",
  "Singularity",
  // Past the Singularity: 31 to 50, where each level is a longer climb.
  "Post-Singularity",
  "Context Infinite",
  "Galaxy Brain",
  "Matrioshka Brain",
  "Ronnamaxxer",
  "Kardashev II",
  "Star Forger",
  "Nebula Whisperer",
  "Wormhole Router",
  "Kardashev III",
  "Dark Matter Miner",
  "Quasar Engine",
  "Multiverse Shard",
  "Time Crystal",
  "Quettamaxxer",
  "Heat Death Denier",
  "Big Bang Rerun",
  "Simulation Admin",
  "Final Context",
  "The Tokenmaxxer",
];

/**
 * Lifetime tokens where each level starts; the index is the level. About ×3 a level to 10B, then
 * 1B a level to 30, then steps of 2B, 3B, 5B and 10B, five levels each, to 130B at 50. Levels
 * only ever add on the end, so nobody's level goes down when the table grows.
 */
const LEVELS = [
  0,
  1e6,
  3e6,
  10e6,
  30e6,
  100e6,
  300e6,
  1e9,
  3e9,
  6e9,
  ...Array.from({ length: 21 }, (_, i) => (10 + i) * 1e9),
  ...[32, 34, 36, 38, 40, 43, 46, 49, 52, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130].map((b) => b * 1e9),
];
export const MAX_LEVEL = LEVELS.length - 1;
/** The old top level: town characters (bots, the cop) stay there, below the legendary one, which players earn. */
export const BOT_LEVEL = 30;

export const levelFor = (tokens: number): number => LEVELS.findLastIndex((at) => tokens >= at);

/** Infinity past the top, so "next level" maths can't divide by zero. */
export const levelAt = (level: number): number => LEVELS[level] ?? Infinity;

export const levelTitle = (level: number): string => LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)]!;

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

/** A template with each `{key}` filled in from `vars`; a key `vars` lacks reads as nothing. */
export const fill = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export const usd = (n: number): string => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

/** "18:42", or "3:04:05" past an hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "3d 04:12:55", "04:12:55": what's left till `at`, to the second. */
export function countdown(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((at - now) / 1000));
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return s >= 86_400 ? `${Math.floor(s / 86_400)}d ${hms}` : hms;
}

/** Whole seconds until `at`, never below 0. */
export const secondsUntil = (at: number, now: number): number => Math.max(0, Math.ceil((at - now) / 1000));

/** "3h 25m", or "40m" under an hour. */
export function hoursText(hours: number): string {
  const m = Math.round(hours * 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** "15 min", "1 hour", "24 hours". */
export const minutesText = (minutes: number): string =>
  minutes >= 60 ? plural(minutes / 60, "hour") : `${minutes} min`;

/** "1 game", "3 games". */
export const plural = (n: number, word: string, words = `${word}s`): string =>
  `${n} ${n === 1 ? word : words}`;
