// MatchTransport over a Colyseus MatchRoom. Keeps the messages since the latest `matchStarted` so any
// subscriber (StrictMode remounts, a rebuilt ClientMatch after a reconnect) replays the same match.
// On an unexpected drop it reconnects with the room's reconnection token inside the server's window;
// the server then sends a fresh full snapshot (new `generation`).
import type { Room } from 'colyseus.js';
import { CONNECTION_RULES, type MatchIntent, type MatchStateView, type ServerMessage, type TimeSyncReply } from '@lobbers/shared';
import { create } from 'zustand';
import type { MatchTransport, MatchTransportListener } from '../MatchTransport';
import { colyseus } from './colyseus';
import { matchTicket } from './storage';

export type LinkStatus = 'connected' | 'reconnecting' | 'lost';
export interface MatchLink { status: LinkStatus; deadline: number; generation: number }
/** Connection state of the current online match (drives the "Reconnecting…" scrim, §3.8). */
export const useMatchLink = create<MatchLink>(() => ({ status: 'connected', deadline: 0, generation: 0 }));

interface StateJson { phase?: MatchStateView['phase']; turnNumber?: number; activeUnitId?: string; endsAt?: number; wind?: number; shotsLeft?: number; offline?: Record<string, number> }

const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

export class NetMatchController implements MatchTransport {
  readonly kind = 'online' as const;
  readonly localPlayerIds: ReadonlySet<string>;
  private room: Room;
  private history: ServerMessage[] = [];
  private state: MatchStateView | null = null;
  private listeners = new Set<MatchTransportListener>();
  private offsets: number[] = [];
  private offset = 0;
  private closed = false;
  private timeSynced = false;

  constructor(room: Room, readonly matchId: string, userId: string) {
    this.room = room;
    this.localPlayerIds = new Set([userId]);
    this.attach(room);
  }

  get ended(): boolean { return this.history.some((m) => m.t === 'matchEnded'); }
  /** The final results once the match is over. */
  get result(): Extract<ServerMessage, { t: 'matchEnded' }>['data'] | null {
    const m = this.history.find((x): x is Extract<ServerMessage, { t: 'matchEnded' }> => x.t === 'matchEnded');
    return m?.data ?? null;
  }

  subscribe(l: MatchTransportListener): () => void {
    this.listeners.add(l);
    for (const m of this.history) l.message(m);
    if (this.state) l.state(this.state);
    return () => this.listeners.delete(l);
  }

  start(): void {
    if (this.timeSynced) return;
    this.timeSynced = true;
    for (let i = 0; i < 3; i++) setTimeout(() => { if (!this.closed) this.room.send('time', { clientTime: Date.now() }); }, i * 200);
  }

  send(intent: MatchIntent): void { if (!this.closed) this.room.send('intent', intent); }
  serverNow(): number { return Date.now() + this.offset; }

  /** A ClientMatch is done with this transport; the room itself is owned by matchService. */
  dispose(): void { /* listeners unsubscribe themselves */ }

  /** Leaves the room (consented: the server treats this as a surrender while the match is running). */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    matchTicket.set(null);
    this.listeners.clear();
    await this.room.leave(true).catch(() => undefined);
  }

  private attach(room: Room): void {
    this.room = room;
    matchTicket.set({ roomId: this.matchId, token: room.reconnectionToken });
    room.onMessage('s', (m: ServerMessage) => this.onMessage(m));
    room.onMessage('time', (r: TimeSyncReply) => {
      const now = Date.now();
      this.offsets.push(r.serverTime - (r.clientTime + now) / 2);
      this.offset = median(this.offsets.slice(-5));
    });
    room.onStateChange((s: { toJSON(): StateJson }) => this.onState(s.toJSON()));
    room.onLeave((code) => { if (!this.closed && !this.ended && code !== 1000 && code !== 4000) void this.reconnect(); });
  }

  private onMessage(m: ServerMessage): void {
    if (m.t === 'matchStarted') {
      // A full snapshot: anything before it is superseded (first start or a reconnect).
      const resync = this.history.length > 0;
      this.history = [m];
      if (resync) {
        useMatchLink.setState((s) => ({ generation: s.generation + 1 }));
        return;
      }
    } else {
      this.history.push(m);
    }
    for (const l of this.listeners) l.message(m);
  }

  private onState(j: StateJson): void {
    this.state = {
      phase: j.phase ?? 'waiting', turnNumber: j.turnNumber ?? 0, activeUnitId: j.activeUnitId || null, endsAt: j.endsAt ?? 0,
      wind: j.wind ?? 0, shotsLeft: j.shotsLeft ?? 0, offline: { ...(j.offline ?? {}) },
    };
    for (const l of this.listeners) l.state(this.state);
  }

  private async reconnect(): Promise<void> {
    const token = this.room.reconnectionToken;
    const deadline = Date.now() + CONNECTION_RULES.reconnectWindowSec * 1000;
    useMatchLink.setState({ status: 'reconnecting', deadline });
    while (!this.closed && Date.now() < deadline) {
      try {
        const room = await colyseus().reconnect(token);
        this.attach(room);
        useMatchLink.setState({ status: 'connected', deadline: 0 });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!this.closed) useMatchLink.setState({ status: 'lost', deadline: 0 });
  }
}
