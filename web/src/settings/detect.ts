import { type Detected, freshDetected, graphics, type Tier } from "./graphics.ts";
import { type Signals, scoreTier } from "./score.ts";

let gl2: WebGL2RenderingContext | null | undefined;
function probe(): WebGL2RenderingContext | null {
  if (gl2 !== undefined) return gl2;
  try {
    gl2 = document.createElement("canvas").getContext("webgl2");
  } catch {
    gl2 = null;
  }
  return gl2;
}

export const hasWebGL2 = (): boolean => probe() !== null;

export function gpuName(): string | null {
  const gl = probe();
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
}

interface BatteryManager {
  charging: boolean;
  level: number;
}
let battery: BatteryManager | null = null;
if (typeof navigator !== "undefined")
  (navigator as { getBattery?: () => Promise<BatteryManager> }).getBattery?.().then(
    (b) => {
      battery = b;
    },
    () => {},
  );

/** On battery and under 20%, or not charging at all . */
export const lowBattery = (): boolean => !!battery && !battery.charging && battery.level < 0.2;
/** Unplugged with under half left. */
const powerSaver = (): boolean => !!battery && !battery.charging && battery.level < 0.5;

export function collectSignals(benchMs: number | null = null): Signals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl2: hasWebGL2(),
    gpu: gpuName(),
    memory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
    batteryLow: lowBattery(),
    powerSaver: powerSaver(),
    saveData: nav.connection?.saveData === true,
    desktopApp: "__TAURI__" in window,
    benchMs,
  };
}

const TRIANGLES = 300_000;
const BENCH_BUDGET_MS = 600;

/** Draws a few hundred thousand triangles offscreen and returns the average ms per frame, or null. */
export async function benchmark(): Promise<number | null> {
  let context: WebGL2RenderingContext | null = null;
  try {
    const canvas = new OffscreenCanvas(256, 256);
    const gl = canvas.getContext("webgl2");
    context = gl;
    if (!gl) return null;
    const shader = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(
      prog,
      shader(
        gl.VERTEX_SHADER,
        "#version 300 es\nin vec2 p;uniform float t;void main(){gl_Position=vec4(p+vec2(sin(t+p.y*9.0)*.05,0.),0.,1.);}",
      ),
    );
    gl.attachShader(
      prog,
      shader(
        gl.FRAGMENT_SHADER,
        "#version 300 es\nprecision mediump float;out vec4 o;void main(){o=vec4(gl_FragCoord.xy/256.,.5,1.);}",
      ),
    );
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
    gl.useProgram(prog);
    const verts = new Float32Array(TRIANGLES * 6);
    for (let i = 0; i < verts.length; i += 6) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      verts.set([x, y, x + 0.02, y, x, y + 0.02], i);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const t = gl.getUniformLocation(prog, "t");
    const px = new Uint8Array(4);
    const draw = (i: number) => {
      gl.uniform1f(t, i);
      gl.drawArrays(gl.TRIANGLES, 0, TRIANGLES * 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    };
    let total = 0;
    let frames = 0;
    for (let i = 0; i < 9 && total < BENCH_BUDGET_MS; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      if (document.hidden || graphics.get().choice !== "auto") return null;
      const start = performance.now();
      draw(i);
      if (i > 0) {
        total += performance.now() - start;
        frames++;
      }
    }
    return frames ? total / frames : null;
  } catch {
    return null;
  } finally {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** A guess from what is known without running anything. */
export const quickTier = (): Tier => scoreTier(collectSignals()).tier;

/** The full detection, benchmark included. */
export async function detectTier(): Promise<Detected> {
  const signals = collectSignals(hasWebGL2() ? await benchmark() : null);
  const { tier, reasons } = scoreTier(signals);
  return { tier, gpu: signals.gpu, reasons, at: Date.now() };
}

/** At startup: a quick guess now, then the benchmark once the page is idle, unless a fresh result is cached. */
export function startDetection(): void {
  if (graphics.get().choice !== "auto") return;
  graphics.setRuntime({ quick: quickTier() });
  if (freshDetected(graphics.get().detected, gpuName())) return;
  const run = async () => {
    if (graphics.get().choice !== "auto") return;
    const detected = await detectTier();
    if (graphics.get().choice === "auto") graphics.setDetected(detected);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 2000);
}
