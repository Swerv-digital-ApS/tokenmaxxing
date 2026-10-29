/** Schedules visible simulation and drawing without treating intentional idle gaps as missed frames. */
export class FrameCadence {
  private nextAt = 0;
  private lastAt: number | null = null;
  private inputAt = 0;
  private rate = -1;

  wake(now: number): void {
    this.inputAt = now;
  }

  step(
    now: number,
    fpsCap: 0 | 30 | 60,
    busy: boolean,
    hidden: boolean,
  ): { idle: boolean; gap: number } | null {
    if (hidden) {
      this.lastAt = null;
      this.nextAt = 0;
      return null;
    }
    const idle = !busy && now - this.inputAt > 10_000;
    const rate = idle ? 30 : fpsCap;
    if (rate !== this.rate) this.nextAt = 0;
    this.rate = rate;
    if (now + 0.1 < this.nextAt) return null;
    const gap = this.lastAt === null ? 0 : now - this.lastAt;
    this.lastAt = now;
    const interval = rate === 0 ? 0 : 1000 / rate;
    if (now - this.nextAt >= interval) this.nextAt = now;
    this.nextAt += interval;
    return { idle, gap };
  }
}
