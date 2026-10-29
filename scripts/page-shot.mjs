// bun scripts/page-shot.mjs <url> <out.png> [w] [h] [wait ms]  (screenshots any page; used for "today's town")
const pw = await import(
  process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
);
const [url, out, w = "1600", h = "900", wait = "4000"] = process.argv.slice(2);
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
});
await ctx.addInitScript(() => localStorage.setItem("demo3d.style", "voxel"));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[error]", e.message));
await page.goto(url);
await page.waitForTimeout(Number(wait));
if (process.env.HIDE_UI) await page.addStyleTag({ content: "body > *:not(canvas){display:none !important}" });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
