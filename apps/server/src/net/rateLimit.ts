/** Token bucket per key: `perSec` refill, burst = perSec. Used for chat (2/s) and aim relay (10/s). */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private readonly perSec: number, private readonly now: () => number = Date.now) {}

  allow(key: string): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.perSec, at: t };
    b.tokens = Math.min(this.perSec, b.tokens + ((t - b.at) / 1000) * this.perSec);
    b.at = t;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.set(key, b);
    return ok;
  }

  forget(key: string): void { this.buckets.delete(key); }
}
