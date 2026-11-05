import { HOST_RULES } from '../config/match.ts';
import {
  PROTOCOL_VERSION, type ActionResolvedMsg, type ClientIntent, type CloseReason, type HostMessage, type LobbyView, type MatchEndedMsg,
  type MatchStartedMsg, type MatchView, type PeerMessage, type PeerProfile, type TurnStartedMsg,
} from '../protocol.ts';
import type { HostClock } from '../host/clock.ts';
import type { KeyValueStore } from '../persist/store.ts';

/** A connection to the host, whatever the transport. */
export interface ClientLink {
  send(msg: PeerMessage): void;
  close(): void;
}

export interface PeerClientOptions {
  code: string;
  profile: PeerProfile;
  clock: HostClock;
  /** Where the rejoin token lives (use localStorage so a reload — or a host refresh — keeps your seat). */
  tokenStore?: KeyValueStore;
}

type Listener = (msg: HostMessage) => void;

/**
 * Peer-side session state (used by EVERY player, including the host's own UI over a loopback link).
 * Feed it raw messages; read `lobby`, `match`, `started`, `turn`, `ended`; subscribe with `on()`.
 * The battle scene consumes `actionResolved` events in order exactly as it did with Colyseus.
 */
export class PeerClient {
  playerId: string | null = null;
  lobby: LobbyView | null = null;
  match: MatchView | null = null;
  started: MatchStartedMsg | null = null;
  turn: TurnStartedMsg | null = null;
  ended: MatchEndedMsg | null = null;
  actions: ActionResolvedMsg[] = [];
  closedReason: CloseReason | null = null;
  status: 'idle' | 'connecting' | 'joined' | 'reconnecting' | 'closed' = 'idle';
  /** hostTime ≈ clock.now() + offset. */
  offset = 0;
  private samples: number[] = [];
  private link: ClientLink | null = null;
  private pinger: unknown = null;
  private listeners = new Map<string, Set<Listener>>();

  private readonly opts: PeerClientOptions;

  constructor(opts: PeerClientOptions) {
    this.opts = opts;}

  static tokenKey(code: string): string { return `lobbers:rejoin:${code}`; }

  /** Transport opened: say hello (with the saved rejoin token, if any) and start pinging. */
  attach(link: ClientLink): void {
    this.link = link;
    this.status = this.status === 'joined' || this.status === 'reconnecting' ? 'reconnecting' : 'connecting';
    const rejoinToken = this.opts.tokenStore?.getItem(PeerClient.tokenKey(this.opts.code)) ?? undefined;
    link.send({ t: 'hello', v: PROTOCOL_VERSION, profile: this.opts.profile, ...(rejoinToken ? { rejoinToken } : {}) });
    this.ping();
  }

  /** Transport closed (network drop, host gone). The app decides whether to reconnect (see NETWORK.md). */
  detach(): void {
    this.link = null;
    if (this.pinger !== null) this.opts.clock.clearTimeout(this.pinger);
    this.pinger = null;
    if (this.status !== 'closed') this.status = 'reconnecting';
  }

  send(intent: ClientIntent | { t: 'loaded' } | { t: 'leave' }): void { this.link?.send(intent); }

  hostNow(): number { return this.opts.clock.now() + this.offset; }
  /** ms left on the current turn, using the host clock. */
  turnMsLeft(): number { return this.match?.endsAt ? Math.max(0, this.match.endsAt - this.hostNow()) : 0; }

  on(t: HostMessage['t'] | '*', cb: Listener): () => void {
    let set = this.listeners.get(t);
    if (!set) { set = new Set(); this.listeners.set(t, set); }
    set.add(cb);
    return () => set!.delete(cb);
  }

  receive(raw: string | HostMessage): void {
    let msg: HostMessage;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) as HostMessage : raw; } catch { return; }
    switch (msg.t) {
      case 'welcome':
        this.playerId = msg.playerId; this.status = 'joined';
        if (msg.rejoinToken) this.opts.tokenStore?.setItem(PeerClient.tokenKey(this.opts.code), msg.rejoinToken);
        this.sample(msg.hostTime, this.opts.clock.now(), this.opts.clock.now());
        break;
      case 'pong': this.sample(msg.hostTime, msg.clientTime, this.opts.clock.now()); break;
      case 'lobbyState': this.lobby = msg.data; break;
      case 'matchStarted': this.started = msg.data; this.ended = null; this.actions = []; break;
      case 'matchState': this.match = msg.data; break;
      case 'turnStarted': this.turn = msg.data; break;
      case 'actionResolved': this.actions.push(msg.data); break;
      case 'matchEnded': this.ended = msg.data; break;
      case 'closed':
        this.closedReason = msg.reason; this.status = 'closed';
        this.opts.tokenStore?.removeItem(PeerClient.tokenKey(this.opts.code));
        break;
    }
    for (const k of [msg.t, '*']) for (const cb of this.listeners.get(k) ?? []) cb(msg);
  }

  private ping(): void {
    if (!this.link) return;
    this.link.send({ t: 'ping', clientTime: this.opts.clock.now() });
    this.pinger = this.opts.clock.setTimeout(() => this.ping(), HOST_RULES.pingIntervalMs);
  }

  /** Clock offset = median of the last 5 (hostTime + rtt/2 − now) samples. */
  private sample(hostTime: number, sentAt: number, now: number): void {
    const rtt = Math.max(0, now - sentAt);
    this.samples.push(hostTime + rtt / 2 - now);
    if (this.samples.length > 5) this.samples.shift();
    const s = [...this.samples].sort((a, b) => a - b);
    this.offset = s[Math.floor(s.length / 2)];
  }
}
