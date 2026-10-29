import { greenBanner } from "@tokenmaxxing/core/grid.ts";
import { useGrid } from "../game/grid.ts";
import { useHud } from "../store.ts";

/** While the grid is green: a banner at the top, and what today's green hours have paid so far. */
export function GreenBanner() {
  const banner = greenBanner(useGrid());
  const paid = useHud((s) => s.wallet?.green ?? 0);
  if (!banner) return null;
  return (
    <div className="green-banner" role="status">
      <strong>{banner.title}</strong>
      <span className="muted small">
        {banner.line}
        {paid > 0 && ` 🪙 ${paid} so far today.`}
      </span>
    </div>
  );
}
