/**
 * The shared buy panel of the four shops: a card with a big rotating 3D preview of the item, its name, rarity,
 * price or lock, a Buy button that pays from the player's or the company's coins, and then the item's own actions
 * (`shopActions.ts`). Also the confirm toast. Folds down to its header like the other menus.
 */
import * as THREE from "three";
import { Pipeline } from "../engine/pipeline.ts";
import type { ShopBackend } from "./backend.ts";
import type { ShopId, ShopItem } from "./catalog.ts";
import { SHOP_SPECS } from "./catalog.ts";
import { failOf, type Outcome } from "./purchase.ts";
import { actionsOf, type ItemInfo, infoOf, type PanelHooks, RARITY_COLOUR } from "./shopActions.ts";

const CSS = `
.shop-card{position:fixed;right:76px;bottom:12px;width:300px;display:flex;flex-direction:column;gap:8px;z-index:6}
.shop-card .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.shop-card .title{display:flex;justify-content:space-between;gap:8px}
.shop-card .x{padding:0 7px;line-height:20px}
.shop-prev{width:100%;height:210px;border-radius:8px;background:linear-gradient(#26304a,#1b1f2a);display:block}
.shop-name{font-size:15px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.shop-name em{font-style:normal;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;color:#1b1f2a}
.shop-meta{color:var(--muted);font-size:12px}
.shop-state{font-size:13px}
.shop-state b{color:var(--accent)}
.shop-state.bad{color:#ff9a8a}
.shop-state.good{color:#7fe3a6}
.shop-card .row button.primary{background:var(--accent);color:var(--ink);font-weight:700;border-color:transparent}
.shop-card .row button:disabled{opacity:.45;cursor:not-allowed}
.shop-card[hidden]{display:none}
#shop-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);padding:8px 16px;border-radius:10px;
  background:#fbf7ef;color:var(--ink);font-weight:700;opacity:0;pointer-events:none;transition:.25s;z-index:20}
#shop-toast.on{opacity:1;transform:translate(-50%,0)}
.shop-tip{position:fixed;z-index:5;pointer-events:none;padding:2px 8px;border-radius:6px;background:var(--panel);
  border:1px solid var(--line);font-size:11px;font-weight:700;white-space:nowrap;transform:translate(14px,-120%)}
`;

export interface ShopPanel {
  open(shop: ShopId, item: ShopItem): void;
  close(): void;
  readonly isOpen: boolean;
  /** Takes the card and the toast off the page. */
  dispose(): void;
  toast(text: string): void;
  tip(text: string | null, x?: number, y?: number): void;
}

const ELEVATION = Math.atan(0.5);

export function mountShopPanel(hooks: PanelHooks, backend: ShopBackend): ShopPanel {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const toastEl = document.createElement("div");
  toastEl.id = "shop-toast";
  document.body.append(toastEl);
  let toastTimer = 0;
  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), 2600);
  };

  const tipEl = document.createElement("div");
  tipEl.className = "shop-tip";
  tipEl.hidden = true;
  document.body.append(tipEl);

  const el = document.createElement("div");
  el.className = "panel shop-card";
  el.id = "shopcard";
  el.hidden = true;
  el.innerHTML = `<div class="title"><span class="t"></span><button type="button" class="x" title="Close">✕</button></div>
    <canvas class="shop-prev" width="600" height="420"></canvas>
    <div class="shop-name"><span class="n"></span><em class="r"></em></div>
    <div class="shop-meta"></div>
    <div class="shop-state"></div>
    <div class="row actions"></div>`;
  document.body.append(el);
  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const canvas = $<HTMLCanvasElement>(".shop-prev");

  // The preview: its own little renderer, run through the same pipeline as the world.
  let pipe: Pipeline | null = null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.8));
  const sun = new THREE.DirectionalLight("#fff1d6", 2.2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  const spin = new THREE.Group();
  scene.add(spin);
  let radius = 1;
  let centreY = 0.5;
  let current: { shop: ShopId; item: ShopItem } | null = null;
  let raf = 0;

  const frame = () => {
    raf = 0;
    if (el.hidden || el.classList.contains("cx-collapsed") || !pipe) return;
    const t = performance.now() / 1000;
    spin.rotation.y = t * 0.7;
    const { style, pixelSize, night } = hooks.renderStyle();
    pipe.style = style;
    pipe.pixelSize = style === "voxel" ? 1 : pixelSize;
    pipe.gradient = true;
    pipe.night = night ? 1 : 0;
    pipe.skyTop.set(night ? "#0d1226" : "#9fd2ea");
    pipe.skyHor.set(night ? "#1a2240" : "#dcf0ee");
    pipe.hazeColor.copy(pipe.skyHor);
    const w = canvas.clientWidth * 2;
    const h = canvas.clientHeight * 2;
    const aspect = w / h;
    cam.left = -radius * aspect;
    cam.right = radius * aspect;
    cam.top = radius;
    cam.bottom = -radius;
    cam.updateProjectionMatrix();
    cam.position.set(
      20 * Math.cos(ELEVATION) * Math.sin(Math.PI / 4),
      centreY + 20 * Math.sin(ELEVATION),
      20 * Math.cos(ELEVATION) * Math.cos(Math.PI / 4),
    );
    cam.lookAt(0, centreY, 0);
    pipe.render(scene, cam, w, h);
    raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  new MutationObserver(kick).observe(el, { attributes: true, attributeFilter: ["class", "hidden"] });

  const setPreview = (item: ShopItem) => {
    for (const c of [...spin.children]) spin.remove(c);
    const model = item.preview();
    // Stand it on the spin axis so it turns in place.
    const pivot = new THREE.Group();
    pivot.add(model);
    spin.add(pivot);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    pivot.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(pivot);
    centreY = (b2.min.y + b2.max.y) / 2;
    radius = Math.max(0.35, b2.getSize(new THREE.Vector3()).length() / 2) * 0.95;
  };

  const render = (): void => {
    if (!current) return;
    const { shop, item } = current;
    const info: ItemInfo = infoOf(shop, item, backend);
    $(".t").textContent = SHOP_SPECS[shop].name;
    $(".n").textContent = item.name;
    const rar = $<HTMLElement>(".r");
    rar.hidden = !info.rarity;
    rar.textContent = info.rarity ?? "";
    rar.style.background = RARITY_COLOUR[info.rarity ?? ""] ?? "#c9ced6";
    $(".shop-meta").textContent = [info.group, info.blurb].filter(Boolean).join(" · ");
    const state = $(".shop-state");
    const actions = $(".actions");
    actions.replaceChildren();
    state.className = "shop-state";
    const g = info.gate;
    const level = backend.level();
    const purse = info.pays === "company" ? backend.companyCoins() : backend.coins();
    if (g.kind === "level") {
      state.classList.add("bad");
      state.textContent = `🔒 Locked: reach level ${g.level} (you are ${level})`;
    } else if (g.kind === "boss") {
      state.classList.add("bad");
      state.textContent = `🔒 Boss drop: ${g.boss} (raid loot, never sold)`;
    } else if (g.kind === "needs") {
      state.classList.add("bad");
      state.textContent = `🔒 Needs the ${g.what} first`;
    } else if (info.have && !info.again) {
      state.classList.add("good");
      state.textContent =
        g.kind === "earned"
          ? `✓ Earned at level ${g.level}`
          : g.kind === "free"
            ? "✓ Free"
            : info.inUse
              ? "✓ Using it now"
              : "✓ Owned";
    } else if (g.kind === "price") {
      const whose = info.pays === "company" ? "company wallet" : "coins";
      const short = purse === null ? 0 : g.price - purse;
      const held = info.count > 0 ? `✓ ${info.count} to put down · ` : "";
      state.innerHTML =
        purse === null
          ? `${held}<b>🪙 ${g.price}</b> · join a company to buy this`
          : `${held}<b>🪙 ${g.price}</b> from your ${whose}${short > 0 ? ` · ${short} short` : ""}`;
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "primary";
      buy.textContent = pending ? "Buying…" : `Buy · 🪙 ${g.price}`;
      buy.disabled = pending || purse === null || short > 0;
      buy.onclick = () =>
        void run(() => backend.buy(shop, item, g.price), `Bought ${item.name} for 🪙 ${g.price}`);
      actions.append(buy);
    }
    if (info.have) {
      for (const a of actionsOf(shop, item, hooks, backend)) {
        const b = document.createElement("button");
        b.type = "button";
        if (a.primary) b.className = "primary";
        b.disabled = pending;
        b.textContent = a.label;
        b.onclick = () => void run(a.run, a.done);
        actions.append(b);
      }
    }
  };

  /** One write at a time: the buttons wait, then the card shows what the server decided and the toast says so. */
  let pending = false;
  const run = async (f: () => Promise<Outcome>, fallback: string): Promise<void> => {
    if (pending) return;
    pending = true;
    render();
    const shown = current;
    const r = await f().catch(failOf);
    pending = false;
    toast(r.ok ? (r.message ?? fallback) : r.message);
    // Another item may have been opened meanwhile: the card keeps showing that one.
    if (current === shown) render();
  };

  const panel: ShopPanel = {
    open(shop, item) {
      hooks.previewLook(null);
      current = { shop, item };
      // What the server holds may be newer than the cache (a trade, a drop): look again, then redraw.
      void backend.refresh().then(() => current?.item === item && render());
      pipe ??= new Pipeline(canvas, { preserve: false });
      pipe.autoQuality = false;
      pipe.quality = 1;
      setPreview(item);
      render();
      el.hidden = false;
      el.classList.remove("cx-collapsed");
      kick();
    },
    close() {
      el.hidden = true;
      current = null;
      hooks.previewLook(null);
    },
    get isOpen() {
      return !el.hidden;
    },
    dispose() {
      unsub();
      cancelAnimationFrame(raf);
      hooks.previewLook(null);
      for (const n of [style, toastEl, tipEl, el]) n.remove();
      pipe?.renderer.dispose();
    },
    toast,
    tip(text, x = 0, y = 0) {
      tipEl.hidden = text === null;
      if (text !== null) {
        tipEl.textContent = text;
        tipEl.style.left = `${x}px`;
        tipEl.style.top = `${y}px`;
      }
    },
  };
  $<HTMLButtonElement>(".x").onclick = () => panel.close();
  const unsub = backend.onChange(() => render());
  return panel;
}
