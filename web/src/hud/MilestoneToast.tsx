import { levelTitle } from "@tokenmaxxing/core/format.ts";
import {
  LEGENDARY_LEVEL,
  type Milestone,
  milestoneItems,
  milestoneText,
} from "@tokenmaxxing/core/milestones.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { useHud } from "../store.ts";
import { ItemImage } from "./Shop.tsx";
import { AvatarImage } from "./ui.tsx";

/** `look` with the milestone's items put on. */
const wearing = (look: Look, m: Milestone): Look => ({
  ...look,
  ...Object.fromEntries(
    milestoneItems(m).flatMap((i) => (i.slot === "furniture" ? [] : [[i.slot, i.index]])),
  ),
});

/**
 * The level toast when the climb passed a milestone (the last, if a big sync passed two): gold,
 * with what it gave drawn out, and at the legendary level, me in my new aura.
 */
export function MilestoneToast({
  milestone: m,
  level,
  office,
  onClick,
}: {
  milestone: Milestone;
  level: number;
  /** The office line from the level-10 toast. */
  office: string | null;
  onClick: () => void;
}) {
  const look = useHud((s) => s.me?.look);
  const legendary = m.level >= LEGENDARY_LEVEL;
  return (
    <button
      type="button"
      className={`toast milestone-toast${legendary ? " legendary" : ""}`}
      onClick={onClick}
    >
      <span className="milestone-art">
        {/* What it gave, on me: at the legendary level, in the regalia and the aura. */}
        {look &&
          (legendary ? (
            <AvatarImage look={wearing(look, m)} scale={3} aura />
          ) : (
            milestoneItems(m).map((i) => <ItemImage key={i.id} item={i} look={look} />)
          ))}
      </span>
      <span>
        <strong>
          🏆 Level {level} · {levelTitle(level)}
        </strong>
        <br />
        <span className="milestone-name">
          {legendary ? "Legendary milestone" : `Level ${m.level} milestone`}
        </span>
        <br />
        <span className="small">You got the {milestoneText(m)}</span>
        {office && <span className="small"> · {office}</span>}
      </span>
    </button>
  );
}
