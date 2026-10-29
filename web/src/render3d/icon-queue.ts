/**
 * The bookkeeping behind `icons.ts`, with nothing of three or the DOM in it so it can be tested on its own: an
 * LRU cache of rendered icons (bounded by entries and by their total cost, pixels) and a queue that renders a
 * few per frame, inside a time budget, so a panel opening with forty icons does not hitch.
 */

export class LruCache<V> {
  private readonly map = new Map<string, V>();
  private total = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxCost: number,
    private readonly costOf: (v: V) => number,
    private readonly onEvict: (v: V) => void = () => {},
  ) {}

  get size(): number {
    return this.map.size;
  }
  get cost(): number {
    return this.total;
  }

  /** The value, made the most recent. */
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, v: V): void {
    const old = this.map.get(key);
    if (old !== undefined) {
      this.map.delete(key);
      this.total -= this.costOf(old);
      if (old !== v) this.onEvict(old);
    }
    this.map.set(key, v);
    this.total += this.costOf(v);
    for (const [k, w] of this.map) {
      if (this.map.size <= this.maxEntries && this.total <= this.maxCost) break;
      if (k === key) continue;
      this.map.delete(k);
      this.total -= this.costOf(w);
      this.onEvict(w);
    }
  }

  clear(): void {
    for (const v of this.map.values()) this.onEvict(v);
    this.map.clear();
    this.total = 0;
  }
}

export interface QueueOptions {
  /** Milliseconds a frame may spend rendering; one icon is always done, however long it takes. */
  budgetMs: number;
  now: () => number;
  /** Runs `fn` before the next frame (requestAnimationFrame). */
  schedule: (fn: () => void) => void;
}

interface Job<V> {
  key: string;
  refs: number;
  resolve: ((v: V) => void)[];
  reject: ((e: unknown) => void)[];
}

export interface Request<V> {
  promise: Promise<V>;
  /** One asker fewer; the job is dropped when nobody is left waiting (its promise then never settles). */
  cancel(): void;
}

export interface QueueStats {
  rendered: number;
  frames: number;
  /** The longest a frame's rendering took, and the sum of all of them, in ms. */
  maxFrameMs: number;
  totalMs: number;
  /** The longest a single icon took. */
  maxIconMs: number;
}

export class IconQueue<V> {
  private readonly jobs = new Map<string, Job<V>>();
  private scheduled = false;
  private paused = false;
  readonly stats: QueueStats = { rendered: 0, frames: 0, maxFrameMs: 0, totalMs: 0, maxIconMs: 0 };

  constructor(
    readonly cache: LruCache<V>,
    private readonly render: (key: string) => V,
    private readonly opts: QueueOptions,
  ) {}

  /** How many icons wait their turn. */
  get pending(): number {
    return this.jobs.size;
  }

  request(key: string): Request<V> {
    const hit = this.cache.get(key);
    if (hit !== undefined) return { promise: Promise.resolve(hit), cancel() {} };
    let job = this.jobs.get(key);
    if (!job) {
      job = { key, refs: 0, resolve: [], reject: [] };
      this.jobs.set(key, job);
      this.kick();
    }
    job.refs++;
    const j = job;
    const promise = new Promise<V>((res, rej) => {
      j.resolve.push(res);
      j.reject.push(rej);
    });
    let done = false;
    return {
      promise,
      cancel: () => {
        if (done) return;
        done = true;
        if (--j.refs <= 0 && this.jobs.get(key) === j) this.jobs.delete(key);
      },
    };
  }

  /** Stops rendering (a lost GL context); what is queued waits. */
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
    this.kick();
  }

  private kick(): void {
    if (this.scheduled || this.paused || this.jobs.size === 0) return;
    this.scheduled = true;
    this.opts.schedule(() => {
      this.scheduled = false;
      this.frame();
    });
  }

  /** One frame's worth: icons until the budget is spent (at least one). */
  frame(): void {
    if (this.paused) return;
    const { now, budgetMs } = this.opts;
    const start = now();
    let spent = 0;
    while (this.jobs.size > 0 && (spent === 0 || spent < budgetMs)) {
      const job = this.jobs.values().next().value as Job<V>;
      this.jobs.delete(job.key);
      const t0 = now();
      try {
        const v = this.render(job.key);
        this.cache.set(job.key, v);
        for (const r of job.resolve) r(v);
      } catch (e) {
        for (const r of job.reject) r(e);
      }
      const took = now() - t0;
      this.stats.rendered++;
      if (took > this.stats.maxIconMs) this.stats.maxIconMs = took;
      spent = now() - start;
    }
    this.stats.frames++;
    this.stats.totalMs += spent;
    if (spent > this.stats.maxFrameMs) this.stats.maxFrameMs = spent;
    this.kick();
  }
}
