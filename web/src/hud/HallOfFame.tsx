import { BADGES, frameOf } from "@tokenmaxxing/core/badges.ts";
import { compact } from "@tokenmaxxing/core/format.ts";
import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import { POKER_GAME } from "@tokenmaxxing/core/poker.ts";
import { badgeFrame, FRAME_SIZE } from "../art/trophies.ts";
import { town } from "../net.ts";
import { hud } from "../store.ts";
import { dayText } from "./format.ts";
import { Modal, Pixels, useLoad } from "./ui.tsx";

const SIZE = FRAME_SIZE * 3;

/** A player's name, opening their card. */
function Who({ userId, name }: { userId: number; name: string }) {
  return (
    <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "card", userId } })}>
      {name}
    </button>
  );
}

const when = (at: number) =>
  dayText(new Date(at).toISOString().slice(0, 10), { day: "numeric", month: "short" });

/** The wall in the Tavern: the rarest honours, this week's firsts, and who won the week. Everyone by name. */
export function HallOfFame() {
  const { data: hall, error } = useLoad(() => town.hallOfFame(), []);
  const title = "🏆 Hall of Fame";
  if (!hall) return <Modal title={title}>{error ?? "Loading…"}</Modal>;
  return (
    <Modal title={title} wide>
      <p className="muted">
        Gold and diamond honours, and the week since Monday 08:00.{" "}
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "collection" } })}>
          📖 Your collection
        </button>
      </p>
      {!hall.ready ? (
        <p className="muted">The wall is being polished. Look again in a little while.</p>
      ) : (
        <>
          <h3>Rarest honours</h3>
          {hall.rarest.length === 0 && <p className="muted">Nobody has a gold yet.</p>}
          <ul className="hall">
            {hall.rarest.map((r) => {
              const def = BADGES.find((b) => b.id === r.badge);
              if (!def) return null;
              const frame = frameOf(r.tier, def.tiers.length);
              return (
                <li key={`${r.badge} ${r.tier}`}>
                  <span className="entry-icon">
                    <Pixels sprite={badgeFrame(frame)} width={SIZE} height={SIZE} />
                    <span className="entry-emoji">{def.emoji}</span>
                  </span>
                  <span>
                    <strong>
                      {def.name} {frame}: {def.tiers[r.tier - 1]!.label}
                    </strong>
                    <span className="muted small">
                      {r.holders} of {compact(r.of)} players
                    </span>
                    <span className="small">
                      {r.who.map((w, i) => (
                        <span key={w.userId}>
                          {i > 0 && ", "}
                          <Who userId={w.userId} name={w.name} />
                        </span>
                      ))}
                      {r.holders > r.who.length && ` and ${r.holders - r.who.length} more`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <h3>This week's firsts</h3>
          {hall.firsts.length === 0 && <p className="muted">Nothing new yet this week.</p>}
          <ul className="hall-lines">
            {hall.firsts.map((f) => (
              <li key={`${f.text} ${f.userId}`}>
                {f.text}: <Who userId={f.userId} name={f.name} />{" "}
                <span className="muted small">{when(f.at)}</span>
              </li>
            ))}
          </ul>
          <h3>Winners of the week</h3>
          {hall.winners.length === 0 && <p className="muted">Nobody has won anything yet.</p>}
          <ul className="hall-lines">
            {hall.winners.map((w) => (
              <li key={`${w.kind} ${w.game ?? ""}`}>
                {w.kind === "raid"
                  ? "⚔️ Raid, most damage"
                  : `🎮 ${w.game === POKER_GAME ? "Poker" : (GAMES[w.game as GameId]?.name ?? w.game)}, most coins won`}
                : <Who userId={w.userId} name={w.name} />{" "}
                <span className="muted small">{w.kind === "raid" ? compact(w.value) : `+🪙 ${w.value}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
