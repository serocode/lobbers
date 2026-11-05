import type { MachineId, MatchSettings, TeamId } from '../types.ts';
import { DEFAULT_SETTINGS, HOST_RULES, ROOM_LIMITS } from '../config/match.ts';
import { canJoinRoom, canSwitchTeam, freeSlot, pickTeam, teamCount, validateStart, type LobbyPlayer } from '../lobby.ts';
import type { ChatLine, LobbyIntent, LobbyView, PeerProfile } from '../protocol.ts';
import type { Verdict } from '../rules.ts';
import type { SeatInput } from '../sim/world.ts';
import type { HostClock } from './clock.ts';

/**
 * Authoritative room state, run in the HOST's browser (replaces the Colyseus LobbyRoom). The host player is fixed:
 * in peer-to-peer the host IS the server, so if the host leaves the room closes (no host transfer).
 */
export interface HostLobbyOptions {
  code: string;
  name: string;
  host: PeerProfile;
  clock: HostClock;
  settings?: MatchSettings;
  /** Called whenever the view changes (HostSession broadcasts `lobbyState` and persists). */
  onChange: () => void;
  /** Countdown finished — HostSession creates the HostMatch. */
  onStart: (seats: SeatInput[], settings: MatchSettings) => void;
  /** A player was kicked — HostSession closes their link. */
  onKick: (playerId: string) => void;
  /** Countdown started. */
  onStarting?: (countdown: number) => void;
}

const no = (reason: string): Verdict => ({ ok: false, reason });
const yes: Verdict = { ok: true, value: undefined };

export class HostLobby {
  readonly code: string;
  name: string;
  readonly hostId: string;
  settings: MatchSettings;
  players: LobbyPlayer[] = [];
  chat: ChatLine[] = [];
  phase: LobbyView['phase'] = 'open';
  private chatTimes = new Map<string, number[]>();
  private countdown: unknown = null;

  private readonly opts: HostLobbyOptions;

  constructor(opts: HostLobbyOptions) {
    this.opts = opts;
    this.code = opts.code;
    this.name = opts.name;
    this.hostId = opts.host.id;
    this.settings = { ...(opts.settings ?? DEFAULT_SETTINGS) };
    this.add(opts.host, true);
  }

  view(): LobbyView {
    return { code: this.code, name: this.name, hostId: this.hostId, settings: { ...this.settings }, players: this.players.map((p) => ({ ...p })), chat: [...this.chat], phase: this.phase };
  }

  has(playerId: string): boolean { return this.players.some((p) => p.id === playerId); }

  join(profile: PeerProfile): Verdict {
    if (this.phase !== 'open') return no('match in progress');
    if (this.has(profile.id)) return no('already joined');
    const room = canJoinRoom(this.players);
    if (!room.ok) return no(room.reason);
    this.add(profile, false);
    this.system(`${profile.name} joined`);
    this.opts.onChange();
    return yes;
  }

  /** Leaving the lobby (closed tab, Leave button, kick). The host leaving closes the room — handled by HostSession. */
  leave(playerId: string): void {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || p.isHost) return;
    this.players = this.players.filter((x) => x.id !== playerId);
    if (this.phase === 'starting') this.cancelCountdown('a player left');
    this.system(`${p.name} left`);
    this.opts.onChange();
  }

  handle(playerId: string, intent: LobbyIntent): Verdict {
    const me = this.players.find((p) => p.id === playerId);
    if (!me) return no('not in this room');
    if (this.phase === 'inMatch') return no('match in progress');
    const hostOnly = intent.t === 'updateSettings' || intent.t === 'kick' || intent.t === 'startMatch';
    if (hostOnly && !me.isHost) return no('only the host can do that');
    if (this.phase === 'starting' && intent.t !== 'chat') return no('match is starting');
    switch (intent.t) {
      case 'setTeam': {
        const v = canSwitchTeam(this.players, playerId, intent.team);
        if (!v.ok) return no(v.reason);
        me.team = intent.team; me.slot = freeSlot(this.players.filter((p) => p.id !== playerId), intent.team); me.ready = false;
        break;
      }
      case 'setMachine': me.machine = intent.machine; break;
      case 'setReady': if (me.isHost) return no('the host does not ready up'); me.ready = intent.ready; break;
      case 'updateSettings':
        this.settings = { ...this.settings, ...intent.patch };
        for (const p of this.players) if (!p.isHost) p.ready = false;   // settings changed → everyone re-confirms
        break;
      case 'kick': {
        if (intent.playerId === playerId) return no('cannot kick yourself');
        const p = this.players.find((x) => x.id === intent.playerId);
        if (!p) return no('unknown player');
        this.players = this.players.filter((x) => x.id !== p.id);
        this.system(`${p.name} was removed by the host`);
        this.opts.onKick(p.id);
        break;
      }
      case 'startMatch': {
        const v = validateStart(this.players, playerId);
        if (!v.ok) return no(v.reason);
        this.phase = 'starting';
        this.opts.onStarting?.(HOST_RULES.startCountdownSec);
        this.countdown = this.opts.clock.setTimeout(() => {
          this.countdown = null;
          this.phase = 'inMatch';
          this.opts.onChange();
          this.opts.onStart(this.seats(), { ...this.settings });
        }, HOST_RULES.startCountdownSec * 1000);
        break;
      }
      case 'chat': {
        const now = this.opts.clock.now();
        const recent = (this.chatTimes.get(playerId) ?? []).filter((t) => now - t < 1000);
        if (recent.length >= ROOM_LIMITS.chatRateLimitPerSec) return no('slow down');
        recent.push(now); this.chatTimes.set(playerId, recent);
        this.push({ from: playerId, name: me.name, text: intent.text, at: now });
        break;
      }
    }
    this.opts.onChange();
    return yes;
  }

  /** After the match: back to the room with the same players (Play again). Ready flags reset. */
  backToRoom(): void {
    this.phase = 'open';
    for (const p of this.players) p.ready = false;
    this.opts.onChange();
  }

  setConnected(playerId: string, connected: boolean): void {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    this.opts.onChange();
  }

  seats(): SeatInput[] {
    return this.players.map((p) => ({ playerId: p.id, name: p.name, team: p.team, machine: p.machine, slot: p.slot }));
  }

  dispose(): void { if (this.countdown !== null) this.opts.clock.clearTimeout(this.countdown); }

  /** Restores lobby fields from a host snapshot. */
  load(v: LobbyView): void {
    this.name = v.name; this.settings = { ...v.settings }; this.chat = [...v.chat];
    this.phase = v.phase === 'starting' ? 'open' : v.phase;
    // Mid-match: keep every seat (they reconnect with their tokens). In the room: only the host; others simply re-join.
    const keep = this.phase === 'inMatch' ? v.players : v.players.filter((p) => p.id === this.hostId);
    this.players = keep.map((p) => ({ ...p, connected: p.id === this.hostId }));
  }

  // ------------------------------------------------------------------
  private add(profile: PeerProfile, isHost: boolean): void {
    const team: TeamId = isHost ? 'red' : pickTeam(this.players);
    const t = teamCount(this.players, team) < ROOM_LIMITS.maxPerTeam ? team : (team === 'red' ? 'blue' : 'red');
    const machine: MachineId = profile.favoriteMachine;
    this.players.push({
      id: profile.id, name: profile.name, team: t, slot: freeSlot(this.players, t), machine, ready: false, connected: true, isHost,
      joinedAt: this.opts.clock.now(), level: profile.level, rating: profile.rating, title: profile.title, cosmetics: profile.cosmetics,
    });
  }

  private cancelCountdown(why: string): void {
    if (this.countdown !== null) this.opts.clock.clearTimeout(this.countdown);
    this.countdown = null;
    this.phase = 'open';
    this.system(`Start cancelled — ${why}`);
  }

  private system(text: string): void { this.push({ from: null, name: 'SYSTEM', text, at: this.opts.clock.now() }); }
  private push(line: ChatLine): void { this.chat.push(line); if (this.chat.length > 20) this.chat.shift(); }
}
