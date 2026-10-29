import { createRoot } from "react-dom/client";
import { bindInput, updateSelf } from "./game/input.ts";
import { watchHudInsets } from "./game/inset.ts";
import { exposeForQa } from "./game/qa.ts";
import { startStage } from "./game/stage.ts";
import { bindTouch } from "./game/touch.ts";
import { advanceRemotes, world } from "./game/world.ts";
import { tauri } from "./hud/AppUpdate.tsx";
import { Hud } from "./hud/Hud.tsx";
import { connect, signIn } from "./net.ts";

const stage = document.getElementById("stage")!;
createRoot(document.getElementById("hud")!).render(<Hud />);

// In the desktop app, a link out of the game (a company's website) opens in the browser.
const app = tauri;
if (app)
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!a || a.origin === location.origin) return;
    e.preventDefault();
    // An app from before `open_link`: the old way, for whatever it's worth.
    app.core.invoke("open_link", { url: a.href }).catch(() => window.open(a.href, "_blank"));
  });

exposeForQa();
watchHudInsets();
const token = await signIn();
if (token) {
  connect(token);
  bindInput(stage);
  bindTouch(stage);
  startStage(stage, (now) => {
    if (!world.selfId) return false;
    updateSelf(now);
    advanceRemotes(now);
    return true;
  });
}
