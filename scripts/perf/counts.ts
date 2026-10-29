// bun scripts/perf/counts.ts: hardware-independent counts of every room, built headlessly and batched (what the budget test checks),
// for the geometry detail of one tier (`bun scripts/perf/counts.ts medium|high [--check]`): medium has plain boxes, high chamfers (ultra is the same).
import { BUDGETS } from "../../web/src/render3d/perf/budgets.ts";
import { installHeadlessGlobals } from "../../web/src/render3d/perf/stubs.ts";

installHeadlessGlobals();
const h = await import("../../web/src/render3d/perf/headless.ts");
const { setGeometryDetail, setTextureCap } = await import("../../web/src/render3d/kit/kit.ts");
const tier = (process.argv[2] ?? "high") as "medium" | "high";
const check = process.argv.includes("--check");
if (tier !== "medium" && tier !== "high") throw new Error("tier must be medium or high");
setGeometryDetail(tier === "medium" ? 0 : 1);
setTextureCap(tier === "medium" ? 1024 : 2048);
await h.loadAllSlices();
const actors = process.argv.includes("--live") ? "live" : "frozen";
const variant = process.argv.includes("--block") ? "block" : "smooth";
if (check && (actors !== "frozen" || variant !== "smooth"))
  throw new Error("--check budgets use frozen actors and smooth geometry");
let bad = 0;
console.log(`— ${tier}, ${actors} actors, ${variant} geometry (whole room, one pass)`);
for (const [room, b] of Object.entries(BUDGETS[tier])) {
  const c = h.measureRoom(room, { actors, variant });
  const over =
    actors === "frozen" && variant === "smooth"
      ? (Object.keys(b) as (keyof typeof b)[]).filter((k) => c[k] > b[k])
      : [];
  if (over.length) bad++;
  console.log(room.padEnd(15), JSON.stringify(c), over.length ? `OVER ${over.join(",")}` : "");
}
if (check && bad) process.exit(1);
