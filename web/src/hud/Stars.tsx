import { milestoneOf, nextMilestone, REPO_URL } from "@tokenmaxxing/core/stars.ts";
import { starCount } from "../game/stars.ts";
import { useHud } from "../store.ts";
import { Modal } from "./ui.tsx";

/**
 * The way to star the repo. A plain link, so the browser opens it in a new tab and the desktop app hands
 * it to the system browser (`main.tsx`).
 */
export function StarButton() {
  const count = useHud((s) => s.stars.count);
  return (
    <a className="star-button" href={REPO_URL} target="_blank" rel="noreferrer">
      ⭐ Star on GitHub
      {count !== null && <span className="star-button-count">{starCount(count)}</span>}
    </a>
  );
}

/** The star counter on the square (E in front of it): the count, the next milestone, and the button. */
export function StarsPanel() {
  const count = useHud((s) => s.stars.count);
  const from = count === null ? 0 : milestoneOf(count);
  const next = nextMilestone(count ?? 0);
  return (
    <Modal title="⭐ Star counter">
      <div className="stars">
        <p className="stars-count">{starCount(count)}</p>
        <p className="muted">{count === null ? "Counting the stars…" : "stars on GitHub"}</p>
        {count !== null && (
          <div className="stars-next">
            <span className="co-progress">
              <span style={{ width: `${((count - from) / (next - from)) * 100}%` }} />
            </span>
            <span className="muted small">
              {(next - count).toLocaleString("en-US")} to go to {next.toLocaleString("en-US")}: the town sets
              off fireworks over the square at every milestone.
            </span>
          </div>
        )}
        <StarButton />
        <p className="muted small">Like the town? A star helps other people find it.</p>
      </div>
    </Modal>
  );
}
