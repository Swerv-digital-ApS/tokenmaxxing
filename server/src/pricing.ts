import pricingFallbackRaw from "./pricing-fallback.json" with { type: "json" };

export interface ModelPrice {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  reasoning: number | null;
}

const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

// Provider prefixes commonly seen on model names ("anthropic/claude-...",
// "openai/gpt-...", etc.). LiteLLM mostly keys by bare model name, so
// stripping these and re-looking-up handles a fair number of edge cases.
const COMMON_PREFIXES = [
  "anthropic/",
  "openai/",
  "google/",
  "vertex_ai/",
  "vercel_ai_gateway/",
  "bedrock/",
  "azure/",
  "azure_ai/",
];

interface RawEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
  output_cost_per_reasoning_token?: number;
  mode?: string;
  litellm_provider?: string;
}

function normalizeEntry(raw: RawEntry): ModelPrice | null {
  const input = raw.input_cost_per_token;
  const output = raw.output_cost_per_token;
  // Only models with at least input+output token pricing are usable.
  if (typeof input !== "number" || typeof output !== "number") return null;
  return {
    input,
    output,
    cacheCreation: raw.cache_creation_input_token_cost ?? 0,
    cacheRead: raw.cache_read_input_token_cost ?? 0,
    reasoning:
      typeof raw.output_cost_per_reasoning_token === "number" ? raw.output_cost_per_reasoning_token : null,
  };
}

/**
 * Models that show up in real traffic but that LiteLLM does not publish a
 * price for. Without an entry the model prices at $0 with `unknownPrice`,
 * and a silent $0 understates a total far more misleadingly than a close
 * approximation does — `codex-auto-review` alone carries ~4B cache-read
 * tokens across the fleet.
 *
 * Each alias maps to the nearest PUBLISHED model, and each is a deliberate
 * approximation, not a discovered rate:
 *   codex-auto-review — the review sub-agent Codex spawns to check its own
 *     diffs. Real inference on a real model, but OpenAI publishes no
 *     separate rate for it. Mapped to gpt-5-codex (the cheaper of the two
 *     plausible codex tiers) so the estimate errs low rather than
 *     inventing spend.
 *
 * Applied inside buildMap so an upstream refresh cannot drop them, and only
 * when upstream has no real entry — the moment LiteLLM publishes one, the
 * real price wins.
 */
const PRICE_ALIASES: Record<string, string> = {
  "codex-auto-review": "gpt-5-codex",
};

function buildMap(rawJson: Record<string, RawEntry>): Map<string, ModelPrice> {
  const out = new Map<string, ModelPrice>();
  for (const [name, entry] of Object.entries(rawJson)) {
    if (name === "sample_spec") continue;
    if (!entry || typeof entry !== "object") continue;
    const price = normalizeEntry(entry);
    if (!price) continue;
    out.set(name.toLowerCase(), price);
  }
  for (const [alias, target] of Object.entries(PRICE_ALIASES)) {
    if (out.has(alias)) continue;
    const price = out.get(target);
    if (price) out.set(alias, price);
  }
  return out;
}

const FALLBACK_RAW = pricingFallbackRaw as Record<string, RawEntry>;

/** A hung upstream must not hold the daily refresh forever. */
const FETCH_TIMEOUT_MS = 30_000;

export class PricingCache {
  private map: Map<string, ModelPrice>;
  /** `lookup`'s answers past the map's own names, misses too: every board prices every model again. */
  private found = new Map<string, ModelPrice | null>();

  constructor() {
    this.map = buildMap(FALLBACK_RAW);
  }

  async refreshFromUpstream(): Promise<{ updated: number; failed: boolean }> {
    try {
      const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return { updated: this.map.size, failed: true };
      const json = (await res.json()) as Record<string, RawEntry>;
      // Reject an empty upstream response without replacing the cached prices.
      const hasPrices = Object.entries(json).some(
        ([name, entry]) => name !== "sample_spec" && entry && normalizeEntry(entry),
      );
      if (!hasPrices) return { updated: this.map.size, failed: true };
      const next = buildMap(json);
      // Atomic swap.
      this.map = next;
      this.found = new Map();
      return { updated: next.size, failed: false };
    } catch {
      return { updated: this.map.size, failed: true };
    }
  }

  lookup(model: string): ModelPrice | null {
    if (!model) return null;
    const key = model.toLowerCase();
    const direct = this.map.get(key);
    if (direct) return direct;
    const known = this.found.get(key);
    if (known !== undefined) return known;
    const price = this.match(key);
    // Names come from people's machines: a flood of made-up ones only empties it.
    if (this.found.size >= 10_000) this.found.clear();
    this.found.set(key, price);
    return price;
  }

  private match(key: string): ModelPrice | null {
    const candidates = [key];
    for (const prefix of COMMON_PREFIXES) {
      if (key.startsWith(prefix)) candidates.push(key.slice(prefix.length));
    }
    const slash = key.lastIndexOf("/");
    if (slash >= 0 && slash < key.length - 1) candidates.push(key.slice(slash + 1));
    // Cursor dashboard names use a cursor- prefix for these same Grok versions.
    for (const candidate of [...candidates]) {
      if (/^cursor-grok-4\.(?:5|6|7)(?:-|$)/.test(candidate)) candidates.push(candidate.slice(7));
    }
    // Exact prices, including explicitly priced variants, always take precedence.
    for (const candidate of candidates) {
      const exact = this.map.get(candidate);
      if (exact) return exact;
    }
    for (const candidate of candidates) {
      // Effort changes token volume, not the model's per-token rate. Preserve fast
      // and max-mode suffixes, which may identify different pricing tiers.
      const base = candidate.replace(/-(?:thinking-)?(?:none|minimal|low|medium|high|xhigh)(-fast)?$/, "$1");
      if (base !== candidate) {
        const price = this.map.get(base);
        if (price) return price;
      }
    }
    return null;
  }
}

/**
 * USD for SQL-aggregated token sums, unrounded so callers round once after
 * summing. Reasoning tokens are not added separately here: the parsers use reported output
 * totals, so adding the reasoning breakdown again would double-count it.
 */
export function computeRowCostUsd(
  row: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  },
  price: ModelPrice,
): number {
  return (
    row.input * price.input +
    row.output * price.output +
    row.cacheCreation * price.cacheCreation +
    row.cacheRead * price.cacheRead
  );
}

/** Round a USD float to 4 decimal places. */
export function roundUsd(usd: number): number {
  return Math.round(usd * 10_000) / 10_000;
}
