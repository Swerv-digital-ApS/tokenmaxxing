import { hoursText } from "@tokenmaxxing/core/format.ts";
import { REGULAR_MIN } from "@tokenmaxxing/core/regulars.ts";
import { world } from "../game/world.ts";
import { town } from "../net.ts";
import { Modal, RankList, useLoad } from "./ui.tsx";

/** The brass plaques by the hearth: this week's five who spent the most time in the Tavern, and my own minutes. */
export function Regulars() {
  const { data, error } = useLoad(() => town.regulars(), []);
  const title = "🪪 The regulars";
  if (!data) return <Modal title={title}>{error ?? "Loading…"}</Modal>;
  const mine = data.top.some((r) => r.userId === world.selfId);
  return (
    <Modal title={title}>
      <p className="muted">
        The week's most time at the Tavern, its basement too. Awake and about, not asleep at a stool. Starts
        over every Monday; {REGULAR_MIN} minutes to make the wall.
      </p>
      {data.top.length === 0 ? (
        <p>Nobody on the wall yet this week. Pull up a stool.</p>
      ) : (
        <div className="miniboard regulars">
          <RankList
            rows={data.top.map((r) => ({
              id: r.userId,
              rank: String(r.rank),
              who: r.userId === data.last?.userId ? `♛ ${r.name}` : r.name,
              value: hoursText(r.minutes / 60),
              mine: r.userId === world.selfId,
              open: { kind: "card", userId: r.userId },
            }))}
          />
        </div>
      )}
      {data.last && <p className="muted small">♛ {data.last.name} had the most time last week.</p>}
      {!mine && (
        <p className="muted small">
          {data.me
            ? `You: ${hoursText(data.me.minutes / 60)} so far this week.`
            : "You haven't spent time here this week."}
        </p>
      )}
    </Modal>
  );
}
