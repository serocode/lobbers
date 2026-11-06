// Hot Seat (DESIGN_SPEC §3.9): the same HostSession as online play, with no network. Every seat is a
// PeerClient over connectLoopback; the battle shows seat 0's stream and sends each intent through the seat
// whose turn it is. The room is set up through real lobby intents (teams, machines, settings, ready, start).
// Bot seats (DESIGN_SPEC §3.11) are added by the first human with `addBot` and play themselves inside the HostSession.
import {
  HOST_RULES, HostSession, PeerClient, connectLoopback, createRng, realClock, type BotDifficulty, type HostClock, type HostMessage, type MatchIntent, type MatchSettings,
  type MachineId, type PeerProfile, type ServerMessage, type TeamId,
} from '@lobbers/shared';
import { EMPTY_STATE, type MatchStateView, type MatchTransport, type MatchTransportListener } from '../MatchTransport';
import { stateFromView } from '../p2p/MatchFeed';

export interface HotSeatSeat { name: string; team: TeamId; machine: MachineId; cosmetics: Record<string, string>; /** Played by the computer. */ bot?: BotDifficulty }
export interface HotSeatOptions { settings: MatchSettings; seats: HotSeatSeat[]; clock?: HostClock; /** Match seed source (reproducible hot-seat links). */ seed?: number }

const FORWARD = new Set<HostMessage['t']>(['matchStarted', 'turnStarted', 'actionResolved', 'aimUpdate', 'emote', 'matchEnded']);
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export class HotSeat implements MatchTransport {
  readonly kind = 'local' as const;
  readonly localPlayerIds: ReadonlySet<string>;
  readonly session: HostSession;
  private readonly clients: PeerClient[] = [];
  private history: ServerMessage[] = [];
  private state: MatchStateView = EMPTY_STATE;
  private listeners = new Set<MatchTransportListener>();
  private started = false;
  private disposed = false;
  private readonly clock: HostClock;
  private readonly profiles: PeerProfile[];
  /** The human seats, in the same order as `profiles` / `clients`. */
  private readonly humans: HotSeatSeat[];
  private readonly bots: HotSeatSeat[];

  constructor(private readonly opts: HotSeatOptions) {
    this.clock = opts.clock ?? realClock;
    const humans = opts.seats.filter((s) => !s.bot);
    // Someone has to hold the device: with no human seat, the first seat is played by a person.
    this.humans = humans.length ? humans : opts.seats.slice(0, 1).map((s) => ({ ...s, bot: undefined }));
    this.bots = (humans.length ? opts.seats : opts.seats.slice(1)).filter((s) => s.bot);
    this.profiles = this.humans.map((s, i) => ({ id: `seat-${i}`, name: s.name, level: 1, rating: 1000, title: null, avatar: null, favoriteMachine: s.machine, cosmetics: s.cosmetics }));
    this.localPlayerIds = new Set(this.profiles.map((p) => p.id));
    const rng = createRng(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.session = new HostSession({ code: 'LOB-SEAT', roomName: 'Hot seat', host: this.profiles[0], clock: this.clock, settings: opts.settings, random: () => rng.next() });
  }

  subscribe(l: MatchTransportListener): () => void {
    this.listeners.add(l);
    for (const m of this.history) l.message(m);
    l.state(this.state);
    return () => this.listeners.delete(l);
  }

  serverNow(): number { return this.clock.now(); }

  /** Seats join the room, take their teams/machines, everyone readies, seat 0 starts. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.setup();
  }

  ready(): void { for (const c of this.clients) c.send({ t: 'loaded' }); }

  /** Intents go through the active seat's own link (the host binds identity to the link). */
  send(intent: MatchIntent): void {
    const active = this.session.match?.turn?.playerId ?? this.clients[0]?.playerId;
    (this.clients.find((c) => c.playerId === active) ?? this.clients[0])?.send(intent);
  }

  dispose(): void {
    this.disposed = true;
    this.session.close();
    this.listeners.clear();
  }

  private async setup(): Promise<void> {
    this.profiles.forEach((profile, i) => {
      const c = new PeerClient({ code: 'LOB-SEAT', profile, clock: this.clock });
      this.clients.push(c);
      if (i === 0) c.on('*', (m) => this.onMessage(m));
      else c.on('rejected', (m) => this.onMessage(m));
      connectLoopback(this.session, c, { local: i === 0 });
    });
    await tick();
    // Teams: move wrong-team seats while the target side has room (a few passes settle any order).
    for (let pass = 0; pass < 3; pass++) {
      for (const [i, s] of this.humans.entries()) {
        const p = this.session.lobby.players.find((x) => x.id === this.profiles[i].id);
        if (p && p.team !== s.team) this.clients[i].send({ t: 'setTeam', team: s.team });
      }
      await tick();
    }
    for (const b of this.bots) this.clients[0].send({ t: 'addBot', team: b.team, difficulty: b.bot ?? 'normal', machine: b.machine });
    this.clients.forEach((c, i) => c.send({ t: 'setMachine', machine: this.humans[i].machine }));
    this.clients[0].send({ t: 'updateSettings', patch: this.opts.settings });
    await tick();
    this.clients.slice(1).forEach((c) => c.send({ t: 'setReady', ready: true }));
    await tick();
    if (!this.disposed) this.clients[0].send({ t: 'startMatch' });
  }

  private onMessage(m: HostMessage): void {
    if (this.disposed) return;
    if (m.t === 'matchState') {
      this.state = stateFromView(m.data);
      for (const l of this.listeners) l.state(this.state);
      return;
    }
    if (m.t !== 'rejected' && !FORWARD.has(m.t)) return;
    const msg = m as ServerMessage;
    this.history.push(msg);
    for (const l of this.listeners) l.message(msg);
  }
}

/** Countdown between Start and the first matchStarted (the hot-seat route shows it as "Get ready…"). */
export const HOT_SEAT_COUNTDOWN_MS = HOST_RULES.startCountdownSec * 1000;
