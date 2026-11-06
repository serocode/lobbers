import type { MatchSettings } from '../types.ts';
import { HOST_RULES } from '../config/match.ts';
import { PROTOCOL_VERSION, type CloseReason, type HostMessage, type LobbyIntent, type LobbyView, type MatchIntent, type PeerMessage, type PeerProfile } from '../protocol.ts';
import { parsePeerMessage } from '../net/codec.ts';
import type { KeyValueStore } from '../persist/store.ts';
import type { HostClock } from './clock.ts';
import { HostLobby } from './lobby.ts';
import { HostMatch, type HostMatchSnapshot } from './match.ts';
import { loadoutFromEquipped } from '../config/cosmetics.ts';
import { BOT_ID_PREFIX } from '../config/bots.ts';
import { BotSeats } from './bots.ts';

/** One connection to a peer, whatever the transport (PeerJS DataConnection, loopback for the host's own UI, tests). */
export interface PeerLink {
  send(msg: HostMessage): void;
  close(): void;
}

export interface HostSessionOptions {
  code: string;
  roomName: string;
  host: PeerProfile;
  clock: HostClock;
  settings?: MatchSettings;
  /** localStorage in the browser — lets the host refresh the tab mid-match and resume. Omit to disable. */
  store?: KeyValueStore;
  /** Randomness for match seeds and rejoin tokens (default Math.random; pass crypto-backed in the app). */
  random?: () => number;
  /** The room closed (host pressed Leave, or `close()`). */
  onClosed?: () => void;
}

interface HostSnapshot {
  v: 1;
  code: string;
  roomName: string;
  host: PeerProfile;
  lobby: LobbyView;
  tokens: Array<[string, string]>;
  matchCount: number;
  match: HostMatchSnapshot | null;
  savedAt: number;
}

const LOBBY_INTENTS = new Set<PeerMessage['t']>(['setTeam', 'setMachine', 'setReady', 'updateSettings', 'kick', 'startMatch', 'chat', 'setCosmetics', 'addBot', 'setBot']);
/** A saved host session older than this is ignored on reload. */
const SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Everything the host's browser runs: link bookkeeping, hello/rejoin, routing intents to HostLobby / HostMatch,
 * heartbeats and localStorage snapshots. The transport adapter only calls `connect`, `receive`, `disconnect`.
 */
export class HostSession {
  readonly code: string;
  readonly hostId: string;
  lobby: HostLobby;
  match: HostMatch | null = null;
  private links = new Map<PeerLink, { playerId: string | null; lastSeen: number }>();
  private byPlayer = new Map<string, PeerLink>();
  private tokens = new Map<string, string>();
  /** Bot seats played in this tab. */
  private readonly bots: BotSeats;
  private matchCount = 0;
  private heartbeat: unknown = null;
  private closed = false;
  private readonly random: () => number;

  private readonly opts: HostSessionOptions;

  constructor(opts: HostSessionOptions, snap?: HostSnapshot) {
    this.opts = opts;
    this.code = opts.code;
    this.hostId = opts.host.id;
    this.random = opts.random ?? Math.random;
    this.bots = new BotSeats(this, opts.clock, this.random);
    this.lobby = new HostLobby({
      code: opts.code, name: opts.roomName, host: opts.host, clock: opts.clock, settings: opts.settings,
      onChange: () => { this.broadcast({ t: 'lobbyState', data: this.lobby.view() }); this.persist(); },
      onStarting: (countdown) => this.broadcast({ t: 'matchStarting', countdown, matchId: `${this.code}-${this.matchCount + 1}` }),
      onStart: (seats, settings) => this.startMatch(seats, settings),
      onKick: (pid) => this.dropPlayer(pid, 'kicked'),
      onBotAdded: (pid) => this.attachBot(pid),
      onBotChanged: (pid, d) => this.bots.setDifficulty(pid, d),
      random: this.random,
    });
    if (snap) {
      this.lobby.load(snap.lobby);
      this.tokens = new Map(snap.tokens);
      this.matchCount = snap.matchCount;
      if (snap.match && this.lobby.phase === 'inMatch') {
        this.match = HostMatch.restore(snap.match, { clock: opts.clock, send: (to, m) => this.route(to, m), onEnded: () => this.matchEnded(), onChange: () => this.persist(), connected: [this.hostId] });
      } else if (this.lobby.phase === 'inMatch') this.lobby.backToRoom();
      for (const p of this.lobby.players) if (p.bot) this.attachBot(p.id);   // bots live in this tab: bring them back
    }
    this.armHeartbeat();
    this.persist();   // a fresh room must survive a host F5 even before anyone joins
  }

  static storageKey(code: string): string { return `lobbers:host:${code}`; }

  /** Host page reload: resume the saved room/match for this code if it is recent. Returns null if none. */
  static restore(opts: HostSessionOptions): HostSession | null {
    const raw = opts.store?.getItem(HostSession.storageKey(opts.code));
    if (!raw) return null;
    try {
      const snap = JSON.parse(raw) as HostSnapshot;
      if (snap.v !== 1 || snap.code !== opts.code || opts.clock.now() - snap.savedAt > SNAPSHOT_MAX_AGE_MS) return null;
      return new HostSession({ ...opts, roomName: snap.roomName, host: snap.host }, snap);
    } catch { return null; }
  }

  // ------------------------------------------------------------------ transport hooks
  connect(link: PeerLink): void {
    if (this.closed) { link.send({ t: 'closed', reason: 'host closed the room' }); link.close(); return; }
    this.links.set(link, { playerId: null, lastSeen: this.opts.clock.now() });
  }

  /** The host's own UI. Bound to the host seat without a hello/token. */
  connectLocal(link: PeerLink): void { this.bindSeat(link, this.hostId); }

  /** A bot seat's PeerClient (created by `attachBot`, never by a remote peer). Bound without a hello/token. */
  connectBot(link: PeerLink, playerId: string): void {
    if (!this.lobby.players.some((p) => p.id === playerId && p.bot)) { link.close(); return; }
    this.bindSeat(link, playerId);
    this.lobby.setConnected(playerId, true);
  }

  receive(link: PeerLink, raw: unknown): void {
    const entry = this.links.get(link);
    if (!entry) return;
    entry.lastSeen = this.opts.clock.now();
    const msg = parsePeerMessage(raw);
    if (!msg) return;
    if (msg.t === 'ping') {
      link.send({ t: 'pong', clientTime: msg.clientTime, hostTime: this.opts.clock.now() });
      if (entry.playerId && msg.rtt !== undefined) this.lobby.setPing(entry.playerId, msg.rtt);
      return;
    }
    if (!entry.playerId) { if (msg.t === 'hello') this.hello(link, entry, msg); return; }
    const pid = entry.playerId;
    switch (msg.t) {
      case 'hello': return;
      case 'leave':
        if (pid === this.hostId) { this.close(); return; }
        if (this.match && this.lobby.phase === 'inMatch') this.match.handle(pid, { t: 'forfeit' });
        this.dropPlayer(pid, null);
        return;
      case 'loaded': this.match?.markLoaded(pid); return;
    }
    if (LOBBY_INTENTS.has(msg.t)) {
      const v = this.lobby.handle(pid, msg as LobbyIntent);
      if (!v.ok) link.send({ t: 'rejected', intent: msg.t, reason: v.reason });
      return;
    }
    if (!this.match || this.lobby.phase !== 'inMatch') { link.send({ t: 'rejected', intent: msg.t, reason: 'no match running' }); return; }
    this.match.handle(pid, msg as MatchIntent);
  }

  disconnect(link: PeerLink): void {
    const e = this.links.get(link);
    this.links.delete(link);
    if (!e?.playerId || this.byPlayer.get(e.playerId) !== link) return;
    const pid = e.playerId;
    this.byPlayer.delete(pid);
    if (pid === this.hostId) { this.match?.setConnected(pid, false); return; }
    if (this.match && this.lobby.phase === 'inMatch' && this.match.seats.some((s) => s.playerId === pid)) {
      this.lobby.setConnected(pid, false);
      this.match.setConnected(pid, false);
    } else {
      this.lobby.leave(pid);
      this.forgetTokens(pid);
    }
  }

  /** Host pressed Leave / closed the room: tell everyone, stop timers, forget the snapshot. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.broadcast({ t: 'closed', reason: 'host closed the room' });
    for (const l of [...this.links.keys()]) l.close();
    this.links.clear(); this.byPlayer.clear();
    this.match?.dispose(); this.lobby.dispose();
    this.bots.disposeAll();
    if (this.heartbeat !== null) this.opts.clock.clearTimeout(this.heartbeat);
    this.opts.store?.removeItem(HostSession.storageKey(this.code));
    this.opts.onClosed?.();
  }

  connectedPlayers(): string[] { return [...this.byPlayer.keys()]; }

  // ------------------------------------------------------------------ internals
  private hello(link: PeerLink, entry: { playerId: string | null }, msg: Extract<PeerMessage, { t: 'hello' }>): void {
    const closeWith = (reason: CloseReason): void => { link.send({ t: 'closed', reason }); this.links.delete(link); link.close(); };
    if (msg.v !== PROTOCOL_VERSION) return closeWith('version mismatch');
    const pid = msg.profile.id;
    const tokenOwner = msg.rejoinToken ? this.tokens.get(msg.rejoinToken) : undefined;
    if (pid === this.hostId) return closeWith('already joined');
    if (pid.startsWith(BOT_ID_PREFIX)) return closeWith('bad hello');
    if (tokenOwner === pid && (this.lobby.has(pid) || this.match?.seats.some((s) => s.playerId === pid))) {
      // Rejoin (page reload, network blip, host refresh). Replace any stale link.
      const old = this.byPlayer.get(pid);
      if (old && old !== link) { this.links.delete(old); old.close(); }
      this.bind(link, entry, pid, msg.rejoinToken!);
      this.lobby.setConnected(pid, true);
      link.send({ t: 'lobbyState', data: this.lobby.view() });
      if (this.match && this.lobby.phase === 'inMatch') {
        if (this.match.isConnected(pid)) this.match.sync(pid); else this.match.setConnected(pid, true);
      }
      return;
    }
    if (this.byPlayer.has(pid) || this.lobby.has(pid)) return closeWith('already joined');
    const v = this.lobby.join(msg.profile);
    if (!v.ok) return closeWith(v.reason === 'room full' ? 'room full' : v.reason === 'already joined' ? 'already joined' : 'match in progress');
    const token = this.newToken();
    this.tokens.set(token, pid);
    this.bind(link, entry, pid, token);
    this.persist();
  }

  private bindSeat(link: PeerLink, pid: string): void {
    this.connect(link);
    const e = this.links.get(link);
    if (!e) return;
    const old = this.byPlayer.get(pid);
    if (old && old !== link) { this.links.delete(old); old.close(); }
    e.playerId = pid;
    this.byPlayer.set(pid, link);
    link.send({ t: 'welcome', playerId: pid, rejoinToken: '', hostTime: this.opts.clock.now(), code: this.code, protocol: PROTOCOL_VERSION });
    link.send({ t: 'lobbyState', data: this.lobby.view() });
    if (this.match) { this.match.setConnected(pid, true); if (this.match.isConnected(pid)) this.match.sync(pid); }
  }

  private attachBot(pid: string): void {
    const p = this.lobby.players.find((x) => x.id === pid);
    if (p && !this.closed) this.bots.attach(p);
  }

  private bind(link: PeerLink, entry: { playerId: string | null }, pid: string, token: string): void {
    entry.playerId = pid;
    this.byPlayer.set(pid, link);
    link.send({ t: 'welcome', playerId: pid, rejoinToken: token, hostTime: this.opts.clock.now(), code: this.code, protocol: PROTOCOL_VERSION });
    link.send({ t: 'lobbyState', data: this.lobby.view() });
  }

  private startMatch(seats: ReturnType<HostLobby['seats']>, settings: MatchSettings): void {
    this.match?.dispose();
    this.matchCount++;
    this.match = new HostMatch({
      matchId: `${this.code}-${this.matchCount}`, settings, seats, seed: Math.floor(this.random() * 2 ** 31), clock: this.opts.clock,
      send: (to, m) => this.route(to, m), onEnded: () => this.matchEnded(), onChange: () => this.persist(),
      connected: seats.map((s) => s.playerId).filter((id) => this.byPlayer.has(id)),
      cosmetics: Object.fromEntries(this.lobby.players.map((p) => [p.id, loadoutFromEquipped(p.cosmetics ?? {})])),
    });
    this.match.start();
  }

  private matchEnded(): void {
    // Players who never came back are removed; everyone else lands back in the same room (Play again).
    for (const p of [...this.lobby.players]) if (!this.byPlayer.has(p.id) && !p.isHost) { this.lobby.leave(p.id); this.forgetTokens(p.id); }
    this.lobby.backToRoom();
  }

  private dropPlayer(pid: string, reason: CloseReason | null): void {
    const link = this.byPlayer.get(pid);
    this.byPlayer.delete(pid);
    this.forgetTokens(pid);
    this.bots.detach(pid);
    if (link) { if (reason) link.send({ t: 'closed', reason }); this.links.delete(link); link.close(); }
    if (this.lobby.has(pid)) this.lobby.leave(pid);
  }

  private forgetTokens(pid: string): void { for (const [t, id] of this.tokens) if (id === pid) this.tokens.delete(t); }

  private route(to: string, msg: HostMessage): void {
    if (to === '*') this.broadcast(msg);
    else this.byPlayer.get(to)?.send(msg);
  }

  private broadcast(msg: HostMessage): void { for (const l of this.byPlayer.values()) l.send(msg); }

  private armHeartbeat(): void {
    this.heartbeat = this.opts.clock.setTimeout(() => {
      if (this.closed) return;
      const now = this.opts.clock.now();
      for (const [link, e] of [...this.links]) {
        if (e.playerId === this.hostId || (e.playerId && this.bots.has(e.playerId))) continue;
        if (now - e.lastSeen > HOST_RULES.peerTimeoutMs) { this.disconnect(link); link.close(); }
      }
      this.armHeartbeat();
    }, HOST_RULES.pingIntervalMs);
  }

  private newToken(): string {
    let s = '';
    for (let i = 0; i < 24; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(this.random() * 36)];
    return s;
  }

  private persist(): void {
    if (!this.opts.store || this.closed) return;
    const snap: HostSnapshot = {
      v: 1, code: this.code, roomName: this.lobby.name, host: this.opts.host, lobby: this.lobby.view(), tokens: [...this.tokens],
      matchCount: this.matchCount, match: this.match && this.lobby.phase === 'inMatch' ? this.match.snapshot() : null, savedAt: this.opts.clock.now(),
    };
    try { this.opts.store.setItem(HostSession.storageKey(this.code), JSON.stringify(snap)); } catch { /* quota — resume just won't work */ }
  }
}
