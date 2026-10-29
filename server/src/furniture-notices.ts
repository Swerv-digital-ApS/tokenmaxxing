const pieces = (k: number) => `${k} piece${k === 1 ? "" : "s"}`;

/** The line after putting a room's pieces away: how many went, and how many `town` could not write down. */
export function putAwayNotice(count: number, failed: number, toBag: boolean): string {
  if (count === 0) return failed === 0 ? "Nothing to put away here." : "That didn't work. Try again.";
  const left = failed > 0 ? `, ${failed} stayed where ${failed === 1 ? "it was" : "they were"}` : "";
  return `${toBag ? `Put away ${pieces(count)}` : `Put ${pieces(count)} in the storeroom`}${left}.`;
}

/** The line after putting out the storeroom: how many went down, and (when none did) why. */
export function placeAllNotice(placed: number, left: number, why?: string): string {
  if (placed === 0) return why ?? "Nothing to put out.";
  return left === 0 ? `Placed ${pieces(placed)}.` : `Placed ${placed}, no room for ${left}.`;
}
