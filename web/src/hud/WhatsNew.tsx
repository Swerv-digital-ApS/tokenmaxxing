import { Fragment, useEffect, useState } from "react";
import { type Release, releases, unseenReleases } from "../changelog.ts";
import { storage } from "../storage.ts";
import { FIRST_VISIT_KEY, hud, useHud } from "../store.ts";
import { StarButton } from "./Stars.tsx";
import { Modal } from "./ui.tsx";

const SEEN_KEY = "tokenmaxxing.seenVersion";
const SECTION_ICONS: Record<string, string> = { Features: "✨", "Bug Fixes": "🐛" };

const changes = (rs: Release[], section: string) =>
  rs.flatMap((r) => r.sections.filter((s) => s.title === section)).reduce((n, s) => n + s.changes.length, 0);

/** Top left after an update: what changed since last time. Gone after 10 s (paused on hover) unless opened. */
export function WhatsNewToast() {
  const ready = useHud((s) => s.status === "ready");
  // On the first render, before FirstVisit marks this visit as having been in town.
  const [fresh] = useState(() =>
    unseenReleases(releases, storage.getItem(SEEN_KEY), storage.getItem(FIRST_VISIT_KEY) !== null),
  );
  const [view, setView] = useState<"peek" | "open" | "closed">("peek");
  useEffect(() => {
    const latest = releases[0];
    if (ready && latest) storage.setItem(SEEN_KEY, latest.version);
  }, [ready]);
  const [newest] = fresh;
  if (!ready || !newest || view === "closed") return null;
  const open = view === "open";
  const features = changes(fresh, "Features");
  const fixes = changes(fresh, "Bug Fixes");
  const summary = [
    features > 0 && `${features} new feature${features === 1 ? "" : "s"}`,
    fixes > 0 && `${fixes} fix${fixes === 1 ? "" : "es"}`,
  ].filter(Boolean);
  return (
    <section className="panel whats-new" aria-label="What's new">
      <header>
        <button
          type="button"
          className="whats-new-head"
          aria-expanded={open}
          onClick={() => setView(open ? "peek" : "open")}
        >
          <strong>⬆ Updated to v{newest.version}</strong>
          <span className="muted small">
            {[...summary, open ? "less ▴" : "see what's new ▾"].join(" · ")}
          </span>
        </button>
        <button type="button" className="icon" aria-label="Dismiss" onClick={() => setView("closed")}>
          ✕
        </button>
      </header>
      {open ? (
        <div className="whats-new-body">
          <ReleaseNotes releases={fresh} />
          <button
            type="button"
            className="link"
            onClick={() => {
              setView("closed");
              hud.set({ panel: { kind: "changelog" } });
            }}
          >
            Full changelog
          </button>
        </div>
      ) : (
        <div className="whats-new-timer" onAnimationEnd={() => setView("closed")} />
      )}
    </section>
  );
}

/** Every release, from the menu. */
export function ChangelogPanel() {
  return (
    <Modal title="📜 Changelog" wide>
      <p className="changelog-star">
        Enjoying what's new? <StarButton />
      </p>
      <div className="changelog">
        <ReleaseNotes releases={releases} />
      </div>
    </Modal>
  );
}

const day = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function ReleaseNotes({ releases }: { releases: Release[] }) {
  return releases.map((r) => (
    <article key={r.version} className="release">
      <h3>
        v{r.version} <span className="muted">{day(r.date)}</span>
      </h3>
      {r.sections.map((s) => (
        <Fragment key={s.title}>
          <h4>{[SECTION_ICONS[s.title], s.title].filter(Boolean).join(" ")}</h4>
          <ul>
            {s.changes.map((c) => (
              <li key={`${c.scope}:${c.text}`}>
                {c.scope && <span className="scope">{c.scope}</span>}
                {c.text}
                {c.authors.length > 0 && (
                  <span className="muted">
                    {" by "}
                    {c.authors.map((a, i) => (
                      <Fragment key={a}>
                        {i > 0 && ", "}
                        <a href={`https://github.com/${a}`} target="_blank" rel="noreferrer">
                          @{a}
                        </a>
                      </Fragment>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </article>
  ));
}
