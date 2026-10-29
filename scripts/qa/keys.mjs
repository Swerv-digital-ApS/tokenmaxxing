// bun scripts/qa/keys.mjs [tier]: typing in the chat does not move the player or open panels; Enter, Esc, arrows, Q R + - 0 keys; a chat bubble's pointer events.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "medium";
const page = await openGame(browser, await signUp("k"), tier);
await ready(page);
const pos = () =>
  page.evaluate(() => {
    const m = window.__tm.self();
    const h = window.__tm.hud.get();
    return {
      x: m.x,
      y: m.y,
      f: m.facing,
      st: m.state,
      panel: h.panel?.kind ?? null,
      dialog: h.dialog,
      active: `${document.activeElement?.tagName}.${(document.activeElement?.className ?? "").toString().slice(0, 20)}`,
    };
  });
console.log("start", JSON.stringify(await pos()));
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
console.log("after Enter", JSON.stringify(await pos()));
await page.keyboard.type("wasd le qr+-0 x  hi", { delay: 30 });
await page.waitForTimeout(500);
console.log("typed", JSON.stringify(await pos()), await page.evaluate(() => document.activeElement.value));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("esc in chat", JSON.stringify(await pos()));
await page.evaluate(() => document.activeElement.blur?.());
await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
// movement keys
await page.keyboard.down("ArrowLeft");
await page.waitForTimeout(700);
await page.keyboard.up("ArrowLeft");
await page.waitForTimeout(500);
console.log("left", JSON.stringify(await pos()));
// rotate/zoom keys on canvas
for (const k of ["q", "r", "+", "-", "0"]) {
  await page.keyboard.press(k);
  await page.waitForTimeout(250);
}
console.log("rot/zoom keys ok", JSON.stringify(await pos()), page.errors);
// Mention / emoji button? chat focus + send
await page.keyboard.press("Enter");
await page.keyboard.type("hello");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
await page.screenshot({ path: `/tmp/v2-qa-shots/kbd-${tier}.png` });
console.log(
  "bubble els",
  await page.evaluate(() =>
    [...document.querySelectorAll("#stage *")]
      .filter((e) => /hello/.test(e.textContent) && e.children.length === 0)
      .map((e) => `${e.className}|${getComputedStyle(e).pointerEvents}`),
  ),
);
await browser.close();
process.exit(0);
