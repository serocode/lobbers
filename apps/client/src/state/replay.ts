// Plays authoritative outcomes in order and in time (60 ticks/s). Presenters (mirror world, HUD, Phaser
// scene) receive the same events at the same moment, so numbers, HP bars and explosions line up.
import { PHYSICS, type ActionResolvedMsg, type MatchEndedMsg, type SimEvent, type TurnStartedMsg } from '@lobbers/shared';

export interface ReplayPresenter {
  turnStarted?(msg: TurnStartedMsg): void;
  actionStart?(a: ActionResolvedMsg): void;
  /** `a` is null for start-of-turn upkeep events (burn damage). */
  event?(e: SimEvent, a: ActionResolvedMsg | null): void;
  actionEnd?(a: ActionResolvedMsg): void;
  matchEnded?(m: MatchEndedMsg): void;
}

type Item = { kind: 'turn'; msg: TurnStartedMsg } | { kind: 'action'; msg: ActionResolvedMsg } | { kind: 'end'; msg: MatchEndedMsg };

interface Playing { item: Item; events: SimEvent[]; next: number; elapsedMs: number; ticks: number }

export const eventTick = (e: SimEvent): number => (e.t === 'unitPath' ? e.startTick : e.tick);
const eventEnd = (e: SimEvent): number => (e.t === 'unitPath' ? e.startTick + e.points.length : e.tick);
const UPKEEP_TICKS = 60;

export class Replay {
  private queue: Item[] = [];
  private cur: Playing | null = null;
  private presenters: ReplayPresenter[] = [];

  add(p: ReplayPresenter): () => void {
    this.presenters.push(p);
    return () => { this.presenters = this.presenters.filter((x) => x !== p); };
  }

  enqueue(item: Item): void { this.queue.push(item); }

  /** True while anything is playing or waiting to play. */
  get busy(): boolean { return this.cur !== null || this.queue.length > 0; }
  /** True while a turn change, shot or ability is playing or queued (walking/jumping never blocks input). */
  get blocking(): boolean {
    const blocks = (i: Item): boolean => i.kind !== 'action' || (i.msg.kind !== 'move' && i.msg.kind !== 'jump');
    return (this.cur !== null && blocks(this.cur.item)) || this.queue.some(blocks);
  }
  /** The action currently animating, and its tick (for projectile / unit interpolation). */
  get action(): ActionResolvedMsg | null { return this.cur?.item.kind === 'action' ? this.cur.item.msg : null; }
  get tick(): number { return this.cur ? (this.cur.elapsedMs * PHYSICS.tickRate) / 1000 : 0; }

  /** Drops everything (match left / disposed). */
  clear(): void { this.queue = []; this.cur = null; }

  advance(dtMs: number): void {
    // Catch up when a backlog builds (e.g. a burst of move messages).
    const speed = this.queue.length > 2 ? 2 : 1;
    let budget = Math.min(dtMs, 100) * speed;
    for (let guard = 0; guard < 64; guard++) {
      if (!this.cur && !this.begin()) return;
      const c = this.cur;
      if (!c) return;
      const totalMs = (c.ticks * 1000) / PHYSICS.tickRate;
      const step = Math.min(budget, Math.max(0, totalMs - c.elapsedMs));
      c.elapsedMs += step;
      budget -= step;
      this.flush(c, this.tick);
      if (c.elapsedMs >= totalMs) { this.finish(c); continue; }
      if (budget <= 0) return;
    }
  }

  private begin(): boolean {
    const item = this.queue.shift();
    if (!item) return false;
    if (item.kind === 'end') {
      for (const p of this.presenters) p.matchEnded?.(item.msg);
      return this.begin();
    }
    if (item.kind === 'turn') {
      for (const p of this.presenters) p.turnStarted?.(item.msg);
      const events = [...item.msg.events];
      this.cur = { item, events, next: 0, elapsedMs: 0, ticks: events.length ? UPKEEP_TICKS : 0 };
      return true;
    }
    const a = item.msg;
    const events = [...a.result.events].sort((x, y) => eventTick(x) - eventTick(y));
    let ticks = a.result.durationTicks;
    for (const e of events) ticks = Math.max(ticks, eventEnd(e));
    if ('tracks' in a.result) for (const t of a.result.tracks) ticks = Math.max(ticks, t.spawnTick + t.points.length);
    for (const p of this.presenters) p.actionStart?.(a);
    this.cur = { item, events, next: 0, elapsedMs: 0, ticks };
    return true;
  }

  private flush(c: Playing, tick: number): void {
    const a = c.item.kind === 'action' ? c.item.msg : null;
    while (c.next < c.events.length && eventTick(c.events[c.next]) <= tick) {
      const e = c.events[c.next++];
      for (const p of this.presenters) p.event?.(e, a);
    }
  }

  private finish(c: Playing): void {
    this.flush(c, Number.POSITIVE_INFINITY);
    this.cur = null;
    if (c.item.kind === 'action') { const msg = c.item.msg; for (const p of this.presenters) p.actionEnd?.(msg); }
  }
}
