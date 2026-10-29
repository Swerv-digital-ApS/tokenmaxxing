/**
 * How far a wall moves towards its height (lowered in front of the camera, up elsewhere) on this tick: by the time
 * that passed, not by the frame. A slow frame then catches up instead of crawling, and a settle (a long `dt`, as the
 * batching probe's last tick and a room's first frame pass) puts every wall where it belongs at once, rather than
 * leaving them partway down from the probe's other directions to rise in view.
 */
export const wallEase = { k: 0.25 };

/** Sets `wallEase` for a tick `dt` seconds long. */
export function easeWalls(dt: number): void {
  wallEase.k = 1 - Math.exp(-dt * 14);
}
