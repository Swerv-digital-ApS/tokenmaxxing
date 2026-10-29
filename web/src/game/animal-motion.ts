/** Shared by the pixel and voxel pigeons. Every sample reuses the same pose. */
export interface PigeonPose {
  offset: number;
  lift: number;
  wing: number;
  peck: number;
  returning: boolean;
}

const OUT_MS = 700;
const BACK_MS = 950;
const ease = (t: number): number => t * t * (3 - 2 * t);

/** A startled pigeon flutters aside, lands, then hops home once the passer-by has left. */
export class PigeonMotion {
  private started = -Infinity;
  private returnAt = -Infinity;
  private readonly pose: PigeonPose = { offset: 0, lift: 0, wing: 0, peck: 0, returning: false };

  scare(now: number): void {
    if (now >= this.returnAt + BACK_MS) {
      this.started = now;
      this.returnAt = now + OUT_MS + 900;
    } else if (now < this.returnAt) {
      // A nearby player keeps it on the ground away from its home tile, never hovering.
      this.returnAt = Math.max(this.returnAt, now + 900);
    }
  }

  sample(now: number, nearby = false, phase = 0): PigeonPose {
    if (nearby) this.scare(now);
    const p = this.pose;
    p.offset = p.lift = p.wing = p.peck = 0;
    p.returning = false;
    let flight = -1;
    if (now < this.started + OUT_MS) {
      flight = Math.max(0, (now - this.started) / OUT_MS);
      p.offset = ease(flight);
    } else if (now < this.returnAt) {
      p.offset = 1;
    } else if (now < this.returnAt + BACK_MS) {
      flight = (now - this.returnAt) / BACK_MS;
      p.offset = 1 - ease(flight);
      p.returning = true;
    }
    if (flight >= 0) {
      const arc = Math.sin(Math.PI * flight);
      p.lift = arc * 0.8;
      p.wing = arc * (0.65 + Math.sin((now - this.started) * 0.035) * 0.6);
    } else {
      const peck = Math.max(0, Math.sin(now / 650 + phase * 2.3));
      p.peck = peck ** 8;
    }
    return p;
  }
}
