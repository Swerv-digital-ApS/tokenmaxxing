import { bannerFor } from "@tokenmaxxing/core/picnic.ts";
import { useOutage } from "../game/picnic.ts";

/** While an AI API is down: a banner over everything, pointing at the blankets. */
export function PicnicBanner() {
  const outage = useOutage();
  if (!outage) return null;
  return (
    <div className="picnic-banner" role="status">
      <strong>🧺 {bannerFor(outage)}</strong>
      <span className="muted small">Sit on a blanket by the square for a badge.</span>
    </div>
  );
}
