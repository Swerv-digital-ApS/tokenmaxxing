import { pamphletOf } from "@tokenmaxxing/core/launch.ts";
import type { CSSProperties } from "react";
import { currentLaunches } from "../game/launch.ts";
import { Modal } from "./ui.tsx";

/**
 * What the stand's presenter hands you: one provider's news on a flyer in its colour, or, when several
 * providers have something out, a rainbow launch-day newsletter with all of them.
 */
export function PamphletPanel() {
  const up = currentLaunches();
  if (up.length === 0)
    return <Modal title="📣 Pamphlet">The stand has packed up. Check back when something ships.</Modal>;
  const { title, kicker, rainbow, entries, foot } = pamphletOf(up);
  return (
    <Modal title={title}>
      <article
        className={rainbow ? "pamphlet rainbow" : "pamphlet"}
        style={{ "--accent": entries[0]!.accent } as CSSProperties}
      >
        <p className="pamphlet-kicker">{kicker}</p>
        {entries.map((e) => (
          <section key={e.headline} style={{ "--accent": e.accent } as CSSProperties}>
            <h3>{e.headline}</h3>
            <p className="pamphlet-body">{e.body}</p>
            <ul className="pamphlet-models">
              {e.models.map((m) => (
                <li key={m.name}>
                  <span className="pamphlet-model">
                    {m.name}
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noreferrer">
                        OpenRouter ↗
                      </a>
                    )}
                  </span>
                  {m.price && <span className="pamphlet-price">{m.price}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="pamphlet-foot">{foot}</p>
      </article>
    </Modal>
  );
}
