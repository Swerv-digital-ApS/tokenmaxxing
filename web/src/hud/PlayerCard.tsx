import { workHours } from "@tokenmaxxing/core/agentType.ts";
import { progressOf } from "@tokenmaxxing/core/badges.ts";
import { BARKEEP } from "@tokenmaxxing/core/barkeep.ts";
import { BOTS } from "@tokenmaxxing/core/bots.ts";
import { COP_ID } from "@tokenmaxxing/core/cop.ts";
import { compact, hoursText, levelAt, MAX_LEVEL, plural, usd } from "@tokenmaxxing/core/format.ts";
import {
  LEGENDARY_LEVEL,
  milestoneText,
  milestoneTitle,
  nextMilestone,
} from "@tokenmaxxing/core/milestones.ts";
import { dayKey, type RangeKey } from "@tokenmaxxing/core/range.ts";
import { ITEMS } from "@tokenmaxxing/core/shop.ts";
import { BIO_MAX_LENGTH } from "@tokenmaxxing/core/world.ts";
import type { Profile } from "@tokenmaxxing/server/registry";
import { sortBy } from "hanzio";
import { useState } from "react";
import { copFrame } from "../art/cop.ts";
import { send } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn, town } from "../net.ts";
import { hud } from "../store.ts";
import { Computers } from "./Computers.tsx";
import { dayText, ranges } from "./format.ts";
import { daysAgoText, sourceName } from "./heat.ts";
import { Shelf, ShelfPicker } from "./Showcase.tsx";
import { Tickets } from "./Tickets.tsx";
import { AvatarImage, Modal, Pills, useLoad, useRun } from "./ui.tsx";

export const RANGES = ranges("All");

const TABS = [
  ["profile", "Profile"],
  ["stats", "Stats"],
] as const;

function doing(userId: number): string | null {
  const a = world.avatars.get(userId);
  if (!a) return null;
  if (a.state === "working") return `💻 running ${plural(Math.max(1, a.info.liveAgents), "agent")}`;
  if (a.state === "away") return "💤 asleep";
  if (a.info.dozing) return "💤 away";
  return a.info.online ? "🟢 here" : null;
}

/** A town character: no stats, just who they are. */
const ROLES: Record<number, string> = { [BARKEEP.id]: "🍺 Barkeep of the Tavern" };

export function BotCard({ id }: { id: number }) {
  const bot = BOTS.find((b) => b.id === id);
  if (!bot) return <Modal title="Player">Gone for a walk.</Modal>;
  return (
    <Modal title={bot.name}>
      <div className="card-head">
        <AvatarImage
          look={bot.look}
          scale={5}
          frame={bot.id === COP_ID ? copFrame("down", "stand", null) : undefined}
        />
        <div>
          <p>
            <strong>Level {bot.level}</strong> · {ROLES[bot.id] ?? "🤖 Town character"}
          </p>
          <p className="muted">{bot.bio}</p>
        </div>
      </div>
    </Modal>
  );
}

export function PlayerCard({ userId }: { userId: number }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data: p, error } = useLoad(() => town.profile(userId, range), [userId, range]);
  // What I changed on my own card, until the next load.
  const [shelf, setShelf] = useState<Profile["showcase"]>();
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<"profile" | "stats">("profile");

  if (error) return <Modal title="Player">{error}</Modal>;
  if (!p) return <Modal title="Player">Loading…</Modal>;
  const t = p.totals;
  const status = doing(userId);
  const today = p.daily.at(-1)?.tokens ?? 0;
  const next = nextMilestone(p.level);
  const title = milestoneTitle(p.level);
  // The item packs' rewards come between milestones: show the next one if it's sooner.
  const reward = sortBy(
    ITEMS.filter((i) => i.level !== undefined && i.level > p.level && i.level < (next?.level ?? Infinity)),
    "level",
  )[0];
  const mine = userId === world.selfId;
  // What the next levels bring, on hover of the "Lv7 in …" line.
  const rewardText = reward ? `Reward at Lv${reward.level}: ${reward.name}` : "";
  const milestoneLine = next ? `Lv${next.level} milestone: ${milestoneText(next)}` : "";
  const visit = () => {
    hud.set({ panel: null });
    world.portalPending = true;
    send(conn.visit(userId));
  };
  return (
    <Modal
      title={
        <>
          {p.name}
          {status && <span className="status small"> {status}</span>}
        </>
      }
    >
      <Pills value={tab} options={TABS} onChange={setTab} />
      {tab === "profile" ? (
        <>
          <div className="card-head">
            <AvatarImage look={p.look} scale={5} aura={p.level >= LEGENDARY_LEVEL} />
            <div className="card-who">
              {title && (
                <p className={`milestone-title${p.level >= LEGENDARY_LEVEL ? " legendary" : ""}`}>
                  🏅 {title}
                </p>
              )}
              <p>
                <strong>Level {p.level}</strong> · {p.levelTitle}
                {today > 0 && <span className="xp-today small"> · +{compact(today)} today</span>}
              </p>
              <XpBar level={p.level} tokens={p.lifetimeTokens} today={today} />
              <p
                className="muted small"
                title={[rewardText, milestoneLine].filter(Boolean).join("\n") || undefined}
              >
                {p.level >= MAX_LEVEL
                  ? "Max level"
                  : `Lv${p.level + 1} in ${compact(levelAt(p.level + 1) - p.lifetimeTokens)} tokens`}
                {(rewardText || milestoneLine) && " ⓘ"}
              </p>
              <p className="small">
                {p.company ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => hud.set({ panel: { kind: "companyCard", companyId: p.company!.id } })}
                  >
                    🏢 {p.company.name}
                  </button>
                ) : (
                  <span className="muted">Freelancer</span>
                )}
                <span className="muted"> · {compact(p.lifetimeTokens)} tokens all time</span>
              </p>
              {(p.since || (!status && p.lastActive)) && (
                <p className="muted small">
                  {p.since && <>Regular since {dayText(p.since, { month: "short", year: "numeric" })}</>}
                  {p.since && !status && p.lastActive && " · "}
                  {!status && p.lastActive && (
                    <>last active {daysAgoText(p.lastActive, dayKey(Date.now()))}</>
                  )}
                </p>
              )}
            </div>
          </div>
          <Bio userId={userId} bio={p.bio ?? null} mine={mine} />
          {p.badges.length > 0 && (
            <ul className="badges">
              {p.badges.map((b) => (
                <li
                  key={b.id}
                  className={`badge badge--${b.frame}`}
                  title={
                    b.next
                      ? `${b.next.label} next (${compact(b.value)} of ${compact(b.next.at)})`
                      : "Top tier"
                  }
                >
                  {b.emoji} {b.label}
                  {b.next && (
                    <span className="badge-bar" aria-hidden="true">
                      <i style={{ width: `${progressOf(b) * 100}%` }} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Tickets tickets={p.tickets} />
          {picking ? (
            <ShelfPicker
              current={shelf ?? p.showcase ?? []}
              onSaved={(pins) => {
                setShelf(pins);
                setPicking(false);
              }}
              onCancel={() => setPicking(false)}
            />
          ) : (
            <Shelf pins={shelf ?? p.showcase ?? []} mine={mine} onEdit={() => setPicking(true)} />
          )}
          <p className="company-actions">
            {p.office && (
              <button type="button" onClick={visit}>
                🚪 {mine ? "My office" : "Visit office"}
              </button>
            )}
            {mine && p.badges.length > 0 && (
              <button type="button" onClick={() => hud.set({ panel: { kind: "collection" } })}>
                📖 Collection
              </button>
            )}
            {!mine && (
              <>
                <button
                  type="button"
                  onClick={() => hud.set({ panel: { kind: "newTable", invite: userId, inviteName: p.name } })}
                >
                  🎮 Invite to a game
                </button>
                <button type="button" onClick={() => hud.set({ panel: { kind: "trade", userId } })}>
                  🔁 Trade
                </button>
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <Pills value={range} options={RANGES} onChange={setRange} />
          <StatsGrid totals={t} />
          {p.models.length > 0 && (
            <p className="muted small">
              Top models:{" "}
              {p.models
                .slice(0, 3)
                .map((m) => m.model)
                .join(", ")}
            </p>
          )}
          {p.games && (
            <p className="muted small">
              🎮 {plural(p.games.played, "game")} · {Math.round((p.games.wins / p.games.played) * 100)}% won ·{" "}
              {p.games.net >= 0 ? "+" : "−"}🪙 {Math.abs(p.games.net)}
              {p.games.biggestPot > 0 && ` · biggest pot 🪙 ${p.games.biggestPot}`}
            </p>
          )}
          <HowYouWork p={p} />
          {mine && <Computers />}
        </>
      )}
    </Modal>
  );
}

/** The line under the name: their words, with Edit on my own card and Report on someone else's. */
function Bio({ userId, bio, mine }: { userId: number; bio: string | null; mine: boolean }) {
  const [text, setText] = useState(bio);
  const [draft, setDraft] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const { error, busy, run } = useRun();
  const save = run(async () => {
    setText(await town.setBio(draft ?? ""));
    setDraft(null);
  });
  const report = run(async () => {
    await town.reportBio(userId);
    setSaid("Thanks, an admin will take a look.");
  });
  if (draft !== null)
    return (
      <form className="bio-edit" onSubmit={save}>
        <textarea
          rows={2}
          value={draft}
          maxLength={BIO_MAX_LENGTH}
          placeholder="One line about you. No links."
          aria-label="Your bio"
          // biome-ignore lint/a11y/noAutofocus: opened by pressing Edit
          autoFocus
          onChange={(e) => setDraft(e.target.value.replace(/\s*\n\s*/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <span className="muted small count">
          {[...draft].length}/{BIO_MAX_LENGTH}
        </span>
        <button type="submit" disabled={busy}>
          Save
        </button>
        <button type="button" onClick={() => setDraft(null)}>
          Cancel
        </button>
        {error && <span className="error small">{error}</span>}
      </form>
    );
  return (
    <p className="bio">
      {text && <span className="muted">{text}</span>}{" "}
      {mine && (
        <button type="button" className="link small" onClick={() => setDraft(text ?? "")}>
          {text ? "✏️ Edit" : "✏️ Add a bio"}
        </button>
      )}
      {!mine && text && !said && (
        <button type="button" className="link small" onClick={report} disabled={busy}>
          Report
        </button>
      )}
      {(said || error) && <span className={`small ${error ? "error" : "muted"}`}> {said ?? error}</span>}
    </p>
  );
}

/** The last 30 days of how they work: when, with how many agents, through what, and the type that makes. */
function HowYouWork({ p }: { p: Profile }) {
  const h = p.habits;
  if (!h) return null;
  const when = workHours(h.hours);
  const peak = Math.max(1, ...h.hours);
  return (
    <section className="how" aria-label="How they work">
      <h3>How they work</h3>
      {p.agentType && (
        <p>
          <strong>{p.agentType.label}</strong> <span className="muted small">{p.agentType.blurb}</span>
        </p>
      )}
      {when && (
        <p className="hours">
          <svg viewBox="0 0 48 12" role="img" aria-label={`Active hours of the day: ${when.label}`}>
            {h.hours.map((n, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the hour is the identity
              <rect key={i} x={i * 2} y={12 - (n / peak) * 11} width={1.5} height={(n / peak) * 11 + 0.5}>
                <title>{String(i).padStart(2, "0")}:00</title>
              </rect>
            ))}
          </svg>
          <span className="chip">{when.label}</span>
        </p>
      )}
      <p className="muted small">
        {h.parallelism !== null && (
          <>
            {h.parallelism.toFixed(1)}× agents at once · peak {h.peakAgents}
          </>
        )}
        {h.subShare > 0 && <> · {Math.round(h.subShare * 100)}% subagents</>}
        {h.turnsPerPrompt !== null && <> · {Math.round(h.turnsPerPrompt)} turns a prompt</>}
        {h.sessions > 0 && <> · {plural(h.sessions, "session")}</>}
      </p>
      <p className="small">
        {h.cacheHit !== null && <span className="muted">{Math.round(h.cacheHit * 100)}% cache hits </span>}
        {h.sources.map((src) => (
          <span key={src.source} className="chip" title={`${Math.round(src.share * 100)}% of tokens`}>
            {sourceName(src.source)} {Math.round(src.share * 100)}%
          </span>
        ))}
      </p>
    </section>
  );
}

/** Progress through the current level: earlier tokens, then today's. Full at the top level. */
function XpBar({ level, tokens, today }: { level: number; tokens: number; today: number }) {
  const max = level >= MAX_LEVEL;
  const start = levelAt(level);
  const span = levelAt(level + 1) - start;
  // Today's tokens that count toward this level: all of the progress if today crossed into it.
  const before = Math.max(0, tokens - today - start);
  const gained = tokens - start - before;
  return (
    <div className="xp" aria-hidden="true">
      <span className="xp-done" style={{ width: max ? "100%" : `${(before / span) * 100}%` }} />
      <span className="xp-gain" style={{ width: max ? 0 : `${(gained / span) * 100}%` }} />
    </div>
  );
}

/** The numbers both cards show, for the chosen range. */
export function StatsGrid({ totals: t }: { totals: Profile["totals"] }) {
  return (
    <dl className="stats">
      <div>
        <dt>Tokens</dt>
        <dd>{compact(t.tokens)}</dd>
      </div>
      <div>
        <dt>Agent hours</dt>
        <dd>{hoursText(t.activeHours)}</dd>
      </div>
      <div>
        <dt>Parallel</dt>
        <dd>{t.parallelism === null ? "–" : `${t.parallelism.toFixed(1)}×`}</dd>
      </div>
      <div>
        <dt>Peak agents</dt>
        <dd>{t.peakAgents}</dd>
      </div>
      <div>
        <dt>Per active hour</dt>
        <dd>{t.tokensPerActiveHour === null ? "–" : compact(t.tokensPerActiveHour)}</dd>
      </div>
      <div>
        <dt>PRs</dt>
        <dd>{t.prs}</dd>
      </div>
      <div className="muted-stat">
        <dt>Cost</dt>
        <dd>{usd(t.costUsd)}</dd>
      </div>
    </dl>
  );
}

/** Tokens per day, the last 30 days. */
export function DailyChart({ daily }: { daily: Profile["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.tokens));
  return (
    <figure className="chart">
      <svg
        viewBox="0 0 300 60"
        preserveAspectRatio="none"
        role="img"
        aria-label="Tokens per day, last 30 days"
      >
        {daily.map((d, i) => {
          const h = (d.tokens / max) * 56;
          return (
            <rect key={d.day} x={i * 10 + 1} y={60 - h} width={8} height={Math.max(h, d.tokens ? 1 : 0)}>
              <title>
                {d.day}: {compact(d.tokens)} tokens, {usd(d.costUsd)}
              </title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="muted small">Last 30 days</figcaption>
    </figure>
  );
}
