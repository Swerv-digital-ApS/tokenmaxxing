import { compact, countdown, plural } from "@tokenmaxxing/core/format.ts";
import { BOSSES, bossAt, rewardFor } from "@tokenmaxxing/core/raid.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import { useEffect, useRef, useState } from "react";
import { bossSilhouette } from "../art/bosses.ts";
import { send } from "../game/input.ts";
import { left, opensAt } from "../game/raid.ts";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { dayText } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { LootSection } from "./Loot.tsx";
import { Modal, Pixels, RankList, ToastButton, useFresh, useTicker } from "./ui.tsx";

/** "3d 4h", "5h 12m", "40m", "12s". */
function timeLeft(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m >= 24 * 60) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m === 0 && ms > 0) return `${Math.ceil(ms / 1000)}s`;
  return `${m}m`;
}

const share = (r: Raid) => (r.hp > 0 ? left(r) / r.hp : 0);

function HpBar({ raid }: { raid: Raid }) {
  const s = share(raid);
  return (
    // The numbers are in the text beside it.
    <div className="hp" aria-hidden="true">
      <span className={s > 0.5 ? "ok" : s > 0.2 ? "low" : "dire"} style={{ width: `${s * 100}%` }} />
    </div>
  );
}

/** In the corner, under the games: the boss, its rung and HP, and how long the town has left. */
export function RaidBox() {
  const raid = useHud((s) => s.raid);
  useTicker(raid?.prelaunch ? 1000 : 60_000, !!raid);
  if (!raid) return null;
  if (raid.prelaunch)
    return (
      <section className="panel raid-box raid-teaser-box" aria-label="Raid">
        <button
          type="button"
          className="miniboard-title"
          onClick={() => hud.set({ panel: { kind: "raid" } })}
        >
          ⚠️ Something is coming <span className="muted">›</span>
        </button>
        <div className="raid-line">
          <span className="who">??? · {timeLeft(raid.launchAt - Date.now())}</span>
          <small className="muted">Mon {opensAt(raid)}</small>
        </div>
        <div className="raid-clock" role="timer">
          {countdown(raid.launchAt)}
        </div>
      </section>
    );
  return (
    <section className="panel raid-box" aria-label="Raid">
      <button type="button" className="miniboard-title" onClick={() => hud.set({ panel: { kind: "raid" } })}>
        ⚔️ Raid{" "}
        <span className="muted">
          · {raid.closed ? `opens ${opensAt(raid)} ›` : `${timeLeft(raid.endsAt - Date.now())} left ›`}
        </span>
      </button>
      <div className="raid-line">
        <span className="who">
          {raid.boss.emoji} {raid.boss.name}
        </span>
        <small className="muted">
          {raid.kills.length > 0 && `🏆${raid.kills.length} · `}
          {raid.closed
            ? "week over"
            : raid.cleared
              ? "cleared"
              : `rung ${raid.boss.rung} · ${Math.ceil(share(raid) * 100)}%`}
        </small>
      </div>
      <HpBar raid={raid} />
    </section>
  );
}

/** Rungs shown past the current one, greyed, with what they'd pay. */
const AHEAD = 3;

/** This week's ladder: the kills, the rung being fought, and the next few. */
function Ladder({ raid }: { raid: Raid }) {
  const { rules } = raid;
  const reward = (rung: number) => rewardFor(rung, raid.level, raid.week);
  return (
    <ol className="raid-ladder">
      {raid.kills.map((k) => (
        <li key={k.rung} className="fell">
          <span className="rung">{k.rung}</span>
          <span className="who">
            🏆 {k.boss.emoji} {k.boss.name}
          </span>
          <span className="muted small">
            {dayText(k.day, { weekday: "short" })} · {k.raiders} raiders · 🪙 {k.coins}
            {k.paid && " ✓"}
          </span>
        </li>
      ))}
      {raid.cleared ? (
        <li className="now">
          <span className="who">🏁 Ladder cleared</span>
          <span className="muted small">Next one opens Monday {opensAt(raid)}</span>
        </li>
      ) : (
        <li className="now">
          <span className="rung">{raid.boss.rung}</span>
          <span className="who">
            {raid.boss.emoji} {raid.boss.name}
          </span>
          <span className="muted small">
            {compact(left(raid))} / {compact(raid.hp)} · 🪙 {reward(raid.boss.rung)}
          </span>
        </li>
      )}
      {!raid.closed &&
        !raid.cleared &&
        Array.from({ length: Math.min(AHEAD, BOSSES.length - raid.boss.rung) }, (_, i) => {
          const b = bossAt(raid.boss.rung + i + 1, raid.level);
          return (
            <li key={b.rung} className="ahead">
              <span className="rung">{b.rung}</span>
              <span className="who">
                {b.emoji} {b.name}
              </span>
              <span className="small">
                {compact(raid.hp * rules.hpGrowth ** (i + 1))} HP · 🪙 {reward(b.rung)}
              </span>
            </li>
          );
        })}
    </ol>
  );
}

/** Before the first raid: a countdown, the first boss's shadow, and what's coming. */
function Teaser({ raid }: { raid: Raid }) {
  const { rules } = raid;
  return (
    <Modal title="⚠️ Something is coming">
      <div className="raid raid-teaser">
        <div className="raid-shadow">
          {/* The first boss's shadow, big and crisp. */}
          <ItemIcon spec={{ kind: "boss", id: raid.boss.id }} size={132} className="raid-silhouette">
            <Pixels
              sprite={bossSilhouette(raid.boss.id)}
              width={132}
              height={132}
              className="raid-silhouette"
              label="A shadow, waiting"
            />
          </ItemIcon>
          <span className="raid-qqq">???</span>
        </div>
        <p className="raid-hint muted small">It has a limit. Soon, so will you.</p>
        <p className="raid-countdown" role="timer">
          {countdown(raid.launchAt)}
        </p>
        <p className="raid-status">
          The Raid Dungeon opens <strong>Monday at {opensAt(raid)}</strong>. Until then the gate in the square
          stays boarded up.
        </p>
        <p className="muted small">
          Rung 1 so far: <strong>{compact(raid.hp)} HP</strong>, {Math.round(rules.hpShare * 100)}% of
          everything the town syncs this week (at least {compact(rules.minHp)}). The more you burn now, the
          bigger it gets.
        </p>

        <h3>How it works</h3>
        <ul className="raid-rules muted small">
          <li>
            Every Monday at {opensAt(raid)} a ladder of bosses opens. Kill one and the next, ×{rules.hpGrowth}{" "}
            tougher, steps up at once, with the overflow carried over. Clear all five and the ladder is done
            till next Monday, when it comes back one level up, {Math.round((rules.weeklyGrowth - 1) * 100)}%
            tougher; fall short and it starts again at the same level.
          </li>
          <li>
            Every token you sync hits the boss, no cap, wherever you are. Every PR you open is a{" "}
            {compact(rules.prHit)} special attack.
          </li>
          <li>
            Everyone with agents running gets a desk in the dungeon, firing magic missiles as fast as they
            burn.
          </li>
          <li>
            Every kill pays everyone with {compact(rules.raiderAt)}+ that week so far: 🪙{" "}
            {rules.rewards.join(", ")} a rung, {Math.round((rules.rewardGrowth - 1) * 100)}% more each level.
          </li>
        </ul>
      </div>
    </Modal>
  );
}

export function RaidPanel() {
  const raid = useHud((s) => s.raid);
  useTicker(raid?.prelaunch ? 1000 : 60_000, !!raid);
  if (!raid) return null;
  if (raid.prelaunch) return <Teaser raid={raid} />;
  const { rules, me } = raid;
  return (
    <Modal title={`${raid.boss.emoji} ${raid.boss.name} · Rung ${raid.boss.rung}`}>
      <div className="raid">
        <p className="raid-status">
          {raid.closed ? (
            <>
              🏁 The week is over: the town cleared <strong>{raid.kills.length}</strong>{" "}
              {raid.kills.length === 1 ? "rung" : "rungs"}. The gate opens at {opensAt(raid)} (
              {timeLeft(raid.endsAt - Date.now())}).
            </>
          ) : (
            <>
              <strong>{compact(left(raid))}</strong> of {compact(raid.hp)} HP left ·{" "}
              {timeLeft(raid.endsAt - Date.now())} to go
            </>
          )}
        </p>
        <HpBar raid={raid} />
        {world.room !== "dungeon" && (
          <button
            type="button"
            className="primary raid-go"
            onClick={() => {
              hud.set({ panel: null });
              world.portalPending = true;
              send(conn.enterDungeon());
            }}
          >
            ⚔️ Go to the dungeon
          </button>
        )}

        {me && (
          <p className="raid-me">
            {me.damage > 0 ? (
              <>
                You hit for <strong>{compact(me.damage)}</strong> this week
                {me.rank !== null && <span className="muted"> · #{me.rank} in town</span>}
                {me.damage < rules.raiderAt && (
                  <span className="muted">
                    {" "}
                    · {compact(rules.raiderAt - me.damage)} more to count as a raider
                  </span>
                )}
              </>
            ) : (
              <>Run an agent to join the fight. Every token you sync this week hits it.</>
            )}
            {me.weekCoins > 0 && <span className="muted"> · 🪙 {me.weekCoins} from kills</span>}
          </p>
        )}

        <h3>The ladder</h3>
        <Ladder raid={raid} />
        <LootSection raid={raid} />

        {raid.top.length > 0 && (
          <>
            <h3>Top raiders</h3>
            <div className="miniboard">
              <RankList
                rows={raid.top.map((r, i) => ({
                  id: r.userId,
                  rank: i === 0 ? "👑" : `#${i + 1}`,
                  who: r.name,
                  value: compact(r.damage),
                  open: { kind: "card", userId: r.userId },
                }))}
              />
            </div>
          </>
        )}

        {raid.companies.length > 0 && (
          <>
            <h3>Companies</h3>
            <div className="miniboard">
              <RankList
                rows={raid.companies.map((c, i) => ({
                  id: c.companyId,
                  rank: `#${i + 1}`,
                  who: `🏢 ${c.name}`,
                  value: compact(c.damage),
                  open: { kind: "companyCard", companyId: c.companyId },
                }))}
              />
            </div>
          </>
        )}

        <h3>How it works</h3>
        <ul className="raid-rules muted small">
          <li>
            A new ladder opens every Monday at {opensAt(raid)}. The first ladder was set from the town's week
            before the raid opened. Clear all five bosses in a week and the next ladder is one level up ("II",
            "III"…) and {Math.round((rules.weeklyGrowth - 1) * 100)}% tougher; otherwise it starts the same as
            this one. Each rung has ×{rules.hpGrowth} the HP of the one before.
          </li>
          <li>
            Kill a boss and the next one steps up at once: Rate Limit, Context Window, Merge Conflict,
            Hallucination, the Invoice. Damage past a kill carries over, but once the Invoice falls the ladder
            is done and the bosses rest until Monday.
          </li>
          <li>Every token you sync hits it, no cap.</li>
          <li>Every PR you open is a special attack for {compact(rules.prHit)}.</li>
          <li>
            In the dungeon, everyone with agents running sits at a desk, wherever they are. Their laptops and
            robot minions fire as fast as they burn tokens; that's just the show. The real hits are every
            token synced, in the dungeon or not, and land with the next sync.
          </li>
          <li>
            Every kill pays everyone with {compact(rules.raiderAt)}+ that week so far: 🪙{" "}
            {rules.rewards.join(", ")} a rung, {Math.round((rules.rewardGrowth - 1) * 100)}% more each level
            up.
          </li>
        </ul>
        {raid.last && (
          <p className="muted small">
            Last week:{" "}
            {raid.last.defeated
              ? `${plural(raid.last.cleared, "rung")}, up to ${raid.last.boss.emoji} ${raid.last.boss.name}, with ${raid.last.raiders} raiders.`
              : `${raid.last.boss.emoji} ${raid.last.boss.name} got away.`}
          </p>
        )}
        {me && me.coins > 0 && <p className="muted small">You've earned 🪙 {me.coins} from raids.</p>}
      </div>
    </Modal>
  );
}

/**
 * A toast for each boss that fell while I was here, and one when the first raid opens. The first raid
 * after load is just where things stood.
 */
export function RaidToast() {
  const raid = useHud((s) => s.raid);
  const seen = useRef<{ week: string; kills: number; prelaunch: boolean } | null>(null);
  const [fell, setFell] = useState<{ kills: Raid["kills"]; at: number } | null>(null);
  const [opened, setOpened] = useState<{ boss: Raid["boss"]; at: number } | null>(null);
  useEffect(() => {
    if (!raid) return;
    const before = seen.current;
    if (before?.prelaunch && !raid.prelaunch) setOpened({ boss: raid.boss, at: Date.now() });
    if (before && before.week === raid.week && raid.kills.length > before.kills)
      setFell({ kills: raid.kills.slice(before.kills), at: Date.now() });
    seen.current = { week: raid.week, kills: raid.kills.length, prelaunch: raid.prelaunch };
  }, [raid]);
  const showFell = useFresh(fell?.at, 10_000);
  const showOpened = useFresh(opened?.at, 12_000);
  return (
    <>
      {showOpened && opened && (
        <ToastButton open={{ kind: "raid" }} dismiss={() => setOpened(null)} className="raid-launch-toast">
          ⚔️ The Raid Dungeon is open: {opened.boss.name} awaits.
        </ToastButton>
      )}
      {showFell &&
        fell?.kills.map((k) => (
          <ToastButton key={k.rung} open={{ kind: "raid" }} dismiss={() => setFell(null)}>
            🏆 {k.boss.name} fell!{k.paid ? ` 🪙 ${k.coins} for you` : ""}
          </ToastButton>
        ))}
    </>
  );
}
