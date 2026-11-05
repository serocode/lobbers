// The 8-seat room (Lobby.dc.html / DESIGN_SPEC §2.2): seats, teams, machines, ready, settings, chat,
// kick, host transfer, validated start with a 3-2-1 countdown, then a MatchRoom with reserved seats.
// The lobby stays alive during the match so everyone returns to the same room afterwards.
import { Room, matchMaker, type Client } from '@colyseus/core';
import {
  COSMETIC_BY_ID, DEFAULT_ITEMS, DEFAULT_LOADOUT, ROOM_LIMITS, canSwitchTeam, sanitizeLoadout, type CosmeticLoadout, freeSlot, pickTeam, transferHost, validateStart,
  type LobbyIntent, type LobbyPlayer, type LobbyServerMessage, type MachineId, type PublicRoomInfo, type SeatInput, type TeamId,
} from '@lobbers/shared';
import { authenticate, internalRoomKey, isRoomAuth, type RoomAuth } from '../auth/roomAuth.ts';
import { claimRoomCode, releaseRoomCode } from '../lobby/codes.ts';
import { cleanChat } from '../lobby/chatFilter.ts';
import { LobbyIntentZ, MachineIdZ, MapIdZ, RoomNameZ, SettingsPatchZ, intentName } from '../net/intents.ts';
import { RateLimiter } from '../net/rateLimit.ts';
import { ChatLineSchema, LobbyPlayerSchema, LobbyState } from './lobbyState.ts';
import { roomSettings } from './roomSettings.ts';

export interface LobbyCreateOptions {
  name?: unknown; mapId?: unknown; mode?: unknown; isPrivate?: unknown; ranked?: unknown;
  /** Test-only timing overrides (ignored unless NODE_ENV=test). */
  test?: { reconnectWindowSec?: number; countdownMs?: number; introDelayMs?: number; waitForPlayersMs?: number };
}
interface JoinOptions { machine?: unknown; cosmetics?: unknown }

const CHAT_KEEP = 20;
const DEFAULT_TITLE = 'Rookie';
const OWNED_BY_GUESTS: ReadonlySet<string> = new Set(DEFAULT_ITEMS);

export class LobbyRoom extends Room<LobbyState> {
  override maxClients = ROOM_LIMITS.maxPlayers;
  private chatLimit = new RateLimiter(ROOM_LIMITS.chatRateLimitPerSec);
  private sessions = new Map<string, string>(); // sessionId → userId
  private loadouts = new Map<string, CosmeticLoadout>(); // userId → sanitised cosmetics
  private chatSeq = 1;
  private windowSec: number = roomSettings().reconnectWindowSec;
  private countdownMs = 3000;
  private testTiming: LobbyCreateOptions['test'] = undefined;

  static override async onAuth(token: string): Promise<RoomAuth> { return authenticate(token); }

  override async onCreate(options: LobbyCreateOptions): Promise<void> {
    this.setState(new LobbyState());
    const s = this.state;
    const ranked = options.ranked === true;
    const isPrivate = !ranked && options.isPrivate === true;
    s.ranked = ranked;
    s.isPrivate = isPrivate;
    s.settings.isPrivate = isPrivate;
    const map = MapIdZ.safeParse(options.mapId);
    if (map.success) s.settings.mapId = map.data;
    const mode = SettingsPatchZ.shape.mode.safeParse(options.mode);
    if (mode.success && mode.data) s.settings.mode = mode.data;
    const name = RoomNameZ.safeParse(options.name);
    s.name = name.success ? name.data : ranked ? 'Ranked 4v4' : 'Open room';
    if (process.env.NODE_ENV === 'test' && options.test) {
      this.testTiming = options.test;
      if (typeof options.test.reconnectWindowSec === 'number') this.windowSec = options.test.reconnectWindowSec;
      if (typeof options.test.countdownMs === 'number') this.countdownMs = options.test.countdownMs;
    }
    s.code = await claimRoomCode(this.presence, this.roomId);
    await this.setPrivate(isPrivate);
    await this.syncMetadata();

    this.onMessage('intent', (client, raw: unknown) => this.onIntent(client, raw));
    this.onMessage('time', (client, raw: unknown) => {
      const clientTime = typeof raw === 'object' && raw !== null ? Number((raw as { clientTime?: unknown }).clientTime) : NaN;
      if (Number.isFinite(clientTime)) client.send('time', { clientTime, serverTime: Date.now() });
    });
    this.onMessage('pong', (client, raw: unknown) => {
      const sent = typeof raw === 'object' && raw !== null ? Number((raw as { t?: unknown }).t) : NaN;
      const p = this.playerOf(client);
      if (p && Number.isFinite(sent)) p.ping = Math.max(0, Math.min(999, Date.now() - sent));
    });
    this.clock.setInterval(() => this.broadcast('ping', { t: Date.now() }), 3000);
  }

  override onJoin(client: Client, options: JoinOptions | undefined, auth: RoomAuth): void {
    if (!isRoomAuth(auth)) throw new Error('unauthorised');
    const s = this.state;
    const existing = s.players.get(auth.userId);
    if (existing?.connected) throw new Error('you are already in this room');
    if (!existing && s.phase !== 'open') throw new Error('a match is in progress in this room');
    this.sessions.set(client.sessionId, auth.userId);
    if (existing) {
      // Same account came back without its reconnection token (e.g. a new tab): reclaim the seat.
      existing.connected = true;
      existing.reconnectUntil = 0;
      this.system(`${existing.name} reconnected`);
      this.sendMatchSeat(client, auth);
      return;
    }
    const list = this.lobbyPlayers();
    const team = pickTeam(list);
    const slot = freeSlot(list, team);
    if (slot < 0) throw new Error('room full');
    const p = new LobbyPlayerSchema();
    const machine = MachineIdZ.safeParse(options?.machine);
    const loadout = this.setLoadout(auth.userId, options?.cosmetics);
    Object.assign(p, { id: auth.userId, name: auth.name, title: COSMETIC_BY_ID[loadout.title]?.name ?? DEFAULT_TITLE, level: 1, team, slot, machine: machine.success ? machine.data : 'thumper', ready: false, connected: true, isHost: s.players.size === 0, joinedAt: Date.now() });
    s.players.set(p.id, p);
    if (p.isHost) s.hostId = p.id;
    this.system(`${p.name} joined ${team === 'red' ? 'Red' : 'Blue'} team`);
    void this.syncMetadata();
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const userId = this.sessions.get(client.sessionId);
    this.sessions.delete(client.sessionId);
    const p = userId ? this.state.players.get(userId) : undefined;
    if (!p || !userId) return;
    if (consented) return this.removePlayer(userId, `${p.name} left`);
    p.connected = false;
    p.reconnectUntil = Date.now() + this.windowSec * 1000;
    if (p.isHost) this.reassignHost();
    this.system(`${p.name} disconnected`);
    try {
      const back = await this.allowReconnection(client, this.windowSec);
      this.sessions.set(back.sessionId, userId);
      p.connected = true;
      p.reconnectUntil = 0;
      this.system(`${p.name} reconnected`);
      if (isRoomAuth(back.auth)) this.sendMatchSeat(back, back.auth);
    } catch {
      // Window expired — unless the same account reclaimed the seat from a new tab meanwhile.
      if (!p.connected) this.removePlayer(userId, `${p.name} left`);
    }
  }

  override async onDispose(): Promise<void> { await releaseRoomCode(this.presence, this.state.code); }

  /** Called by MatchRoom (matchMaker.remoteRoomCall) when the match ends: back to an open room. */
  matchFinished(matchId: string): void {
    const s = this.state;
    if (s.matchId !== matchId) return;
    s.phase = 'open';
    for (const p of s.players.values()) if (!p.isHost) p.ready = false;
    void this.unlock();
    this.system('Match over — back in the lobby');
  }

  // ---------------------------------------------------------------- intents

  private onIntent(client: Client, raw: unknown): void {
    const p = this.playerOf(client);
    const parsed = LobbyIntentZ.safeParse(raw);
    if (!p) return;
    if (!parsed.success) return this.reject(client, intentName(raw) as LobbyIntent['t'], 'bad message');
    const it = parsed.data;
    const s = this.state;
    const hostOnly = it.t === 'updateSettings' || it.t === 'kick' || it.t === 'startMatch' || it.t === 'setRoomName';
    if (hostOnly && !p.isHost) return this.reject(client, it.t, 'only the host can do that');
    if (it.t !== 'chat' && s.phase !== 'open') return this.reject(client, it.t, s.phase === 'starting' ? 'the match is starting' : 'a match is in progress');
    switch (it.t) {
      case 'setTeam': return this.setTeam(client, p, it.team);
      case 'setMachine': p.machine = it.machine; return;
      case 'setReady': p.ready = it.ready; return;
      case 'updateSettings': return this.updateSettings(it.patch);
      case 'setRoomName': s.name = it.name; void this.syncMetadata(); return;
      case 'setCosmetics': p.title = COSMETIC_BY_ID[this.setLoadout(p.id, it.loadout).title]?.name ?? DEFAULT_TITLE; return;
      case 'kick': return this.kick(client, p, it.playerId);
      case 'startMatch': return this.startCountdown(client, p);
      case 'chat': {
        if (!this.chatLimit.allow(p.id)) return this.reject(client, 'chat', 'slow down — 2 messages a second');
        const text = cleanChat(it.text);
        if (text) this.chat(p.id, p.name, p.team, text);
        return;
      }
    }
  }

  private setTeam(client: Client, p: LobbyPlayerSchema, team: TeamId): void {
    const ok = canSwitchTeam(this.lobbyPlayers(), p.id, team);
    if (!ok.ok) return this.reject(client, 'setTeam', ok.reason);
    p.slot = freeSlot(this.lobbyPlayers(), team);
    p.team = team;
    p.ready = false;
  }

  private updateSettings(patch: Partial<ReturnType<LobbyState['settings']['toSettings']>>): void {
    const st = this.state.settings;
    Object.assign(st, patch);
    if (patch.isPrivate !== undefined && !this.state.ranked) {
      this.state.isPrivate = patch.isPrivate;
      void this.setPrivate(patch.isPrivate);
    }
    st.isPrivate = this.state.isPrivate;
    void this.syncMetadata();
  }

  private kick(client: Client, host: LobbyPlayerSchema, targetId: string): void {
    const target = this.state.players.get(targetId);
    if (!target || target.id === host.id) return this.reject(client, 'kick', 'no such player');
    for (const [sid, uid] of this.sessions) {
      if (uid !== targetId) continue;
      const c = this.clients.find((x) => x.sessionId === sid);
      c?.send('lobby', { t: 'kicked', reason: 'The host removed you from the room' } satisfies LobbyServerMessage);
      this.sessions.delete(sid);
      c?.leave(4001);
    }
    this.removePlayer(targetId, `${target.name} was removed by the host`);
  }

  private startCountdown(client: Client, host: LobbyPlayerSchema): void {
    const ok = validateStart(this.lobbyPlayers(), host.id);
    if (!ok.ok) return this.reject(client, 'startMatch', ok.reason);
    const s = this.state;
    s.phase = 'starting';
    s.countdownEndsAt = Date.now() + this.countdownMs;
    void this.lock();
    this.broadcast('lobby', { t: 'matchStarting', countdown: Math.round(this.countdownMs / 1000), endsAt: s.countdownEndsAt } satisfies LobbyServerMessage);
    this.clock.setTimeout(() => void this.launch(client), this.countdownMs);
  }

  private async launch(hostClient: Client): Promise<void> {
    const s = this.state;
    const ok = validateStart(this.lobbyPlayers(), s.hostId);
    if (!ok.ok || s.phase !== 'starting') {
      s.phase = 'open';
      void this.unlock();
      this.reject(hostClient, 'startMatch', ok.ok ? 'start cancelled' : ok.reason);
      return;
    }
    const seats: SeatInput[] = [...s.players.values()].map((p) => ({ playerId: p.id, name: p.name, team: p.team, machine: p.machine, slot: p.slot }));
    const room = await matchMaker.createRoom('match', {
      key: internalRoomKey(), seats, settings: s.settings.toSettings(), seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0,
      lobbyRoomId: this.roomId, reconnectWindowSec: this.windowSec, cosmetics: Object.fromEntries(seats.map((x) => [x.playerId, this.loadouts.get(x.playerId) ?? DEFAULT_LOADOUT])),
      introDelayMs: this.testTiming?.introDelayMs, waitForPlayersMs: this.testTiming?.waitForPlayersMs,
    });
    s.matchId = room.roomId;
    s.phase = 'inMatch';
    for (const c of this.clients) if (isRoomAuth(c.auth)) await this.sendMatchSeat(c, c.auth);
  }

  /** Gives a lobby client its seat in the running match (also after a lobby reconnect). */
  private async sendMatchSeat(client: Client, auth: RoomAuth): Promise<void> {
    const s = this.state;
    if (s.phase !== 'inMatch' || !s.matchId) return;
    try {
      const room = await matchMaker.getRoomById(s.matchId);
      if (!room) return;
      const reservation = await matchMaker.reserveSeatFor(room, {}, auth);
      client.send('lobby', { t: 'matchReady', matchId: s.matchId, reservation } satisfies LobbyServerMessage);
    } catch (e) {
      console.warn('[lobby] could not reserve a match seat', e);
    }
  }

  // ---------------------------------------------------------------- helpers

  /** Guests own the default items until accounts and the store exist (Phase 4 swaps in the inventory). */
  private setLoadout(userId: string, raw: unknown): CosmeticLoadout {
    const l = sanitizeLoadout(raw, OWNED_BY_GUESTS);
    this.loadouts.set(userId, l);
    return l;
  }

  private removePlayer(userId: string, line: string): void {
    const s = this.state;
    const p = s.players.get(userId);
    if (!p) return;
    const wasHost = p.isHost;
    s.players.delete(userId);
    this.chatLimit.forget(userId);
    this.loadouts.delete(userId);
    this.system(line);
    if (wasHost) this.reassignHost();
    if (s.phase === 'starting') { s.phase = 'open'; void this.unlock(); this.system('Countdown cancelled — a player left'); }
    void this.syncMetadata();
  }

  private reassignHost(): void {
    const s = this.state;
    const next = transferHost(this.lobbyPlayers()).find((p) => p.isHost && p.connected);
    if (!next) return;
    for (const p of s.players.values()) p.isHost = p.id === next.id;
    s.hostId = next.id;
    this.system(`${next.name} is now the host`);
    void this.syncMetadata();
  }

  private lobbyPlayers(): LobbyPlayer[] {
    return [...this.state.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, slot: p.slot, machine: p.machine as MachineId, ready: p.ready, connected: p.connected, isHost: p.isHost, joinedAt: p.joinedAt }));
  }

  private playerOf(client: Client): LobbyPlayerSchema | undefined {
    const id = this.sessions.get(client.sessionId);
    return id ? this.state.players.get(id) : undefined;
  }

  private chat(playerId: string, name: string, team: TeamId | 'system', text: string): void {
    const line = new ChatLineSchema();
    Object.assign(line, { id: this.chatSeq++, playerId, name, team, text, at: Date.now() });
    this.state.chat.push(line);
    while (this.state.chat.length > CHAT_KEEP) this.state.chat.shift();
  }

  private system(text: string): void { this.chat('', '', 'system', text); }

  private reject(client: Client, intent: LobbyIntent['t'], reason: string): void {
    client.send('lobby', { t: 'rejected', intent, reason } satisfies LobbyServerMessage);
  }

  private async syncMetadata(): Promise<void> {
    const s = this.state;
    const host = s.players.get(s.hostId);
    const meta: Omit<PublicRoomInfo, 'roomId' | 'players' | 'maxPlayers'> = { code: s.code, name: s.name, mode: s.settings.mode, mapId: s.settings.mapId, hostName: host?.name ?? '', ranked: s.ranked };
    await this.setMetadata(meta);
  }
}
