import { compact, hoursText, plural, usd } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import type {
  Leaderboard as Board,
  BoardCompany,
  BoardPlayer,
  GamePlayer,
} from "@tokenmaxxing/server/registry";
import { typedSwitch } from "hanzio";
import { type ReactNode, useEffect, useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ranges } from "./format.ts";
import { AvatarImage, House, Modal, Pills, useLoad } from "./ui.tsx";

type Sort = Board["sort"];
type Totals = BoardPlayer | BoardCompany;

const RANGES = ranges("All time");
const SORTS = [
  ["tokens", "Tokens"],
  ["cost", "Cost"],
  ["hours", "Agent hours"],
  ["parallelism", "Parallel"],
  ["prs", "PRs"],
] as const;
const EMPTY: Record<RangeKey, string> = {
  today: "today",
  "7d": "this week",
  "30d": "this month",
  all: "yet",
};

/** Per sort: the number ranked by (for bars), how it shows, and a second number for context. */
const BY: Record<
  Sort,
  { value: (t: Totals) => number; show: (t: Totals) => string; aside: (t: Totals) => string }
> = {
  tokens: { value: (t) => t.tokens, show: (t) => compact(t.tokens), aside: (t) => usd(t.costUsd) },
  cost: { value: (t) => t.costUsd, show: (t) => usd(t.costUsd), aside: (t) => compact(t.tokens) },
  hours: {
    value: (t) => t.activeHours,
    show: (t) => hoursText(t.activeHours),
    aside: (t) => compact(t.tokens),
  },
  parallelism: {
    value: (t) => t.parallelism ?? 0,
    show: (t) => (t.parallelism === null ? "–" : `${t.parallelism.toFixed(1)}×`),
    aside: (t) => `peak ${t.peakAgents}`,
  },
  prs: { value: (t) => t.prs, show: (t) => plural(t.prs, "PR"), aside: (t) => compact(t.tokens) },
};

const members = (n: number) => plural(n, "member");

const openCard = (userId: number) => hud.set({ panel: { kind: "card", userId } });
const openCompany = (companyId: number) => hud.set({ panel: { kind: "companyCard", companyId } });

export function Leaderboard() {
  const me = useHud((s) => s.me?.userId);
  const [range, setRange] = useState<RangeKey>("today");
  const [sort, setSort] = useState<Sort>("tokens");
  const [tab, setTab] = useState<"players" | "companies" | "games">("players");
  const [board, setBoard] = useState<Board | null>(null);
  const games = tab === "games";

  // The games tab has a board of its own.
  useEffect(() => {
    if (games) return;
    let live = true;
    const load = () => town.leaderboard(range, sort).then((b) => live && setBoard(b));
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [range, sort, games]);

  const players = board?.players ?? [];
  const by = BY[sort];
  const companies = (board?.companies ?? []).filter((c) => by.value(c) > 0);
  const rows: Totals[] = tab === "players" ? players : companies;
  const top = rows[0] ? by.value(rows[0]) : 0;

  return (
    <Modal title="🏆 Leaderboard" wide>
      <div className="lb-controls">
        <Pills
          value={tab}
          options={[
            ["players", "Players"],
            ["companies", "Companies"],
            ["games", "🎮 Games"],
          ]}
          onChange={setTab}
        />
        <Pills value={range} options={RANGES} onChange={setRange} />
      </div>
      {games ? (
        <GamesBoard range={range} me={me} />
      ) : (
        <>
          <div className="lb-sort">
            <span className="muted small">Ranked by</span>
            <Pills value={sort} options={SORTS} onChange={setSort} />
          </div>
          {!board ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 || top === 0 ? (
            <p className="lb-empty">
              {tab === "players" ? "Nobody has run an agent" : "No company has anything to show"}{" "}
              {EMPTY[range]}.
              <br />
              <span className="muted small">Start an agent and take the top spot 🚀</span>
            </p>
          ) : (
            <>
              <Podium>
                {rows.slice(0, 3).map((r, i) => (
                  <Step
                    key={key(r)}
                    place={i + 1}
                    onClick={"userId" in r ? () => openCard(r.userId) : () => openCompany(r.companyId)}
                  >
                    {"userId" in r ? (
                      <AvatarImage look={r.look} scale={i === 0 ? 5 : 4} />
                    ) : (
                      <House companyId={r.companyId} tier={r.tier} scale={i === 0 ? 1 : 0.75} />
                    )}
                    <strong className="lb-name">{r.name}</strong>
                    <span className="lb-sub">
                      {"userId" in r ? (r.company ?? `Lv${r.level}`) : members(r.members)}
                    </span>
                    <span className="lb-value">{by.show(r)}</span>
                  </Step>
                ))}
              </Podium>
              {rows.length > 3 && (
                <ol className="lb-list">
                  {rows.slice(3).map((r) => (
                    <BoardRow
                      key={key(r)}
                      rank={r.rank}
                      picture={
                        "userId" in r ? (
                          <AvatarImage look={r.look} scale={2} />
                        ) : (
                          <House companyId={r.companyId} tier={r.tier} scale={0.3} />
                        )
                      }
                      name={r.name}
                      sub={
                        "userId" in r
                          ? `Lv${r.level}${r.company ? ` · ${r.company}` : ""}`
                          : `${members(r.members)} · ${houseTierName(r.tier)}`
                      }
                      share={top > 0 ? Math.max(0.02, by.value(r) / top) : 0}
                      value={by.show(r)}
                      aside={by.aside(r)}
                      mine={"userId" in r && r.userId === me}
                      onClick={"userId" in r ? () => openCard(r.userId) : () => openCompany(r.companyId)}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

const GAME_SORTS = [
  ["net", "Coins won"],
  ["rate", "Win rate"],
  ["pot", "Biggest pot"],
] as const;
type GameSort = (typeof GAME_SORTS)[number][0];
/** Win rates only count from this many games, so one lucky win doesn't top the board. */
const MIN_GAMES = 10;

const gameValue = (sort: GameSort, p: GamePlayer) =>
  typedSwitch(sort, {
    net: () => p.net,
    rate: () => p.wins / p.played,
    pot: () => p.biggestPot,
  });
const gameShown = (sort: GameSort, p: GamePlayer) =>
  sort === "rate" ? `${Math.round((p.wins / p.played) * 100)}%` : `🪙 ${gameValue(sort, p)}`;

/** Who's best at the arcade: most coins won, best win rate, biggest pots. */
function GamesBoard({ range, me }: { range: RangeKey; me: number | undefined }) {
  const [sort, setSort] = useState<GameSort>("net");
  const { data: all } = useLoad(() => town.gameBoard(range), [range]);
  const rows = (all ?? [])
    .filter((p) => (sort === "rate" ? p.played >= MIN_GAMES : gameValue(sort, p) > 0))
    .sort((a, b) => gameValue(sort, b) - gameValue(sort, a) || b.played - a.played)
    .slice(0, 100);
  const top = rows[0] ? gameValue(sort, rows[0]) : 0;
  return (
    <>
      <div className="lb-sort">
        <span className="muted small">Ranked by</span>
        <Pills value={sort} options={GAME_SORTS} onChange={setSort} />
      </div>
      {!all ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="lb-empty">
          {sort === "rate" ? `Nobody has played ${MIN_GAMES} games` : "Nobody has won a game"} {EMPTY[range]}.
          <br />
          <span className="muted small">Open a table in the 🎮 arcade 🎲</span>
        </p>
      ) : (
        <>
          <Podium>
            {rows.slice(0, 3).map((r, i) => (
              <Step key={r.userId} place={i + 1} onClick={() => openCard(r.userId)}>
                <AvatarImage look={r.look} scale={i === 0 ? 5 : 4} />
                <strong className="lb-name">{r.name}</strong>
                <span className="lb-sub">
                  {r.wins}/{r.played} won
                </span>
                <span className="lb-value">{gameShown(sort, r)}</span>
              </Step>
            ))}
          </Podium>
          {rows.length > 3 && (
            <ol className="lb-list">
              {rows.slice(3).map((r, i) => (
                <BoardRow
                  key={r.userId}
                  rank={i + 4}
                  picture={<AvatarImage look={r.look} scale={2} />}
                  name={r.name}
                  sub={`${r.wins}/${r.played} won`}
                  share={Math.max(0.02, gameValue(sort, r) / top)}
                  value={gameShown(sort, r)}
                  mine={r.userId === me}
                  onClick={() => openCard(r.userId)}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}

const key = (r: Totals) => ("userId" in r ? `p${r.userId}` : `c${r.companyId}`);

function Podium({ children }: { children: ReactNode[] }) {
  // Second, first, third: the winner stands in the middle.
  const [first, second, third] = children;
  return (
    <div className="podium">
      {second ?? <div className="step empty" />}
      {first}
      {third ?? <div className="step empty" />}
    </div>
  );
}

function Step({ place, onClick, children }: { place: number; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`step p${place}`} onClick={onClick}>
      {place === 1 && <span className="crown">👑</span>}
      {children}
      <span className="pedestal">{place}</span>
    </button>
  );
}

/**
 * A row under the podium (and a company's people): who, a line under the name, a bar for `share` of
 * the top, and the number. Without a `rank`, the order says it.
 */
export function BoardRow({
  rank,
  picture,
  name,
  sub,
  share,
  value,
  aside,
  mine,
  onClick,
}: {
  rank?: number;
  picture: ReactNode;
  name: ReactNode;
  sub: string;
  share: number;
  value: string;
  aside?: string;
  mine?: boolean;
  onClick: () => void;
}) {
  return (
    <li className={mine ? "mine" : undefined}>
      <button type="button" className="lb-item" onClick={onClick}>
        {rank !== undefined && <span className="lb-rank">{rank}</span>}
        {picture}
        <span className="lb-who">
          <span className="lb-line">
            <strong>{name}</strong>
            <small className="muted">{sub}</small>
          </span>
          <span className="lb-bar">
            <span style={{ width: `${share * 100}%` }} />
          </span>
        </span>
        <span className="lb-values">
          <span className="lb-value">{value}</span>
          {aside !== undefined && <small className="muted">{aside}</small>}
        </span>
      </button>
    </li>
  );
}
