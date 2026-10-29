import { TROPHIES } from "@tokenmaxxing/core/trophies.ts";
import { TROPHY_H, TROPHY_W, trophySprite } from "../art/trophies.ts";
import { loadTrophies } from "../game/trophies.ts";
import { dayText } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { Modal, Pixels, useLoad } from "./ui.tsx";

const SCALE = 4;

/** The shelf up close: every trophy, earned ones with the day they came, the rest with how to get them. */
export function Trophies({ userId, name }: { userId: number; name: string }) {
  const { data: trophies, error } = useLoad(() => loadTrophies(userId), [userId]);
  const title = `🏆 ${name}'s trophies`;
  if (!trophies) return <Modal title={title}>{error ?? "Loading…"}</Modal>;
  const earned = new Map(trophies.map((t) => [t.id, t.day]));
  return (
    <Modal title={title} wide>
      <p className="muted">
        {earned.size} of {TROPHIES.length}. Each badge tier and trophy pays coins, once.
      </p>
      <ul className="trophies">
        {TROPHIES.map((t) => {
          const day = earned.get(t.id);
          return (
            <li key={t.id} className={day ? "" : "unearned"}>
              <ItemIcon
                spec={{ kind: "trophy", id: t.id, earned: day !== undefined }}
                size={TROPHY_H * SCALE}
              >
                <Pixels
                  sprite={trophySprite(t.id, day !== undefined)}
                  width={TROPHY_W * SCALE}
                  height={TROPHY_H * SCALE}
                />
              </ItemIcon>
              <span>
                <strong>{t.name}</strong>
                <span className="muted small">{t.how}</span>
                {day && (
                  <span className="small earned">
                    Earned {dayText(day, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
