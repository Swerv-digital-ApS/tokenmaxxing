import type { Facing, Look } from "@tokenmaxxing/core/world.ts";
import { type DependencyList, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AURA_H, AURA_W, AURA_X, AURA_Y, auraFrame } from "../art/aura.ts";
import { house } from "../art/buildings.ts";
import { characterFrame } from "../art/characters.ts";
import { errorText } from "../errors.ts";
import { world } from "../game/world.ts";
import { hud, type Panel } from "../store.ts";
import { coins } from "./format.ts";

/**
 * Server calls from a panel: `run(fn)` makes a click or submit handler that shows a failure as
 * `error`, and ignores clicks while a call is still going (no double buys or double joins).
 */
export function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const going = useRef(false);
  const run =
    (fn: () => Promise<unknown>) =>
    async (e?: { preventDefault?: () => void }): Promise<void> => {
      e?.preventDefault?.();
      if (going.current) return;
      going.current = true;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(errorText(err));
      } finally {
        going.current = false;
        setBusy(false);
      }
    };
  return { error, busy, run };
}

/** True while something that happened `at` is less than `ms` old; re-renders when it expires. */
export function useFresh(at: number | undefined, ms: number): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    if (at === undefined) return;
    const id = setTimeout(() => tick((n) => n + 1), at + ms - Date.now() + 50);
    return () => clearTimeout(id);
  }, [at, ms]);
  return at !== undefined && Date.now() - at <= ms;
}

/** Re-renders every `ms` while `on`, for countdowns. */
export function useTicker(ms: number, on = true): void {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms, on]);
}

/**
 * What a panel shows, fetched when it opens and again when `deps` change: `data` once it's here (the
 * last one stays up while the next loads), or `error` if it couldn't be.
 */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => {
      let live = true;
      load().then(
        (d) => live && setData(d),
        (e) => live && setError(errorText(e)),
      );
      return () => {
        live = false;
      };
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` is what `load` reads
    deps,
  );
  return { data, error };
}

/** A company's own house, in its brand's colours, as drawn in town. */
export function House({ companyId, tier, scale }: { companyId: number; tier: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = house(tier, world.companies.get(companyId)?.brand ?? null).canvas;
  const w = Math.round(sprite.width * scale);
  const h = Math.round(sprite.height * scale);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);
    // Whole-pixel sizes stay crisp; thumbnails are smoothed so they read instead of losing rows.
    g.imageSmoothingEnabled = scale < 1;
    g.imageSmoothingQuality = "high";
    g.drawImage(sprite, 0, 0, w, h);
  }, [sprite, w, h, scale]);
  return <canvas ref={ref} width={w} height={h} className="house-img" />;
}

/**
 * A sprite drawn crisp in a `width`×`height` canvas: stretched to fill it, or at `scale`× in its middle
 * (`stand`: on its bottom edge, like a pet).
 */
export function Pixels({
  sprite,
  width,
  height,
  scale,
  stand,
  className,
  label,
}: {
  sprite: HTMLCanvasElement | null | undefined;
  width: number;
  height: number;
  scale?: number;
  stand?: boolean;
  className?: string;
  /** What it shows, for a picture that stands on its own. */
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, width, height);
    if (!sprite) return;
    if (scale === undefined) g.drawImage(sprite, 0, 0, width, height);
    else {
      const [w, h] = [sprite.width * scale, sprite.height * scale];
      g.drawImage(sprite, (width - w) / 2, stand ? height - h : (height - h) / 2, w, h);
    }
  }, [sprite, width, height, scale, stand]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}

/**
 * A character drawn crisp at `scale`× (16px sprite); `frame` instead of the look's own for one drawn
 * his own way (the cop). `aura`: the legendary level's halo and glow around them, gently animated (`aura.ts`).
 */
export function AvatarImage({
  look,
  scale = 3,
  facing = "down",
  frame,
  aura,
}: {
  look: Look;
  scale?: number;
  facing?: Facing;
  frame?: HTMLCanvasElement;
  aura?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, h] = aura ? [AURA_W, AURA_H] : [16, 16];
  // The same look is the same (cached) frame, however often a parent makes it again.
  const sprite = frame ?? characterFrame(look, facing, "stand");
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    const draw = () => {
      g.clearRect(0, 0, w * scale, h * scale);
      if (aura) g.drawImage(auraFrame(performance.now(), false), 0, 0, w * scale, h * scale);
      const [x, y] = aura ? [AURA_X, AURA_Y] : [0, 0];
      g.drawImage(sprite, x * scale, y * scale, 16 * scale, 16 * scale);
    };
    draw();
    if (!aura) return;
    const timer = setInterval(draw, 140);
    return () => clearInterval(timer);
  }, [sprite, scale, aura, w, h]);
  return (
    <canvas ref={ref} width={w * scale} height={h * scale} className={aura ? "avatar legendary" : "avatar"} />
  );
}

export function Modal({
  title,
  children,
  wide,
  beside,
}: {
  title: ReactNode;
  children: ReactNode;
  /** Wider than the usual panel; "xl" for a whole workspace (the Bag's dressing room). */
  wide?: boolean | "xl";
  /** Shown next to the dialog, still usable (the chat, beside a game). */
  beside?: ReactNode;
}) {
  // Focus moves into the dialog when it opens, so screen readers and Tab start there.
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={`scrim${beside ? " beside" : ""}`}>
      <button
        type="button"
        className="backdrop"
        aria-label="Close"
        onClick={() => hud.set({ panel: null })}
      />
      {beside}
      <section
        ref={ref}
        tabIndex={-1}
        className={`panel modal${wide ? " wide" : ""}${wide === "xl" ? " xl" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon" aria-label="Close" onClick={() => hud.set({ panel: null })}>
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="pills">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** A toast that opens what it's about: `dismiss` takes it down, then `open` shows, if there is one. */
export function ToastButton({
  open,
  dismiss,
  className,
  children,
}: {
  open?: Panel;
  dismiss: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `toast mention-toast ${className}` : "toast mention-toast"}
      onClick={() => {
        dismiss();
        if (open) hud.set({ panel: open });
      }}
    >
      {children}
    </button>
  );
}

interface Ranked {
  id: number;
  rank: string;
  who: ReactNode;
  value: string;
  mine?: boolean;
  /** What a click on the row opens. */
  open: Panel;
}

/** A short ranked list: the corner's today, the raid's raiders and companies. */
export function RankList({ rows }: { rows: Ranked[] }) {
  return (
    <ol>
      {rows.map((r) => (
        <li key={r.id} className={r.mine ? "mine" : undefined}>
          <button type="button" onClick={() => hud.set({ panel: r.open })}>
            <span className="rank">{r.rank}</span>
            <span className="who">{r.who}</span>
            <span className="value">{r.value}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** "🪙 1,234 coins" at the top of a shop, and whatever else goes on its line. */
export function WalletLine({ balance, children }: { balance: number; children?: ReactNode }) {
  return (
    <p className="wallet">
      <strong>{coins(balance)}</strong> coins
      {children}
    </p>
  );
}

const NARROW = "(max-width: 700px), (max-height: 500px)";

/** A phone or other small screen: the HUD folds its side panels into a row of icons. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(NARROW).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const q = matchMedia(NARROW);
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return narrow;
}
