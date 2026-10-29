// Renders the 2D case-art contact sheets to PNGs (4x, labelled) with the real art modules in headless Chromium.
//   bunx bun@1.4.4 scripts/qa/case-art/sheets.mjs [--case ragnarok-eve] [--scale 4] [--out /tmp/case-shots/ragnarok/2d]
// Needs Playwright (PLAYWRIGHT=/path/to/playwright/index.mjs, as scripts/qa/lib.mjs).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const caseId = arg("case", "ragnarok-eve");
const scale = arg("scale", "4");
const out = arg("out", "/tmp/case-shots/ragnarok/2d");
mkdirSync(out, { recursive: true });

const built = await Bun.build({ entrypoints: [join(here, "harness.ts")], target: "browser", format: "iife" });
if (!built.success) {
  console.error(built.logs.join("\n"));
  process.exit(1);
}
const js = await built.outputs[0].text();
const tmp = join(out, ".harness");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(
  join(tmp, "index.html"),
  `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111"><script>${js.replaceAll("</script", "<\\/script")}</script>`,
);

const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`file://${join(tmp, "index.html")}?case=${caseId}&scale=${scale}`);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 15000 }).catch(() => {});
for (const id of await page.$$eval("canvas[id^=sheet-]", (cs) => cs.map((c) => c.id))) {
  const file = join(out, `${id.replace("sheet-", "")}.png`);
  await page.locator(`#${id}`).screenshot({ path: file });
  console.log(file);
}
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
