// The game room: reserved seats only. Runs the shared MatchFlow (same state machine as hot-seat),
// validates every intent with zod, rate-limits aim relay, keeps disconnected seats for the reconnect
// window and sends a full snapshot on (re)join. Notifies its lobby when the match ends.
import { Room, matchMaker, type Client } from '@colyseus/core';
import { CAMERA, CONNECTION_RULES, MatchFlow, type CosmeticLoadout, type MatchSettings, type SeatInput, type ServerMessage } from '@lobbers/shared';
import { authenticate, internalRoomKey, isRoomAuth, type RoomAuth } from '../auth/roomAuth.ts';
import { archiveMatch } from '../match/archive.ts';
import { roomSettings } from './roomSettings.ts';
import { MatchIntentZ, intentName } from '../net/intents.ts';
import { RateLimiter } from '../net/rateLimit.ts';
import { MatchState } from './matchState.ts';

export interface MatchCreateOptions {
  key: string; seats: SeatInput[]; settings: MatchSettings; seed: number; lobbyRoomId: string; cosmetics?: Record<string, CosmeticLoadout>;
  reconnectWindowSec?: number; introDelayMs?: number; waitForPlayersMs?: number;
}

const AIM_PER_SEC = 10;

export class MatchRoom extends Room<MatchState> {
  private flow!: MatchFlow;
  private seats: SeatInput[] = [];
  private lobbyRoomId = '';
  private sessions = new Map<string, string>(); // sessionId → userId
  private aimLimit = new RateLimiter(AIM_PER_SEC);
  private windowSec: number = CONNECTION_RULES.reconnectWindowSec;
  private started = false;
  private joinedOnce = new Set<string>();

  static override async onAuth(token: string): Promise<RoomAuth> { return authenticate(token); }

  override onCreate(o: MatchCreateOptions): void {
    if (o.key !== internalRoomKey()) throw new Error('match rooms are created by lobbies');
    this.setState(new MatchState());
    this.seats = o.seats;
    this.lobbyRoomId = o.lobbyRoomId;
    // Headroom for a returning account (new tab) while its old seat is still held for reconnection.
    this.maxClients = o.seats.length * 2;
    this.windowSec = typeof o.reconnectWindowSec === 'number' ? o.reconnectWindowSec : roomSettings().reconnectWindowSec;
    this.autoDispose = true;
    void this.setPrivate(true);
    this.flow = new MatchFlow({
      settings: o.settings, seats: o.seats, seed: o.seed, reconnectWindowMs: this.windowSec * 1000, cosmetics: o.cosmetics,
      introDelayMs: o.introDelayMs ?? CAMERA.introOverviewMs + 400,
      clock: { now: () => Date.now(), setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms), clearTimeout: (h) => (h as { clear(): void }).clear() },
      sink: { message: (m, to) => this.out(m, to), state: (v) => this.state.apply(v) },
    });
    this.onMessage('intent', (client, raw: unknown) => this.onIntent(client, raw));
    this.onMessage('time', (client, raw: unknown) => {
      const clientTime = typeof raw === 'object' && raw !== null ? Number((raw as { clientTime?: unknown }).clientTime) : NaN;
      if (Number.isFinite(clientTime)) client.send('time', { clientTime, serverTime: Date.now() });
    });
    // "All clients loaded or 10 s" (docs/ARCHITECTURE.md § MatchController).
    this.clock.setTimeout(() => this.begin(), o.waitForPlayersMs ?? 10_000);
  }

  override onJoin(client: Client, _options: unknown, auth: RoomAuth): void {
    if (!isRoomAuth(auth) || !this.seats.some((s) => s.playerId === auth.userId)) throw new Error('you have no seat in this match');
    for (const [sid, uid] of this.sessions) if (uid === auth.userId) this.sessions.delete(sid);
    this.sessions.set(client.sessionId, auth.userId);
    const rejoin = this.joinedOnce.has(auth.userId);
    this.joinedOnce.add(auth.userId);
    if (rejoin) this.flow.reconnected(auth.userId);
    if (this.started) this.sendSnapshot(client);
    else if (this.seats.every((s) => this.joinedOnce.has(s.playerId))) this.begin();
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const userId = this.sessions.get(client.sessionId);
    this.sessions.delete(client.sessionId);
    if (!userId || this.flow.isEnded) return;
    if (consented) return this.flow.forfeit(userId, 'surrender');
    this.flow.disconnected(userId);
    try {
      const back = await this.allowReconnection(client, this.windowSec);
      this.sessions.set(back.sessionId, userId);
      this.flow.reconnected(userId);
      this.sendSnapshot(back);
    } catch {
      // Window expired — unless the same account came back through a fresh join meanwhile.
      if (![...this.sessions.values()].includes(userId)) this.flow.forfeit(userId, 'disconnect');
    }
  }

  override onDispose(): void { this.flow.dispose(); }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    // Seats that never arrived count as disconnected from the start (their window runs now).
    for (const s of this.seats) if (!this.joinedOnce.has(s.playerId)) this.flow.disconnected(s.playerId);
    this.flow.start();
  }

  private onIntent(client: Client, raw: unknown): void {
    const userId = this.sessions.get(client.sessionId);
    if (!userId) return;
    const parsed = MatchIntentZ.safeParse(raw);
    if (!parsed.success) return this.sendTo(client, { t: 'rejected', intent: intentName(raw) as 'fire', reason: 'bad message' });
    if (parsed.data.t === 'aim' && !this.aimLimit.allow(userId)) return;
    this.flow.handle(userId, parsed.data);
  }

  private sendSnapshot(client: Client): void {
    this.sendTo(client, { t: 'matchStarted', data: this.flow.startSnapshot() });
    const turn = this.flow.currentTurn();
    if (turn) this.sendTo(client, { t: 'turnStarted', data: turn });
    const result = this.flow.result;
    if (result) this.sendTo(client, { t: 'matchEnded', data: result });
  }

  private out(m: ServerMessage, to?: string): void {
    if (m.t === 'matchEnded') this.onEnded(m.data);
    if (to) {
      for (const [sid, uid] of this.sessions) if (uid === to) { const c = this.clients.find((x) => x.sessionId === sid); if (c) this.sendTo(c, m); }
      return;
    }
    this.broadcast('s', m);
  }

  private sendTo(client: Client, m: ServerMessage): void { client.send('s', m); }

  private onEnded(result: Parameters<typeof archiveMatch>[1]): void {
    archiveMatch(this.roomId, result);
    if (this.lobbyRoomId) {
      matchMaker.remoteRoomCall(this.lobbyRoomId, 'matchFinished', [this.roomId]).catch(() => undefined);
    }
  }
}
