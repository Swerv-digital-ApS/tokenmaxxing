import {
  type Bet,
  type BetOn,
  colorOf,
  MAX_BETS,
  MAX_SPIN,
  PAYS,
  type RouletteOutcome,
  SPIN_MS,
  SPOTS,
  WHEEL,
} from "@tokenmaxxing/core/roulette.ts";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { sitRoulette } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn, refreshWallet } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { Modal, useTicker } from "./ui.tsx";

const CHIPS = [5, 10, 25, 50, 100];
const HISTORY = 12;
const STEP = 360 / WHEEL.length;
/** Three rows of the grid, top to bottom: 3, 6, 9... then 2, 5... then 1, 4... (columns c3, c2, c1). */
const ROWS = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, i) => i * 3 + r));
const OUTSIDE: { on: BetOn; label: string }[] = [
  { on: "low", label: "1-18" },
  { on: "even", label: "Even" },
  { on: "red", label: "Red" },
  { on: "black", label: "Black" },
  { on: "odd", label: "Odd" },
  { on: "high", label: "19-36" },
];

const PLAYER_COLORS = [
  "#e9b73d",
  "#4aa3ff",
  "#c46bff",
  "#ff8a4a",
  "#4ade80",
  "#f472b6",
  "#22d3ee",
  "#a3e635",
];
const sum = (bets: readonly Bet[]) => bets.reduce((a, b) => a + b.stake, 0);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const NAMES: Record<string, string> = {
  d1: "1st 12",
  d2: "2nd 12",
  d3: "3rd 12",
  c1: "Column 1",
  c2: "Column 2",
  c3: "Column 3",
};
const betName = (on: BetOn): string =>
  on.startsWith("n:")
    ? `Number ${on.slice(2)}`
    : (OUTSIDE.find((o) => o.on === on)?.label ?? NAMES[on] ?? on);

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r] as const;
};

/** The wheel: pockets in wheel order. `angle` turns it; the ball arm turns the other way and stops at the top. */
function Wheel({
  wheel,
  arm,
  animate,
  ballIn,
}: {
  wheel: number;
  arm: number;
  animate: boolean;
  ballIn: boolean;
}) {
  const t = animate ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.6, 0.2, 1)` : "none";
  return (
    <div className="rl-wheel" aria-hidden="true">
      <div className="rl-wheel-rot" style={{ transform: `rotate(${wheel}deg)`, transition: t }}>
        <svg viewBox="-100 -100 200 200" role="img" aria-label="Roulette wheel">
          <circle r="99" className="rl-rim" />
          {WHEEL.map((n, i) => {
            const [x1, y1] = pt((i - 0.5) * STEP, 88);
            const [x2, y2] = pt((i + 0.5) * STEP, 88);
            const [x3, y3] = pt((i + 0.5) * STEP, 62);
            const [x4, y4] = pt((i - 0.5) * STEP, 62);
            const [tx, ty] = pt(i * STEP, 75);
            return (
              <g key={n}>
                <path
                  className={`rl-pocket ${colorOf(n)}`}
                  d={`M${x1} ${y1}A88 88 0 0 1 ${x2} ${y2}L${x3} ${y3}A62 62 0 0 0 ${x4} ${y4}Z`}
                />
                <text x={tx} y={ty} transform={`rotate(${i * STEP} ${tx} ${ty})`} className="rl-pn">
                  {n}
                </text>
              </g>
            );
          })}
          <circle r="58" className="rl-hub" />
          <circle r="14" className="rl-cap" />
        </svg>
      </div>
      <div className="rl-arm" style={{ transform: `rotate(${arm}deg)`, transition: t }}>
        <span className={`rl-ball${ballIn ? " in" : ""}`} />
      </div>
      <span className="rl-pointer" />
    </div>
  );
}

function Spot({
  on,
  className,
  stake,
  others,
  onAdd,
  onRemove,
  children,
}: {
  on: BetOn;
  className: string;
  stake: number;
  /** Other players' chips on this spot, in their colours. */
  others: { color: string; name: string; stake: number }[];
  onAdd: (on: BetOn) => void;
  onRemove: (on: BetOn) => void;
  children: React.ReactNode;
}) {
  const click = (e: MouseEvent) => (e.shiftKey ? onRemove(on) : onAdd(on));
  return (
    <button
      type="button"
      className={`rl-spot ${className}${stake ? " has" : ""}`}
      aria-label={`${betName(on)}${stake ? `, ${stake} coins` : ""}`}
      onClick={click}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove(on);
      }}
    >
      {children}
      {stake > 0 && <span className="rl-stack">{stake}</span>}
      {others.length > 0 && (
        <span className="rl-others">
          {others.map((o) => (
            <i key={o.name} title={`${o.name}: ${o.stake}`} style={{ background: o.color }}>
              {o.stake}
            </i>
          ))}
        </span>
      )}
    </button>
  );
}

const outcomeLine = (o: RouletteOutcome, me: number, pocket: number, color: string) => {
  const who = o.userId === me ? "You" : o.name;
  return o.payout > o.staked
    ? `${who} won ${o.payout - o.staked} on ${pocket} ${color}`
    : `${who} lost ${o.staked - o.payout}`;
};

/**
 * The net cafe's roulette table, shared with everyone at it: bets are open for a while, then the wheel spins
 * once for the whole table and pays everyone. The server owns the rounds (`rouletteBet`, `rouletteReady`); the
 * panel sets your chips, plays the wheel from `hud.roulette` and, in watch mode, only shows the table.
 */
export function RoulettePanel({ watch = false }: { watch?: boolean }) {
  const wallet = useHud((s) => s.wallet);
  const table = useHud((s) => s.roulette);
  const me = world.selfId;
  useTicker(250, !!table);
  const mine = table?.players.find((p) => p.userId === me) ?? null;
  const seated = table?.seats.some((x) => x.userId === me) ?? false;
  const wasSeated = useRef(false);
  const [chip, setChip] = useState(10);
  /** Every chip put down this round, oldest first; Undo takes the last. */
  const [placed, setPlaced] = useState<Bet[]>([]);
  const [wheel, setWheel] = useState(0);
  const [arm, setArm] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const seen = useRef(table?.phase === "spinning" ? 0 : (table?.last?.id ?? 0));
  const mounted = useRef(false);
  const round = useRef(table?.round ?? 0);
  const flight = useRef<{ busy: boolean; dirty: boolean; bets: Bet[] }>({
    busy: false,
    dirty: false,
    bets: [],
  });

  // Closing the betting view stands me up from the spot.
  useEffect(() => {
    if (watch) return;
    return () => void conn.rouletteLeave();
  }, [watch]);
  // Walked off (or the server freed the spot): the betting view closes.
  useEffect(() => {
    if (watch || !table) return;
    if (seated) wasSeated.current = true;
    else if (wasSeated.current) hud.set({ panel: null, dialog: "You left the table." });
  }, [watch, table, seated]);
  // A new round starts with an empty board.
  useEffect(() => {
    if (!table || table.round === round.current) return;
    round.current = table.round;
    setPlaced([]);
  }, [table]);
  // The wheel lands on each spin once; the wallet follows what the round paid.
  const lastId = table?.last?.id ?? 0;
  const phase = table?.phase;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the spin id and phase alone.
  useEffect(() => {
    const last = table?.last;
    if (!mounted.current) {
      // Opened between spins: the wheel already stands on the last pocket.
      mounted.current = true;
      if (last && phase !== "spinning") landOn(last.pocket, false);
    }
    if (last && last.id !== seen.current) {
      seen.current = last.id;
      landOn(last.pocket, phase === "spinning");
    }
    if (phase === "result") void refreshWallet();
  }, [lastId, phase]);

  /** Turns the wheel and ball to land on `pocket`, always forwards by a few turns. */
  const landOn = (pocket: number, animated: boolean) => {
    const i = WHEEL.indexOf(pocket as (typeof WHEEL)[number]);
    if (i < 0) return;
    if (reduced() || !animated) {
      setAnimate(false);
      setWheel((w) => w - ((((w + i * STEP) % 360) + 360) % 360));
      setArm((a) => Math.round(a / 360) * 360);
      return;
    }
    setAnimate(true);
    setWheel((w) => {
      const target = -i * STEP;
      return target + Math.ceil((w + 360 * 3 - target) / 360) * 360;
    });
    setArm((a) => Math.floor(a / 360) * 360 - 360 * 5);
  };

  const stakes = new Map<BetOn, number>();
  for (const p of placed) stakes.set(p.on, (stakes.get(p.on) ?? 0) + p.stake);
  const bets: Bet[] = [...stakes].map(([on, stake]) => ({ on, stake }));
  const total = sum(bets);
  const serverNow = table ? Date.now() + (table.now - table.at) : 0;
  const left = table ? Math.max(0, table.phaseEndsAt - serverNow) : 0;
  const open = !!table && table.phase === "betting" && left > 0 && seated;
  const balance = (wallet?.balance ?? 0) + sum(mine?.bets ?? []);

  /** Sends the whole bet set; one at a time (the server refuses overlapping ones), the latest set wins. */
  const push = async (next: Bet[]) => {
    const f = flight.current;
    f.bets = next;
    if (f.busy) {
      f.dirty = true;
      return;
    }
    f.busy = true;
    try {
      do {
        f.dirty = false;
        const r = await conn.rouletteBet(f.bets);
        setProblem(r && "notice" in r ? r.notice : null);
      } while (f.dirty);
      void refreshWallet();
    } finally {
      f.busy = false;
    }
  };
  const set = (next: Bet[]) => {
    setPlaced(next);
    const m = new Map<BetOn, number>();
    for (const p of next) m.set(p.on, (m.get(p.on) ?? 0) + p.stake);
    void push([...m].map(([on, stake]) => ({ on, stake })));
  };
  const add = (on: BetOn) => {
    if (!open) return;
    if (!stakes.has(on) && stakes.size >= MAX_BETS) return;
    if (total + chip > MAX_SPIN || total + chip > balance) return;
    set([...placed, { on, stake: chip }]);
  };
  const remove = (on: BetOn) => {
    if (!open) return;
    const i = placed.findLastIndex((x) => x.on === on);
    if (i >= 0) set(placed.filter((_, j) => j !== i));
  };
  const ready = async () => {
    const r = await conn.rouletteReady(!mine?.ready);
    setProblem(r && "notice" in r ? r.notice : null);
  };
  const take = async () => {
    setProblem(null);
    if (await sitRoulette()) hud.set({ panel: { kind: "roulette" } });
    else setProblem("Walk onto a free spot below the table first.");
  };

  if (!wallet) return <Modal title="🎡 Roulette">Loading…</Modal>;

  const last = table?.last ?? null;
  const landed = !!last && (phase !== "spinning" || left <= 0);
  const status =
    phase === "betting"
      ? `Bets close in ${Math.ceil(left / 1000)}s`
      : phase === "spinning"
        ? "No more bets…"
        : phase === "result" && last
          ? `${last.pocket} ${last.color}`
          : "Waiting for a player";
  const mineOut = last?.results.find((o) => o.userId === me);
  const net = mineOut ? mineOut.payout - mineOut.staked : 0;
  const stakeOf = (on: BetOn) => stakes.get(on) ?? 0;
  const colorOfUser = (id: number) => PLAYER_COLORS[table?.seats.find((x) => x.userId === id)?.spot ?? 0]!;
  const othersOn = (on: BetOn) =>
    (table?.players ?? [])
      .filter((p) => p.userId !== me)
      .flatMap((p) => {
        const stake = sum(p.bets.filter((b) => b.on === on));
        const name = table?.seats.find((x) => x.userId === p.userId)?.name ?? "?";
        return stake > 0 ? [{ color: colorOfUser(p.userId), name, stake }] : [];
      });
  const spot = (on: BetOn, className: string, label: React.ReactNode) => (
    <Spot
      key={on}
      on={on}
      className={className}
      stake={stakeOf(on)}
      others={othersOn(on)}
      onAdd={add}
      onRemove={remove}
    >
      {label}
    </Spot>
  );
  const strip = (table?.history ?? []).slice(0, HISTORY);
  const results = landed && last && (phase === "result" || phase === "betting" || phase === "idle") && (
    <div className="rl-result" role="status">
      <div className="rl-res-head">
        <span className={`rl-hist big ${last.color}`}>{last.pocket}</span>
        <span className="rl-res-name">{last.color}</span>
        {mineOut && (
          <strong className={`rl-net ${net > 0 ? "up" : net < 0 ? "down" : ""}`}>{signed(net)} 🪙</strong>
        )}
      </div>
      <ul className="rl-res-list">
        {last.results.map((o) => (
          <li key={o.userId} className={o.payout > o.staked ? "won" : "lost"}>
            <span>{outcomeLine(o, me, last.pocket, last.color)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const wheelView = (
    <div className="rl-left">
      <Wheel wheel={wheel} arm={arm} animate={animate} ballIn={!!last && phase !== "betting"} />
      <p className="rl-status" role="status">
        {status}
      </p>
      <div className="rl-history" title="Last pockets">
        {strip.length === 0 && <span className="muted small">No spins yet</span>}
        {strip.map((n, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same pocket can repeat; the strip only ever shifts.
          <span key={i} className={`rl-hist ${colorOf(n)}`}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
  const seatsView = (
    <>
      <h4>
        At the table
        {phase === "betting" && (table?.players.length ?? 0) > 0 && (
          <span className="muted small">
            {" "}
            · {table?.players.filter((p) => p.ready).length}/{table?.players.length} ready
          </span>
        )}
      </h4>
      <ul className="rl-seats">
        {Array.from({ length: SPOTS }, (_, i) => {
          const seat = table?.seats.find((x) => x.spot === i);
          const p = seat && table?.players.find((x) => x.userId === seat.userId);
          const staked = p ? sum(p.bets) : 0;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: spots are fixed places.
            <li key={i} className={seat ? "" : "muted"}>
              {seat && <i className="rl-dot" style={{ background: PLAYER_COLORS[i] }} />}
              {seat ? (seat.userId === me ? `${seat.name} (you)` : seat.name) : "Open spot"}
              {seat && staked > 0 && ` · 🪙 ${staked}`}
              {p?.ready && " · ready ✓"}
            </li>
          );
        })}
      </ul>
    </>
  );

  if (watch)
    return (
      <Modal title="🎡 Roulette · watching" wide="xl">
        <div className="rl-bar">
          <span className="muted small">
            Single zero · {table?.seats.length ?? 0}/{SPOTS} at the table
          </span>
          {!seated && (table?.seats.length ?? 0) < SPOTS && (
            <button type="button" className="primary" onClick={() => void take()}>
              Take a spot
            </button>
          )}
          {seated && (
            <button
              type="button"
              className="primary"
              onClick={() => hud.set({ panel: { kind: "roulette" } })}
            >
              Back to my bets
            </button>
          )}
          <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
            Close
          </button>
        </div>
        <div className="rl-main">
          {wheelView}
          <div className="rl-right">
            {results || <p className="muted">{status}</p>}
            {seatsView}
            {problem && <p className="error">{problem}</p>}
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal title="🎡 Roulette" wide="xl">
      <div className="rl-bar">
        <span className="coin-chip on">
          <strong>{coins(wallet.balance)}</strong> yours
        </span>
        <span className="muted small">Single zero · {coins(MAX_SPIN)} a spin at most</span>
        <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
          Leave table
        </button>
      </div>
      <div className="rl-main">
        {wheelView}
        <div className="rl-right">
          <div className="rl-board">
            {spot("n:0", "green rl-zero", "0")}
            {ROWS.map((row, r) => row.map((n) => spot(`n:${n}`, `${colorOf(n)} rl-r${r + 1}`, n)))}
            {(["c3", "c2", "c1"] as const).map((c, r) => spot(c, `rl-col rl-r${r + 1}`, "2:1"))}
            {(["d1", "d2", "d3"] as const).map((d, i) =>
              spot(d, `rl-dozen rl-d${i + 1}`, ["1st 12", "2nd 12", "3rd 12"][i]),
            )}
            {OUTSIDE.map((o, i) =>
              spot(o.on, `rl-out ${o.on === "red" || o.on === "black" ? o.on : ""} rl-o${i + 1}`, o.label),
            )}
          </div>
          <div className="rl-chips">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={chip === c}
                className={`rl-chip${chip === c ? " on" : ""}`}
                onClick={() => setChip(c)}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              disabled={!open || placed.length === 0}
              onClick={() => set(placed.slice(0, -1))}
            >
              Undo
            </button>
            <button type="button" disabled={!open || placed.length === 0} onClick={() => set([])}>
              Clear
            </button>
            <span className="rl-total">
              Staked <strong>{coins(total)}</strong> on {bets.length} {bets.length === 1 ? "spot" : "spots"}
            </span>
          </div>
          <p className="muted small rl-legend">
            Click to add a chip · right-click or shift-click to take one off · Number {PAYS.n!}:1 · Dozen and
            column {PAYS.d1}:1 · Red, black, odd, even, 1-18, 19-36 {PAYS.red}:1 · Zero loses every outside
            bet.
          </p>
          <div className="rl-go">
            <button
              type="button"
              className="primary rl-spin"
              disabled={!open || bets.length === 0}
              onClick={() => void ready()}
            >
              {mine?.ready ? "Ready ✓ (undo)" : "Ready · spin now"}
            </button>
            <span className="muted small">
              {open
                ? bets.length === 0
                  ? "Place a bet; the wheel spins when the clock ends or everyone is ready."
                  : "The wheel spins when the clock ends or everyone is ready."
                : status}
            </span>
          </div>
          {problem && <p className="error">{problem}</p>}
          {results}
          {seatsView}
        </div>
      </div>
    </Modal>
  );
}
