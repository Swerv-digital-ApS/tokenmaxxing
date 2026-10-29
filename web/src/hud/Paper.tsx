import { addDays } from "@tokenmaxxing/core/range.ts";
import { town } from "../net.ts";
import { dayText } from "./format.ts";
import { Modal, useLoad } from "./ui.tsx";

/** E on a paper by a door: today's front page, about yesterday in town. */
export function PaperPanel() {
  const { data: paper, error } = useLoad(() => town.paper(), []);
  if (!paper) return <Modal title="📰 The morning paper">{error ?? "Unfolding…"}</Modal>;
  const [lead, ...rest] = paper.headlines;
  return (
    <Modal title="📰 The morning paper" wide>
      <article className="paper">
        <header className="paper-mast">
          <h3>Token Tidende</h3>
          <p>
            <span>
              {dayText(addDays(paper.day, 1), {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>Yesterday in town</span>
            <span>Free, like the coffee</span>
          </p>
        </header>
        {lead && (
          <section className="paper-lead">
            <h4>{lead.title}</h4>
            <p>{lead.deck}</p>
          </section>
        )}
        <div className="paper-cols">
          {rest.map((h) => (
            <section key={h.title}>
              <h5>{h.title}</h5>
              <p>{h.deck}</p>
            </section>
          ))}
        </div>
      </article>
    </Modal>
  );
}
