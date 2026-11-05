/** Time source + timers for the host. Injected so the whole match can be driven deterministically in tests. */
export interface HostClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: HostClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Test clock: time only moves when you call `advance(ms)`; due timers fire in order. */
export class ManualClock implements HostClock {
  private t: number;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  constructor(start = 1_700_000_000_000) { this.t = start; }
  now(): number { return this.t; }
  setTimeout(fn: () => void, ms: number): number { const id = ++this.seq; this.timers.set(id, { at: this.t + Math.max(0, ms), fn }); return id; }
  clearTimeout(h: unknown): void { this.timers.delete(h as number); }
  /** Moves time forward, firing every timer that becomes due (including timers created by those timers). */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at || (e[1].at === next[1].at && e[0] < next[0]))) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = Math.max(this.t, next[1].at);
      next[1].fn();
    }
    this.t = end;
  }
  pending(): number { return this.timers.size; }
}
