#!/usr/bin/env bun
/**
 * Re-vendor server/src/pricing-fallback.json from LiteLLM.
 *
 * The snapshot is the price table the server boots on, before the first
 * upstream refresh lands (PricingCache.refreshFromUpstream, boot + daily). A
 * model missing from it prices at $0 until that refresh succeeds — and on an
 * air-gapped or egress-blocked self-host, "until" is "never".
 *
 * Written byte-verbatim so `git diff` on this file is a readable price diff
 * rather than a reformat.
 *
 * Usage:
 *   bun run scripts/vendor-pricing.ts          # write
 *   bun run scripts/vendor-pricing.ts --check  # exit 1 if stale, write nothing
 */

import { safeJsonParse } from "hanzio";

const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const TARGET = new URL("../src/pricing-fallback.json", import.meta.url).pathname;

// A snapshot that lost most of its models would still be valid JSON, and would
// silently zero out most of the fleet's cost. Refuse anything suspiciously small.
const MIN_MODELS = 2_000;

const check = process.argv.includes("--check");

const res = await fetch(LITELLM_URL);
if (!res.ok) {
  console.error(`vendor-pricing: upstream fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const body = await res.text();

const parsed = safeJsonParse<Record<string, unknown>>(body);
if (!parsed.ok) {
  console.error(`vendor-pricing: upstream is not valid JSON: ${parsed.error}`);
  process.exit(1);
}
const count = Object.keys(parsed.data).length;
if (count < MIN_MODELS) {
  console.error(`vendor-pricing: upstream has only ${count} models (< ${MIN_MODELS}); refusing`);
  process.exit(1);
}

const current = await Bun.file(TARGET).text();
if (current === body) {
  console.log(`vendor-pricing: up to date (${count} models)`);
  process.exit(0);
}

if (check) {
  console.error(
    `vendor-pricing: snapshot is STALE (${Object.keys(JSON.parse(current)).length} models vendored, ${count} upstream).`,
  );
  console.error("Run: bun run scripts/vendor-pricing.ts");
  process.exit(1);
}

await Bun.write(TARGET, body);
console.log(`vendor-pricing: wrote ${count} models`);
