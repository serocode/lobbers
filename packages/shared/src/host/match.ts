import type { BurnZone, MatchSettings, PropState, ShotModifier, UnitState } from '../types.ts';
import { CONNECTION_RULES, EMOTE_RULES, HOST_RULES, TURN_RULES } from '../config/match.ts';
import { ALL_COSMETIC_IDS, DEFAULT_LOADOUT, resolveCosmetics, sanitizeLoadout, type CosmeticLoadout, type UnitCosmetics } from '../config/cosmetics.ts';
import { MatchTally, type TallySnapshot } from '../match/tally.ts';
import type { HostMessage, MatchEndedMsg, MatchIntent, MatchStartedMsg, MatchView, TurnStartedMsg, ActionResolvedMsg } from '../protocol.ts';
import { canUseWeapon, checkActor, commitFire, validateFire, type ActiveTurn, type TurnPhase, type Verdict } from '../rules.ts';
import { computeResults } from '../rewards.ts';
import { activateAbility, canActivate } from '../sim/abilities.ts';
import { eliminate, type SimContext } from '../sim/combat.ts';
import type { SimEvent } from '../sim/events.ts';
import { jump, walk } from '../sim/movement.ts';
import { createRng, type Rng } from '../sim/rng.ts';
import { resolveShot } from '../sim/shot.ts';
import { Terrain } from '../sim/terrain.ts';
import { advanceTurn, beginTurn, endTurn, initialTurnState, matchWinner, type TurnState } from '../sim/turns.ts';
import { createWorld, unitById, type SeatInput, type World } from '../sim/world.ts';
import type { HostClock } from './clock.ts';

/**
 * The authoritative match, run inside the HOST's browser tab (it replaces the old Colyseus MatchRoom +
 * MatchController). Transport-agnostic: it receives already-parsed intents tagged with a playerId and emits
 * messages through `send`. Everything time-based goes through the injected clock.
 *
 *   waiting ──(all peers loaded | loadTimeout)──► acting ──fire──► resolving ──(anim + grace)──► next turn | ended
 *            acting ──timer / skipTurn / active player drops──► next turn
 */
export interface HostMatchOptions {
  matchId: string;
  settings: MatchSettings;
  seats: SeatInput[];
  seed: number;
  clock: HostClock;
  /** to = a playerId, or '*' for every connected player. */
  send: (to: string, msg: HostMessage) => void;
  onEnded?: (msg: MatchEndedMsg) => void;
  /** Called after every state change — HostSession persists `snapshot()` to localStorage here. */
  onChange?: () => void;
  /** Players connected when the match starts (default: everyone). */
  connected?: string[];
  /** Equipped cosmetics per player id (from their hello profile; ids/slots are checked, ownership can't be). */
  cosmetics?: Record<string, CosmeticLoadout>;
}

export interface HostMatchSnapshot {
  v: 1;
  matchId: string;
  settings: MatchSettings;
  seats: SeatInput[];
  rngState: number;
  terrain: { width: number; height: number; rle: number[] };
  units: UnitState[];
  props: PropState[];
  burnZones: BurnZone[];
  wind: number;
  nextId: number;
  worldTurn: number;
  recentDamage: World['recentDamage'];
  turnState: TurnState;
  phase: TurnPhase;
  turn: ActiveTurn | null;
  remainingMs: number;
  actionId: number;
  modifiers: ShotModifier[];
  skips: Record<string, number>;
  timeouts: Record<string, number>;
  startedAt: number;
  firstTurnStarted: boolean;
  wasConnected: string[];
  ended: MatchEndedMsg | null;
  /** Results tally (MVP line, damage per turn, weapon use) — survives a host refresh. */
  tally: TallySnapshot;
  cosmetics: Record<string, UnitCosmetics>;
}

const ticksToMs = (ticks: number): number => Math.ceil((ticks / 60) * 1000);

export class HostMatch {
  readonly matchId: string;
  readonly settings: MatchSettings;
  readonly seats: SeatInput[];
  world: World;
  phase: TurnPhase = 'waiting';
  turn: ActiveTurn | null = null;
  paused = false;

  private rng: Rng;
  private ts: TurnState = initialTurnState();
  private actionId = 0;
  private modifiers: ShotModifier[] = [];
  private connected = new Map<string, boolean>();
  private loaded = new Set<string>();
  private skips = new Map<string, number>();
  private timeouts = new Map<string, number>();
  private reconnectTimers = new Map<string, unknown>();
  private lastAimAt = new Map<string, number>();
  private timer: unknown = null;
  private startedAt = 0;
  private firstTurnStarted = false;
  private lastTurnStarted: TurnStartedMsg | null = null;
  private ended: MatchEndedMsg | null = null;
  private waitFor = new Set<string>();
  private remainingOnRestore = 0;
  private tally = new MatchTally();
  private cosmetics: Record<string, UnitCosmetics> = {};
  private reconnectUntil = new Map<string, number>();
  private lastEmote = new Map<string, number>();

  private readonly opts: HostMatchOptions;

  constructor(opts: HostMatchOptions, snap?: HostMatchSnapshot) {
    this.opts = opts;
    this.matchId = opts.matchId;
    this.settings = opts.settings;
    this.seats = opts.seats;
    if (!snap) {
      this.world = createWorld(opts.settings, opts.seats);
      this.rng = createRng(opts.seed);
      const on = new Set(opts.connected ?? opts.seats.map((s) => s.playerId));
      for (const s of opts.seats) this.connected.set(s.playerId, on.has(s.playerId));
      for (const u of this.world.units) this.cosmetics[u.id] = resolveCosmetics(sanitizeLoadout(opts.cosmetics?.[u.playerId] ?? DEFAULT_LOADOUT, ALL_COSMETIC_IDS), u.machine);
      return;
    }
    // ---- restore after a host refresh
    this.world = createWorld(snap.settings, snap.seats, Terrain.decodeRLE(snap.terrain.width, snap.terrain.height, snap.terrain.rle));
    Object.assign(this.world, { units: snap.units, props: snap.props, burnZones: snap.burnZones, wind: snap.wind, nextId: snap.nextId, turnNumber: snap.worldTurn, recentDamage: snap.recentDamage });
    this.rng = createRng(snap.rngState);
    this.ts = snap.turnState; this.phase = snap.phase; this.turn = snap.turn; this.actionId = snap.actionId; this.modifiers = snap.modifiers;
    this.skips = new Map(Object.entries(snap.skips)); this.timeouts = new Map(Object.entries(snap.timeouts));
    this.startedAt = snap.startedAt; this.firstTurnStarted = snap.firstTurnStarted; this.ended = snap.ended;
    this.remainingOnRestore = snap.remainingMs;
    this.tally = MatchTally.restore(snap.tally);
    this.cosmetics = snap.cosmetics ?? {};
    const on = new Set(opts.connected ?? []);
    for (const s of snap.seats) this.connected.set(s.playerId, on.has(s.playerId));
    if (this.phase === 'ended') return;
    this.paused = true;
    for (const id of snap.wasConnected) if (!on.has(id)) this.waitFor.add(id);
    for (const s of snap.seats) if (!on.has(s.playerId)) this.startReconnectWindow(s.playerId);
    if (this.waitFor.size === 0) this.resume();
    else this.timer = opts.clock.setTimeout(() => this.resume(), HOST_RULES.restoreGraceMs);
  }

  static restore(snap: HostMatchSnapshot, opts: Omit<HostMatchOptions, 'matchId' | 'settings' | 'seats' | 'seed'>): HostMatch {
    return new HostMatch({ ...opts, matchId: snap.matchId, settings: snap.settings, seats: snap.seats, seed: 0 }, snap);
  }

  // ------------------------------------------------------------------ public API
  start(): void {
    this.startedAt = this.opts.clock.now();
    this.phase = 'waiting';
    this.opts.send('*', { t: 'matchStarted', data: this.startedMsg() });
    this.broadcastView();
    this.timer = this.opts.clock.setTimeout(() => { if (!this.firstTurnStarted) this.beginNextTurn(); }, HOST_RULES.loadTimeoutMs);
    this.changed();
  }

  markLoaded(playerId: string): void {
    this.loaded.add(playerId);
    if (this.firstTurnStarted || this.paused || this.phase !== 'waiting') return;
    const everyone = this.seats.every((s) => !this.isConnected(s.playerId) || this.loaded.has(s.playerId));
    if (everyone) { this.clearTimer(); this.beginNextTurn(); }
  }

  handle(playerId: string, intent: MatchIntent): Verdict {
    const reject = (reason: string): Verdict => {
      if (intent.t !== 'aim') this.opts.send(playerId, { t: 'rejected', intent: intent.t, reason });
      return { ok: false, reason };
    };
    if (!this.connected.has(playerId)) return reject('not in this match');
    if (this.phase === 'ended') return reject('match over');
    if (this.paused) return reject('host is reconnecting');
    if (intent.t === 'forfeit') return this.forfeit(playerId) ? { ok: true, value: undefined } : reject('already out');
    if (intent.t === 'emote') return this.emote(playerId, intent.slot, reject);
    const now = this.opts.clock.now();
    const actor = checkActor(this.world, this.turn, playerId, now);
    if (!actor.ok) return reject(actor.reason);
    const uid = actor.value;
    const turn = this.turn!;
    const u = unitById(this.world, uid);
    switch (intent.t) {
      case 'aim': {
        const last = this.lastAimAt.get(playerId) ?? 0;
        if (now - last < HOST_RULES.aimRelayMs) return { ok: false, reason: 'throttled' };
        this.lastAimAt.set(playerId, now);
        this.sendOthers(playerId, { t: 'aimUpdate', unitId: uid, angle: intent.angle, power: intent.power, weaponId: intent.weaponId });
        return { ok: true, value: undefined };
      }
      case 'selectWeapon': {
        const v = canUseWeapon(this.world, uid, intent.weaponId);
        return v.ok ? { ok: true, value: undefined } : reject(v.reason);
      }
      case 'move': case 'jump': {
        const r = intent.t === 'move' ? walk(this.world, uid, intent.dir, intent.ticks, this.rng) : jump(this.world, uid, this.rng);
        if (r.durationTicks === 0 && r.events.length === 0) return reject(u.status.frozenTurns > 0 ? 'frozen' : intent.t === 'move' ? 'cannot move' : 'cannot jump');
        this.timeouts.delete(playerId);
        this.tally.events(this.ts.turnNumber, r.events, this.world.units, null, { actorId: uid });
        this.resolved(uid, intent.t, { events: r.events, durationTicks: r.durationTicks, terrainHash: this.world.terrain.hash() });
        if (!u.alive || matchWinner(this.world.units)) this.endTurnAfter(r.durationTicks);
        else this.changed();
        return { ok: true, value: undefined };
      }
      case 'useAbility': {
        const c = canActivate(this.world, uid, intent.slot);
        if (!c.ok) return reject(c.reason);
        const r = activateAbility(this.world, uid, intent.slot, this.rng);
        this.modifiers.push(...r.modifiers);
        turn.shotsLeft += r.modifiers.reduce((n, m) => n + (m.extraShots ?? 0), 0);
        this.tally.events(this.ts.turnNumber, r.events, this.world.units, null, { actorId: uid });
        this.resolved(uid, 'ability', { events: r.events, durationTicks: r.durationTicks, terrainHash: this.world.terrain.hash() });
        if (!u.alive || matchWinner(this.world.units)) this.endTurnAfter(r.durationTicks);
        else this.changed();
        return { ok: true, value: undefined };
      }
      case 'fire': {
        const v = validateFire(this.world, turn, playerId, intent.aim, now);
        if (!v.ok) return reject(v.reason);
        commitFire(this.world, uid, v.value.weaponId);
        const result = resolveShot(this.world, uid, v.value, this.modifiers, this.rng);
        this.modifiers = [];   // ability modifiers apply to the next shot only
        turn.shotsLeft--;
        this.timeouts.delete(playerId);
        this.tally.shot(this.ts.turnNumber, uid, v.value.weaponId, result.events, this.world.units, this.world.wind);
        this.resolved(uid, 'shot', result);
        if (turn.shotsLeft <= 0 || !u.alive || matchWinner(this.world.units)) this.endTurnAfter(result.durationTicks);
        else this.pauseTurnFor(result.durationTicks);
        return { ok: true, value: undefined };
      }
      case 'skipTurn':
        this.finishTurn();
        return { ok: true, value: undefined };
    }
  }

  setConnected(playerId: string, connected: boolean): void {
    if (!this.connected.has(playerId) || this.connected.get(playerId) === connected) return;
    this.connected.set(playerId, connected);
    if (connected) {
      this.clearReconnect(playerId);
      this.skips.delete(playerId);
      this.sync(playerId);
      if (this.paused) {
        this.waitFor.delete(playerId);
        if (this.waitFor.size === 0) { this.clearTimer(); this.resume(); }
      } else if (this.phase === 'waiting' && this.firstTurnStarted && !this.turn) this.beginNextTurn();
      else if (this.phase === 'waiting' && !this.firstTurnStarted) this.markLoaded(playerId);
    } else {
      if (this.phase === 'ended') return;
      this.startReconnectWindow(playerId);
      if (!this.paused && this.turn?.playerId === playerId && this.turn.phase === 'acting') this.finishTurn();
    }
    this.broadcastView();
    this.changed();
  }

  isConnected(playerId: string): boolean { return this.connected.get(playerId) === true; }
  get result(): MatchEndedMsg | null { return this.ended; }

  view(): MatchView {
    return {
      matchId: this.matchId, phase: this.phase, turnNumber: this.ts.turnNumber, activeUnitId: this.turn?.unitId ?? null,
      endsAt: this.turn?.endsAt ?? 0, wind: this.world.wind, units: structuredClone(this.world.units),
      connected: Object.fromEntries(this.connected), reconnectUntil: Object.fromEntries(this.reconnectUntil), paused: this.paused,
    };
  }

  snapshot(): HostMatchSnapshot {
    const now = this.opts.clock.now();
    return {
      v: 1, matchId: this.matchId, settings: this.settings, seats: this.seats, rngState: this.rng.state(),
      terrain: { width: this.world.terrain.width, height: this.world.terrain.height, rle: this.world.terrain.encodeRLE() },
      units: structuredClone(this.world.units), props: this.world.props.map((p) => ({ ...p })), burnZones: this.world.burnZones.map((z) => ({ ...z })),
      wind: this.world.wind, nextId: this.world.nextId, worldTurn: this.world.turnNumber, recentDamage: structuredClone(this.world.recentDamage),
      turnState: structuredClone(this.ts), phase: this.phase, turn: this.turn ? { ...this.turn } : null,
      remainingMs: this.paused ? this.remainingOnRestore : this.turn ? Math.max(0, this.turn.endsAt - now) : 0,
      actionId: this.actionId, modifiers: structuredClone(this.modifiers),
      skips: Object.fromEntries(this.skips), timeouts: Object.fromEntries(this.timeouts),
      startedAt: this.startedAt, firstTurnStarted: this.firstTurnStarted,
      wasConnected: [...this.connected].filter(([, c]) => c).map(([id]) => id), ended: this.ended,
      tally: this.tally.snapshot(), cosmetics: structuredClone(this.cosmetics),
    };
  }

  /** Stop all timers (room closed). */
  dispose(): void { this.clearTimer(); for (const id of [...this.reconnectTimers.keys()]) this.clearReconnect(id); }

  // ------------------------------------------------------------------ turn flow
  private beginNextTurn(): void {
    if (this.phase === 'ended') return;
    this.clearTimer();
    const w0 = matchWinner(this.world.units);
    if (w0) { this.end(w0); return; }
    const next = advanceTurn(this.world.units, this.ts, (u) => this.isConnected(u.playerId));
    for (const id of next.skipped) {
      const u = unitById(this.world, id);
      const n = (this.skips.get(u.playerId) ?? 0) + 1;
      this.skips.set(u.playerId, n);
      if (n >= CONNECTION_RULES.maxSkippedTurnsWhileDisconnected) this.forfeitUnit(u);
    }
    const w1 = matchWinner(this.world.units);
    if (w1) { this.end(w1); return; }
    if (!next.activeUnitId || !unitById(this.world, next.activeUnitId).alive) {
      // Nobody able to act (everyone disconnected) — wait; setConnected(true) resumes.
      this.ts = { ...this.ts, activeUnitId: null };
      this.turn = null; this.phase = 'waiting'; this.firstTurnStarted = true;
      this.broadcastView(); this.changed();
      return;
    }
    this.ts = next.state;
    this.firstTurnStarted = true;
    const id = next.activeUnitId;
    const events: SimEvent[] = beginTurn(this.world, id, this.rng);
    this.tally.events(this.ts.turnNumber, events, this.world.units, null, { actorId: id });
    const u = unitById(this.world, id);
    const endsAt = this.opts.clock.now() + this.settings.turnSeconds * 1000;
    this.turn = { unitId: id, playerId: u.playerId, phase: 'acting', shotsLeft: TURN_RULES.shotsPerTurn, endsAt };
    this.phase = 'acting';
    this.modifiers = [];
    this.lastTurnStarted = { turnNumber: this.ts.turnNumber, activeUnitId: id, wind: this.world.wind, endsAt, skipped: next.skipped, events, burnZones: this.zones() };
    this.opts.send('*', { t: 'turnStarted', data: this.lastTurnStarted });
    this.broadcastView();
    if (!u.alive || matchWinner(this.world.units)) { this.endTurnAfter(60); return; }   // burn upkeep finished them
    this.armTurnTimer();
    this.changed();
  }

  private armTurnTimer(): void {
    this.clearTimer();
    if (!this.turn) return;
    const turn = this.turn;
    this.timer = this.opts.clock.setTimeout(() => {
      if (this.turn !== turn || this.phase !== 'acting') return;
      const n = (this.timeouts.get(turn.playerId) ?? 0) + 1;
      this.timeouts.set(turn.playerId, n);
      if (n >= CONNECTION_RULES.maxConsecutiveTimeouts) this.forfeitUnit(unitById(this.world, turn.unitId));
      this.finishTurn();
    }, Math.max(0, turn.endsAt - this.opts.clock.now()));
  }

  /** The shot/move animation plays on every screen; the next turn starts after it + a short grace. */
  private endTurnAfter(durationTicks: number): void {
    this.clearTimer();
    this.phase = 'resolving';
    if (this.turn) this.turn.phase = 'resolving';
    this.broadcastView();
    this.timer = this.opts.clock.setTimeout(() => this.finishTurn(), ticksToMs(durationTicks) + TURN_RULES.resolveGraceSec * 1000);
    this.changed();
  }

  /** Extra shot granted (ability): block input while the first shot animates, then give the turn back. */
  private pauseTurnFor(durationTicks: number): void {
    this.clearTimer();
    const turn = this.turn!;
    this.phase = 'resolving'; turn.phase = 'resolving';
    this.broadcastView();
    this.timer = this.opts.clock.setTimeout(() => {
      if (this.turn !== turn) return;
      this.phase = 'acting'; turn.phase = 'acting';
      turn.endsAt = Math.max(turn.endsAt, this.opts.clock.now() + HOST_RULES.restoreMinTurnMs);
      this.broadcastView(); this.armTurnTimer(); this.changed();
    }, ticksToMs(durationTicks) + TURN_RULES.resolveGraceSec * 1000);
    this.changed();
  }

  private finishTurn(): void {
    if (this.phase === 'ended') return;
    this.clearTimer();
    if (this.turn) endTurn(this.world, this.turn.unitId);
    this.turn = null;
    this.phase = 'waiting';
    const w = matchWinner(this.world.units);
    if (w) this.end(w); else this.beginNextTurn();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.waitFor.clear();
    this.timer = null;
    if (this.phase === 'acting' && this.turn) {
      if (!this.isConnected(this.turn.playerId)) { this.finishTurn(); return; }
      this.turn.endsAt = this.opts.clock.now() + Math.max(this.remainingOnRestore, HOST_RULES.restoreMinTurnMs);
      this.lastTurnStarted = { turnNumber: this.ts.turnNumber, activeUnitId: this.turn.unitId, wind: this.world.wind, endsAt: this.turn.endsAt, skipped: [], events: [], burnZones: this.zones() };
      this.opts.send('*', { t: 'turnStarted', data: this.lastTurnStarted });
      this.broadcastView(); this.armTurnTimer(); this.changed();
    } else if (this.phase === 'resolving') this.finishTurn();
    else this.beginNextTurn();
  }

  private end(winner: MatchEndedMsg['winner']): void {
    if (this.phase === 'ended') return;
    this.clearTimer();
    for (const id of [...this.reconnectTimers.keys()]) this.clearReconnect(id);
    this.phase = 'ended';
    this.turn = null;
    const now = this.opts.clock.now();
    this.ended = {
      matchId: this.matchId, mapId: this.settings.mapId, mode: this.settings.mode, winner, turns: this.ts.turnNumber,
      durationSec: Math.round((now - this.startedAt) / 1000), endedAt: now,
      players: computeResults(this.world.units, winner).map((p) => ({ ...p, feats: this.tally.feats(p.unitId) })),
      mvpHighlight: '', details: this.tally.details(),
    };
    this.ended.mvpHighlight = this.tally.highlight(this.ended.players.find((p) => p.mvp)?.unitId ?? '');
    this.opts.send('*', { t: 'matchEnded', data: this.ended });
    this.broadcastView();
    this.opts.onEnded?.(this.ended);
    this.changed();
  }

  // ------------------------------------------------------------------ forfeits & reconnection
  private forfeit(playerId: string): boolean {
    const u = this.world.units.find((x) => x.playerId === playerId);
    if (!u || !u.alive) return false;
    this.forfeitUnit(u);
    const over = matchWinner(this.world.units) !== null;
    // While resolving, the scheduled finishTurn picks up the result.
    if (this.phase === 'acting' && (this.turn?.playerId === playerId || over)) this.finishTurn();
    else if (this.phase === 'waiting' && over) this.finishTurn();
    else this.broadcastView();
    this.changed();
    return true;
  }

  private forfeitUnit(u: UnitState): void {
    if (!u.alive) return;
    const ctx: SimContext = { world: this.world, rng: this.rng, events: [], tick: 0 };
    eliminate(ctx, u, null, 'forfeit');
    this.resolved(u.id, 'forfeit', { events: ctx.events, durationTicks: 30, terrainHash: this.world.terrain.hash() });
  }

  private startReconnectWindow(playerId: string): void {
    this.clearReconnect(playerId);
    this.reconnectUntil.set(playerId, this.opts.clock.now() + CONNECTION_RULES.reconnectWindowSec * 1000);
    this.reconnectTimers.set(playerId, this.opts.clock.setTimeout(() => {
      this.reconnectTimers.delete(playerId);
      if (this.isConnected(playerId) || this.phase === 'ended') return;
      const u = this.world.units.find((x) => x.playerId === playerId);
      if (u?.alive) {
        this.forfeitUnit(u);
        const over = matchWinner(this.world.units) !== null;
        if (this.paused) { /* resume() re-checks */ }
        else if (this.phase === 'waiting' && (over || (this.firstTurnStarted && !this.turn))) this.finishTurn();
        else if (this.phase === 'acting' && over) this.finishTurn();
        else this.broadcastView();
        this.changed();
      }
    }, CONNECTION_RULES.reconnectWindowSec * 1000));
  }

  private clearReconnect(playerId: string): void {
    const h = this.reconnectTimers.get(playerId);
    if (h !== undefined) this.opts.clock.clearTimeout(h);
    this.reconnectTimers.delete(playerId);
    if (this.isConnected(playerId)) this.reconnectUntil.delete(playerId);
  }

  // ------------------------------------------------------------------ messaging
  private resolved(unitId: string, kind: ActionResolvedMsg['kind'], result: ActionResolvedMsg['result']): void {
    this.actionId++;
    this.opts.send('*', { t: 'actionResolved', data: { actionId: this.actionId, unitId, kind, result, units: structuredClone(this.world.units), props: this.world.props.map((p) => ({ ...p })) } });
  }

  private startedMsg(): MatchStartedMsg {
    const t = this.world.terrain;
    return {
      matchId: this.matchId, mapId: this.settings.mapId, width: t.width, height: t.height, terrainRLE: t.encodeRLE(), terrainHash: t.hash(),
      units: structuredClone(this.world.units), props: this.world.props.map((p) => ({ ...p })), burnZones: this.world.burnZones.map((z) => ({ ...z })),
      wind: this.world.wind, settings: this.settings, cosmetics: structuredClone(this.cosmetics),
    };
  }

  /** Everything a (re)connecting peer needs: current terrain, units, turn and — if over — the result. */
  sync(playerId: string): void {
    this.opts.send(playerId, { t: 'matchStarted', data: this.startedMsg() });
    this.opts.send(playerId, { t: 'matchState', data: this.view() });
    if (this.turn && this.lastTurnStarted) this.opts.send(playerId, { t: 'turnStarted', data: { ...this.lastTurnStarted, endsAt: this.turn.endsAt, events: [], burnZones: this.zones() } });
    if (this.ended) this.opts.send(playerId, { t: 'matchEnded', data: this.ended });
  }

  /** Any seated player, any time (not only on their turn): one of their equipped emotes, rate-limited. */
  private emote(playerId: string, slot: number, reject: (reason: string) => Verdict): Verdict {
    const u = this.world.units.find((x) => x.playerId === playerId);
    const emoteId = u ? this.cosmetics[u.id]?.emotes[slot] : undefined;
    if (!u || !emoteId) return reject('no emote in that slot');
    const now = this.opts.clock.now();
    if (now - (this.lastEmote.get(playerId) ?? -Infinity) < EMOTE_RULES.cooldownMs) return reject('slow down');
    this.lastEmote.set(playerId, now);
    this.opts.send('*', { t: 'emote', unitId: u.id, emoteId });
    return { ok: true, value: undefined };
  }

  private zones(): BurnZone[] { return this.world.burnZones.map((z) => ({ ...z })); }

  private broadcastView(): void { this.opts.send('*', { t: 'matchState', data: this.view() }); }

  private sendOthers(playerId: string, msg: HostMessage): void {
    for (const s of this.seats) if (s.playerId !== playerId && this.isConnected(s.playerId)) this.opts.send(s.playerId, msg);
  }

  private clearTimer(): void { if (this.timer !== null) this.opts.clock.clearTimeout(this.timer); this.timer = null; }
  private changed(): void { this.opts.onChange?.(); }
}
