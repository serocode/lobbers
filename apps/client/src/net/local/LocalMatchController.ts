// Hot-seat authority: runs the shared MatchFlow (the same state machine the server MatchRoom runs)
// in the browser. The sender of every intent is whoever is active (controls only work for the
// active unit); messages are delivered asynchronously, like a network hop.
import { MatchFlow, type CosmeticLoadout, type MatchIntent, type MatchSettings, type SeatInput } from '@lobbers/shared';
import type { MatchTransport, MatchTransportListener } from '../MatchTransport';

export interface LocalMatchOptions {
  settings: MatchSettings;
  seats: SeatInput[];
  seed: number;
  cosmetics?: Record<string, CosmeticLoadout>;
  /** Delay before the first turn so the intro overview can play (server: "all clients loaded or 10 s"). */
  introDelayMs?: number;
  now?: () => number;
}

export class LocalMatchController implements MatchTransport {
  readonly kind = 'local' as const;
  readonly localPlayerIds: ReadonlySet<string>;
  private readonly flow: MatchFlow;
  private readonly listeners = new Set<MatchTransportListener>();
  private readonly now: () => number;
  private disposed = false;

  constructor(opts: LocalMatchOptions) {
    this.now = opts.now ?? Date.now;
    this.localPlayerIds = new Set(opts.seats.map((s) => s.playerId));
    this.flow = new MatchFlow({
      settings: opts.settings, seats: opts.seats, seed: opts.seed, introDelayMs: opts.introDelayMs, cosmetics: opts.cosmetics,
      clock: { now: this.now, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
      sink: { message: (m) => this.deliver((l) => l.message(m)), state: (s) => this.deliver((l) => l.state(s)) },
    });
  }

  subscribe(l: MatchTransportListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  serverNow(): number { return this.now(); }
  start(): void { this.flow.start(); }

  dispose(): void {
    this.disposed = true;
    this.flow.dispose();
    this.listeners.clear();
  }

  send(intent: MatchIntent): void {
    this.flow.handle(this.flow.activePlayerId ?? '', intent);
  }

  private deliver(fn: (l: MatchTransportListener) => void): void {
    queueMicrotask(() => { if (!this.disposed) for (const l of this.listeners) fn(l); });
  }
}
