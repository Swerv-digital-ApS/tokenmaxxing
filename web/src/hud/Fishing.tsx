import {
  BITE_WINDOW_MS,
  catchLine,
  FISH,
  type FishCatch,
  type FishingCast,
  type FishingEntry,
  type FishingState,
  fishById,
  fishingPhase,
  hasRecord,
  isSpecimen,
  type Luck,
  lengthOf,
  MISSED_LINES,
  medalOf,
  type PondRecord,
  WAITING_LINES,
} from "@tokenmaxxing/core/fishing.ts";
import { FISHING_ITEMS, LUCKY_CASTS, TREASURE_ODDS } from "@tokenmaxxing/core/fishing-loot.ts";
import { RARITY_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { fishCanvas } from "../art/fish.ts";
import { setFishingLine, setLanded } from "../game/fishing-line.ts";
import { self, world } from "../game/world.ts";
import { conn, town } from "../net.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal, Pills, useLoad, useRun, useTicker } from "./ui.tsx";

type Tab = "journal" | "records" | "treasures";
const TABS: readonly (readonly [Tab, string])[] = [
  ["journal", "📖 Journal"],
  ["records", "🏆 Pond records"],
  ["treasures", "💎 Treasures"],
];
const MEDAL_EMOJI = { bronze: "🥉", silver: "🥈", gold: "🥇" } as const;
const LOOK = defaultLook(1);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** A fish's sprite, crisp at `scale`; `ghost` is the journal's dark silhouette of one not caught yet. */
export function FishPic({ id, scale = 3, ghost = false }: { id: string; scale?: number; ghost?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const art = fishCanvas(id, scale, ghost);
    c.width = art.width;
    c.height = art.height;
    c.getContext("2d")?.drawImage(art, 0, 0);
  }, [id, scale, ghost]);
  return <canvas ref={ref} className="fish-pic" />;
}

/** The pond: cast, wait for the dip, reel in time. Your journal, the town's records and the treasures underneath. */
export function Fishing() {
  const { data, error: loadError } = useLoad(() => town.fishingState(), []);
  const [state, setState] = useState<FishingState | null>(null);
  const [cast, setCast] = useState<FishingCast | null>(null);
  const [caught, setCaught] = useState<{
    fish: FishCatch;
    line: string;
    record: boolean;
    treasure: string | null;
  } | null>(null);
  const [message, setMessage] = useState("Borrow a rod, cast a line, and wait for the bobber to dip.");
  const [waiting, setWaiting] = useState(WAITING_LINES[0]!);
  const [missed, setMissed] = useState(MISSED_LINES[0]!);
  const [tab, setTab] = useState<Tab>("journal");
  const { error, busy, run } = useRun();
  const live = useRef(true);
  const [skew, setSkew] = useState(0);
  useTicker(80, cast !== null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      setFishingLine(null);
      void conn.fishingCancel().catch(() => {});
    };
  }, []);
  const now = Date.now() - skew;
  const phase = cast ? fishingPhase(cast, now) : null;
  const s = state ?? data;
  const castLine = run(async () => {
    const me = self();
    if (!me) return;
    const reply = await conn.fishingCast(me.facing);
    if (!live.current) return;
    setCaught(null);
    if (!reply.ok) {
      setMessage(reply.message);
      return;
    }
    setWaiting(pick(WAITING_LINES));
    setMissed(pick(MISSED_LINES));
    setSkew(Date.now() - reply.now);
    setCast(reply.cast);
    setFishingLine(reply.cast);
  });
  const reel = run(async () => {
    const reply = await conn.fishingReel();
    if (!live.current) return;
    const line = cast;
    setCast(null);
    setFishingLine(null);
    if (!reply.ok) {
      setMessage(reply.message);
      return;
    }
    if (line) setLanded({ fish: reply.catch.fish, cast: line, at: performance.now() });
    setCaught({
      fish: reply.catch,
      line: catchLine(reply.catch),
      record: reply.record,
      treasure: reply.treasure?.item ?? null,
    });
    setState((was) => {
      const base = was ?? data;
      if (!base) return was;
      return {
        journal: reply.journal,
        luck: reply.luck,
        records: reply.record ? recordsWith(base.records, reply.catch) : base.records,
        treasures: reply.treasure ? [...base.treasures, reply.treasure.item] : base.treasures,
      };
    });
  });
  const fish = caught && fishById(caught.fish.fish);
  return (
    <Modal title="🎣 Pond fishing" wide>
      <p className="muted">
        Free rod and bait. Catch and release: your journal keeps every species and personal best.
      </p>
      <div className={`fishing-scene ${phase === "bite" ? "biting" : ""}`}>
        <span className="fishing-reeds" aria-hidden="true">
          🌾
        </span>
        <span className={`fishing-bobber ${cast ? "cast" : ""}`} aria-hidden="true" />
        {fish && (
          <span key={`${fish.id}:${caught.fish.cm}:${caught.line}`} className="fishing-catch leap">
            <FishPic id={fish.id} scale={5} />
          </span>
        )}
      </div>
      <p role="status" aria-live="polite" className="fishing-status">
        {phase === "waiting" ? (
          <code>{waiting}</code>
        ) : phase === "bite" ? (
          <strong>A bite! Reel it in!</strong>
        ) : phase === "missed" ? (
          missed
        ) : fish ? (
          <>
            <strong style={{ color: RARITY_COLOR[fish.rarity] }}>
              {fish.emoji} {fish.name} · {lengthOf(caught.fish)}!
            </strong>{" "}
            {caught.line}
          </>
        ) : (
          message
        )}
      </p>
      {caught?.record && <p className="fishing-record">🏆 A new pond record for the {fish?.name}!</p>}
      {caught?.treasure && <TreasureFound id={caught.treasure} />}
      {phase === "bite" && (
        <progress
          className="fishing-timer"
          aria-label="Time left to reel"
          max={BITE_WINDOW_MS}
          value={Math.max(0, cast!.endsAt - now)}
        />
      )}
      <div className="actions">
        {!cast || phase === "missed" ? (
          <button type="button" disabled={busy} onClick={castLine}>
            Cast a line
          </button>
        ) : (
          <button type="button" disabled={busy || phase !== "bite"} onClick={reel}>
            {phase === "bite" ? "Reel it in!" : "Waiting for a bite…"}
          </button>
        )}
      </div>
      {(error || loadError) && <p className="error">{error || loadError}</p>}
      {s && <LuckLine luck={s.luck} />}
      <Pills value={tab} options={TABS} onChange={setTab} />
      {!s ? (
        <p className="muted">Loading…</p>
      ) : tab === "journal" ? (
        <Journal journal={s.journal} records={s.records} />
      ) : tab === "records" ? (
        <Records records={s.records} />
      ) : (
        <Treasures found={s.treasures} />
      )}
    </Modal>
  );
}

/** The records after `c` beat its species' one: mine now. */
function recordsWith(records: readonly PondRecord[], c: FishCatch): PondRecord[] {
  const mine: PondRecord = { fish: c.fish, cm: c.cm, userId: world.selfId, name: self()?.info.name ?? "You" };
  return [...records.filter((r) => r.fish !== c.fish), mine].sort((a, b) => a.fish.localeCompare(b.fish));
}

function LuckLine({ luck }: { luck: Luck }) {
  return (
    <p className="fishing-luck muted small">
      🍀 Lucky casts left today: <strong>{luck.left}</strong>/{luck.of}
      {luck.left > 0
        ? ` · each has a ${TREASURE_ODDS * 100}% chance of a pond treasure`
        : " · the treasure is hiding until tomorrow, but the fish still bite"}
    </p>
  );
}

function TreasureFound({ id }: { id: string }) {
  const item = itemById(id);
  if (!item) return null;
  const rarity = item.rarity ?? "rare";
  return (
    <div className="fishing-treasure" style={{ "--r": RARITY_COLOR[rarity] } as CSSProperties} role="status">
      <ItemImage item={item} look={LOOK} bare />
      <span>
        <span className="cs-rarity" style={{ color: RARITY_COLOR[rarity] }}>
          💎 Pond treasure · {rarity}
        </span>
        <strong>Something else was on the hook: {item.name}!</strong>
        <span className="muted small">{item.blurb} It's in your bag.</span>
      </span>
    </div>
  );
}

function Journal({ journal, records }: { journal: readonly FishingEntry[]; records: readonly PondRecord[] }) {
  const meId = world.selfId;
  const have = journal.filter((e) => fishById(e.fish)).length;
  return (
    <>
      <h3>
        Fishing journal · {have}/{FISH.length} species
      </h3>
      <ul className="fishing-journal">
        {FISH.map((f) => {
          const entry = journal.find((e) => e.fish === f.id);
          const medal = entry ? medalOf(entry.count) : null;
          const held = records.find((r) => r.fish === f.id)?.userId === meId && meId !== null;
          return (
            <li
              key={f.id}
              className={entry ? "" : "unseen"}
              title={entry ? f.blurb : (f.hint ?? "Not caught yet")}
            >
              <FishPic id={f.id} scale={3} ghost={!entry} />
              <span className="fishing-entry">
                <strong style={entry ? { color: RARITY_COLOR[f.rarity] } : undefined}>
                  {entry ? f.name : "???"}
                </strong>
                <span className="muted small">
                  {entry
                    ? `${entry.count} caught · best ${lengthOf(entry)}`
                    : (f.hint ?? `${f.rarity[0]!.toUpperCase()}${f.rarity.slice(1)} · not caught yet`)}
                </span>
                {entry && <span className="small fishing-blurb">{f.blurb}</span>}
              </span>
              <span className="fishing-medals">
                {medal && <span title={`${medal} medal: ${entry!.count} caught`}>{MEDAL_EMOJI[medal]}</span>}
                {entry && isSpecimen(entry) && (
                  <span title="Perfect specimen: caught at its longest">⭐</span>
                )}
                {held && <span title="You hold the pond record">🏆</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        🥉 first catch · 🥈 10 caught · 🥇 50 caught · ⭐ caught at its longest · 🏆 pond record
      </p>
    </>
  );
}

function Records({ records }: { records: readonly PondRecord[] }) {
  const meId = world.selfId;
  const ranked = FISH.filter((f) => hasRecord(f.id));
  return (
    <ul className="fishing-journal">
      {ranked.map((f) => {
        const r = records.find((x) => x.fish === f.id);
        return (
          <li key={f.id} className={r ? (r.userId === meId ? "mine" : "") : "unseen"}>
            <FishPic id={f.id} scale={2} ghost={!r} />
            <span className="fishing-entry">
              <strong>{r ? f.name : "???"}</strong>
              <span className="muted small">
                {r
                  ? `${lengthOf(r)} · ${r.userId === meId ? "you!" : r.name}`
                  : "No record yet: be the first"}
              </span>
            </span>
            {r && <span className="fishing-medals">🏆</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Treasures({ found }: { found: readonly string[] }) {
  const have = new Set(found);
  return (
    <>
      <p className="muted small">
        Only the pond has these. The day's first {LUCKY_CASTS} catches each have a {TREASURE_ODDS * 100}%
        chance of turning one up: rare most of the time, epic now and then, legendary once in a blue moon.
      </p>
      <ul className="fishing-treasures">
        {FISHING_ITEMS.map((item) => (
          <li
            key={item.id}
            className={have.has(item.id) ? "" : "unseen"}
            style={{ "--r": RARITY_COLOR[item.rarity] } as CSSProperties}
            title={have.has(item.id) ? item.blurb : "Not found yet"}
          >
            <span className="fishing-treasure-pic">
              {have.has(item.id) ? (
                <ItemImage item={item} look={LOOK} bare />
              ) : (
                <span aria-hidden="true">❔</span>
              )}
            </span>
            <strong>{have.has(item.id) ? item.name : "???"}</strong>
            <span className="small" style={{ color: RARITY_COLOR[item.rarity] }}>
              {item.rarity}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
