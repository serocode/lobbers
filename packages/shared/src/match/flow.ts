// The authoritative match state machine (docs/ARCHITECTURE.md § MatchController), shared by the
// server MatchRoom and the client's hot-seat controller so there is exactly one implementation.
// waiting → acting ⇄ (move/jump/ability) → resolving (shot) → acting (extra shot) | turnEnd → next turn | ended
// Disconnects, skipped turns, AFK timeouts and forfeits follow CONNECTION_RULES.
import type { MatchSettings, ShotModifier, UnitState } from '../types.ts';
import type { ActionKind, MatchEndedMsg, MatchIntent, MatchStartedMsg, MatchStateView, ServerMessage, TurnStartedMsg } from '../protocol.ts';
import { CONNECTION_RULES, EMOTE_RULES, TURN_RULES } from '../config/match.ts';
import { DEFAULT_LOADOUT, resolveCosmetics, type CosmeticLoadout, type UnitCosmetics } from '../config/cosmetics.ts';
import { CAMERA } from '../config/camera.ts';
import { canUseWeapon, checkActor, commitFire, validateFire, type ActiveTurn } from '../rules.ts';
import { computeResults } from '../rewards.ts';
import { activateAbility, canActivate } from '../sim/abilities.ts';
import type { SimEvent } from '../sim/events.ts';
import { jump, walk } from '../sim/movement.ts';
import { createRng, type Rng } from '../sim/rng.ts';
import { resolveShot } from '../sim/shot.ts';
import { advanceTurn, beginTurn, endTurn, initialTurnState, matchWinner, type TurnState } from '../sim/turns.ts';
import { createWorld, unitById, type SeatInput, type World } from '../sim/world.ts';
import { MatchTally } from './tally.ts';

export interface FlowClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface FlowSink {
  /** `to` = the only player who should receive it (rejections); otherwise broadcast. */
  message(msg: ServerMessage, to?: string): void;
  state(view: MatchStateView): void;
}

export interface MatchFlowOptions {
  settings: MatchSettings;
  seats: SeatInput[];
  seed: number;
  clock: FlowClock;
  sink: FlowSink;
  /** Delay before the first turn so the intro overview can play. */
  introDelayMs?: number;
  /** Reconnect window (defaults to CONNECTION_RULES.reconnectWindowSec). */
  reconnectWindowMs?: number;
  /** Sanitised cosmetic loadouts per player id (default loadout when missing). */
  cosmetics?: Record<string, CosmeticLoadout>;
}

export type ForfeitReason = 'surrender' | 'disconnect' | 'afk';

const MAX_MOVE_TICKS = 10;

interface PlayerConn { offlineUntil: number; skips: number; timeouts: number; timer: unknown; lastEmote: number }

export class MatchFlow {
  readonly world: World;
  private readonly rng: Rng;
  private readonly clock: FlowClock;
  private readonly sink: FlowSink;
  private ts: TurnState = initialTurnState();
  private turn: ActiveTurn | null = null;
  private actedThisTurn = false;
  private modifiers: ShotModifier[] = [];
  private actionId = 0;
  private timers = new Set<unknown>();
  private turnTimer: unknown = null;
  private startedAt = 0;
  private started = false;
  private ended: MatchEndedMsg | null = null;
  private idle = false;
  private disposed = false;
  private lastTurn: TurnStartedMsg | null = null;
  private readonly conns = new Map<string, PlayerConn>();
  private readonly tally = new MatchTally();
  private readonly cosmetics: Record<string, UnitCosmetics> = {};

  private readonly opts: MatchFlowOptions;

  constructor(opts: MatchFlowOptions) {
    this.opts = opts;
    this.world = createWorld(opts.settings, opts.seats);
    this.rng = createRng(opts.seed);
    this.clock = opts.clock;
    this.sink = opts.sink;
    for (const s of opts.seats) this.conns.set(s.playerId, { offlineUntil: 0, skips: 0, timeouts: 0, timer: null, lastEmote: -Infinity });
    for (const u of this.world.units) this.cosmetics[u.id] = resolveCosmetics(opts.cosmetics?.[u.playerId] ?? DEFAULT_LOADOUT, u.machine);
  }

  get isEnded(): boolean { return this.ended !== null; }
  get result(): MatchEndedMsg | null { return this.ended; }
  get activePlayerId(): string | null { return this.turn?.playerId ?? null; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.clock.now();
    this.emit({ t: 'matchStarted', data: this.startSnapshot() });
    this.pushState('waiting');
    this.later(() => this.turnStart(), this.opts.introDelayMs ?? CAMERA.introOverviewMs + 400);
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.timers) this.clock.clearTimeout(t);
    this.timers.clear();
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    for (const c of this.conns.values()) if (c.timer) this.clock.clearTimeout(c.timer);
  }

  /** Full snapshot for `matchStarted` (first join and every reconnect). */
  startSnapshot(): MatchStartedMsg {
    const w = this.world;
    return {
      mapId: w.map.id, width: w.map.width, height: w.map.height, terrainRLE: w.terrain.encodeRLE(), terrainHash: w.terrain.hash(),
      units: this.snapshot(), settings: w.settings, props: w.props.map((p) => ({ ...p })), burnZones: w.burnZones.map((z) => ({ ...z })), wind: w.wind,
      cosmetics: structuredClone(this.cosmetics),
    };
  }

  /** The current turn for a reconnecting client (upkeep events stripped: they already happened). */
  currentTurn(): TurnStartedMsg | null {
    if (!this.lastTurn || !this.turn) return null;
    return { ...this.lastTurn, events: [], skipped: [], burnZones: this.world.burnZones.map((z) => ({ ...z })), wind: this.world.wind };
  }

  view(phase?: MatchStateView['phase']): MatchStateView {
    const offline: Record<string, number> = {};
    for (const [id, c] of this.conns) if (c.offlineUntil) offline[id] = c.offlineUntil;
    return {
      phase: phase ?? (this.ended ? 'ended' : this.turn?.phase ?? 'waiting'), turnNumber: this.world.turnNumber, activeUnitId: this.turn?.unitId ?? null,
      endsAt: this.turn?.endsAt ?? 0, wind: this.world.wind, shotsLeft: this.turn?.shotsLeft ?? 0, offline,
    };
  }

  // ---------------------------------------------------------------- connection

  disconnected(playerId: string): void {
    const c = this.conns.get(playerId);
    if (!c || this.ended || !this.unitOf(playerId)?.alive) return;
    const window = this.opts.reconnectWindowMs ?? CONNECTION_RULES.reconnectWindowSec * 1000;
    c.offlineUntil = this.clock.now() + window;
    if (c.timer) this.clock.clearTimeout(c.timer);
    c.timer = this.clock.setTimeout(() => this.forfeit(playerId, 'disconnect'), window);
    this.pushState();
    if (this.turn?.playerId === playerId && this.turn.phase === 'acting') this.turnEnd();
  }

  reconnected(playerId: string): void {
    const c = this.conns.get(playerId);
    if (!c || !c.offlineUntil) return;
    c.offlineUntil = 0;
    c.skips = 0;
    if (c.timer) { this.clock.clearTimeout(c.timer); c.timer = null; }
    this.pushState();
    if (this.idle && !this.ended) { this.idle = false; this.turnStart(); }
  }

  /** Removes the player's unit from the match (counts as a loss). Idempotent. */
  forfeit(playerId: string, _reason: ForfeitReason): void {
    const u = this.unitOf(playerId);
    const c = this.conns.get(playerId);
    if (c?.timer) { this.clock.clearTimeout(c.timer); c.timer = null; }
    // A forfeited player stays in `offline` (their unit is a wreck, so nothing renders it) — clearing it
    // would read as "reconnected" on clients.
    if (!u || !u.alive || this.ended || this.disposed) return;
    u.alive = false;
    u.hp = 0;
    const events: SimEvent[] = [{ t: 'eliminated', tick: 0, unitId: u.id, byUnitId: null, cause: 'forfeit' }];
    this.emitAction(u.id, 'forfeit', events, 0);
    const wasActive = this.turn?.unitId === u.id;
    if (matchWinner(this.world.units) !== null) {
      // Mid-shot the resolve timer ends the match once the animation has played; otherwise end now.
      if (this.turn?.phase !== 'resolving') this.end();
      return;
    }
    if (wasActive && this.turn?.phase === 'acting') this.turnEnd();
    else this.pushState();
  }

  // ---------------------------------------------------------------- intents

  handle(playerId: string, intent: MatchIntent): void {
    if (intent.t === 'forfeit') return this.forfeit(playerId, 'surrender');
    if (intent.t === 'emote') return this.emote(playerId, intent.slot);
    const now = this.clock.now();
    const actor = checkActor(this.world, this.turn, playerId, now);
    if (!actor.ok) return this.reject(intent.t, actor.reason, playerId);
    const unitId = actor.value;
    switch (intent.t) {
      case 'aim':
        return this.emit({ t: 'aimUpdate', unitId, angle: intent.angle, power: intent.power, weaponId: intent.weaponId });
      case 'selectWeapon': {
        const ok = canUseWeapon(this.world, unitId, intent.weaponId);
        if (!ok.ok) this.reject(intent.t, ok.reason, playerId);
        return;
      }
      case 'move': {
        if (intent.dir !== 1 && intent.dir !== -1) return this.reject(intent.t, 'bad direction', playerId);
        const ticks = Math.max(1, Math.min(MAX_MOVE_TICKS, Math.floor(Number(intent.ticks) || 0)));
        const r = walk(this.world, unitId, intent.dir, ticks, this.rng);
        this.acted(playerId);
        return this.resolved(unitId, 'move', r.events, r.durationTicks);
      }
      case 'jump': {
        const r = jump(this.world, unitId, this.rng);
        if (r.durationTicks === 0 && r.events.length === 0) return this.reject(intent.t, 'cannot jump now', playerId);
        this.acted(playerId);
        return this.resolved(unitId, 'jump', r.events, r.durationTicks);
      }
      case 'useAbility': {
        const ok = canActivate(this.world, unitId, intent.slot);
        if (!ok.ok) return this.reject(intent.t, ok.reason, playerId);
        const r = activateAbility(this.world, unitId, intent.slot, this.rng);
        for (const m of r.modifiers) if (m.extraShots && this.turn) this.turn.shotsLeft += m.extraShots;
        this.modifiers.push(...r.modifiers);
        this.acted(playerId);
        return this.resolved(unitId, 'ability', r.events, r.durationTicks);
      }
      case 'fire': return this.fire(playerId, unitId, intent, now);
      case 'skipTurn':
        this.acted(playerId);
        return this.turnEnd();
    }
  }

  /** Any seated player, any time (not only on their turn): one of their equipped emotes, rate-limited. */
  private emote(playerId: string, slot: number): void {
    const u = this.unitOf(playerId), c = this.conns.get(playerId);
    if (!u || !c || this.ended) return;
    const emoteId = this.cosmetics[u.id]?.emotes[slot];
    if (!Number.isInteger(slot) || !emoteId) return this.reject('emote', 'no emote in that slot', playerId);
    const now = this.clock.now();
    if (now - c.lastEmote < EMOTE_RULES.cooldownMs) return this.reject('emote', 'slow down', playerId);
    c.lastEmote = now;
    this.emit({ t: 'emote', unitId: u.id, emoteId });
  }

  private fire(playerId: string, unitId: string, intent: Extract<MatchIntent, { t: 'fire' }>, now: number): void {
    const v = validateFire(this.world, this.turn, playerId, intent.aim, now);
    if (!v.ok || !this.turn) return this.reject('fire', v.ok ? 'no turn' : v.reason, playerId);
    this.acted(playerId);
    commitFire(this.world, unitId, v.value.weaponId);
    const result = resolveShot(this.world, unitId, v.value, this.modifiers, this.rng);
    this.modifiers = [];
    this.turn.shotsLeft--;
    this.turn.phase = 'resolving';
    this.tally.shot(this.world.turnNumber, unitId, v.value.weaponId, result.events, this.world.units);
    this.emit({ t: 'actionResolved', data: { actionId: ++this.actionId, unitId, kind: 'shot', result, units: this.snapshot() } });
    this.pushState();
    const wait = (result.durationTicks / 60) * 1000 + TURN_RULES.resolveGraceSec * 1000;
    this.later(() => this.afterShot(unitId), wait);
  }

  private afterShot(unitId: string): void {
    const t = this.turn;
    if (matchWinner(this.world.units) !== null) return this.turnEnd();
    if (!t || t.unitId !== unitId) return;
    const u = unitById(this.world, unitId);
    if (u.alive && t.shotsLeft > 0 && this.clock.now() < t.endsAt && !this.isOffline(u.playerId)) {
      t.phase = 'acting';
      this.pushState();
      return;
    }
    this.turnEnd();
  }

  /** Move / jump / ability: applied at once; the unit may die (void, lava) which ends the turn. */
  private resolved(unitId: string, kind: 'move' | 'jump' | 'ability', events: SimEvent[], durationTicks: number): void {
    this.tally.events(this.world.turnNumber, events, this.world.units);
    this.emitAction(unitId, kind, events, durationTicks);
    if (!unitById(this.world, unitId).alive || matchWinner(this.world.units) !== null) {
      if (this.turn) this.turn.phase = 'resolving';
      this.pushState();
      this.later(() => this.turnEnd(), (durationTicks / 60) * 1000 + TURN_RULES.resolveGraceSec * 1000);
    }
  }

  // ---------------------------------------------------------------- turn loop

  private turnStart(): void {
    if (this.disposed || this.ended) return;
    const next = advanceTurn(this.world.units, this.ts, (u) => u.alive && !this.isOffline(u.playerId));
    if (!next.activeUnitId) {
      // Everyone left is offline: wait for a reconnect or a forfeit (no turn happened, so nothing is skipped).
      this.idle = true;
      this.turn = null;
      this.pushState('waiting');
      return;
    }
    for (const id of next.skipped) this.skip(id);
    if (matchWinner(this.world.units) !== null) return this.end();
    this.ts = next.state;
    const u = unitById(this.world, next.activeUnitId);
    const events = beginTurn(this.world, u.id, this.rng);
    this.tally.events(this.world.turnNumber, events, this.world.units);
    const endsAt = this.clock.now() + this.world.settings.turnSeconds * 1000;
    this.turn = { unitId: u.id, playerId: u.playerId, phase: 'acting', shotsLeft: TURN_RULES.shotsPerTurn, endsAt };
    this.actedThisTurn = false;
    this.modifiers = [];
    this.lastTurn = {
      turnNumber: this.world.turnNumber, activeUnitId: u.id, wind: this.world.wind, endsAt, skipped: next.skipped, events,
      burnZones: this.world.burnZones.map((z) => ({ ...z })),
    };
    this.emit({ t: 'turnStarted', data: this.lastTurn });
    if (!u.alive || matchWinner(this.world.units) !== null) {
      // Burned out during upkeep: show it, then move on.
      this.turn.phase = 'resolving';
      this.pushState();
      this.later(() => this.turnEnd(), 1600);
      return;
    }
    this.pushState();
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    this.turnTimer = this.clock.setTimeout(() => this.onTimeout(u.id), endsAt - this.clock.now() + 50);
  }

  private skip(unitId: string): void {
    const u = unitById(this.world, unitId);
    const c = this.conns.get(u.playerId);
    if (!c) return;
    c.skips++;
    if (c.skips >= CONNECTION_RULES.maxSkippedTurnsWhileDisconnected) this.forfeit(u.playerId, 'disconnect');
  }

  private onTimeout(unitId: string): void {
    if (this.turn?.unitId !== unitId || this.turn.phase !== 'acting') return;
    const playerId = this.turn.playerId;
    const c = this.conns.get(playerId);
    if (c && !this.actedThisTurn) {
      c.timeouts++;
      if (c.timeouts >= CONNECTION_RULES.maxConsecutiveTimeouts) return this.forfeit(playerId, 'afk');
    }
    this.turnEnd();
  }

  private turnEnd(): void {
    if (!this.turn || this.disposed) return;
    if (this.turnTimer) { this.clock.clearTimeout(this.turnTimer); this.turnTimer = null; }
    endTurn(this.world, this.turn.unitId);
    this.turn = null;
    if (matchWinner(this.world.units) !== null) return this.end();
    this.turnStart();
  }

  private end(): void {
    if (this.ended) return;
    if (this.turnTimer) { this.clock.clearTimeout(this.turnTimer); this.turnTimer = null; }
    const winner = matchWinner(this.world.units) ?? 'draw';
    this.turn = null;
    const players = computeResults(this.world.units, winner);
    this.ended = {
      winner, turns: this.world.turnNumber, durationSec: Math.round((this.clock.now() - this.startedAt) / 1000), players,
      mapId: this.world.map.id, mode: this.world.settings.mode, mvpHighlight: this.tally.highlight(players.find((p) => p.mvp)?.unitId ?? ''),
      details: this.tally.details(),
    };
    this.pushState('ended');
    this.emit({ t: 'matchEnded', data: this.ended });
  }

  // ---------------------------------------------------------------- plumbing

  private acted(playerId: string): void {
    this.actedThisTurn = true;
    const c = this.conns.get(playerId);
    if (c) c.timeouts = 0;
  }

  private isOffline(playerId: string): boolean { return (this.conns.get(playerId)?.offlineUntil ?? 0) > 0; }
  private unitOf(playerId: string): UnitState | undefined { return this.world.units.find((u) => u.playerId === playerId); }
  private snapshot(): UnitState[] { return this.world.units.map((u) => structuredClone(u)); }

  private emitAction(unitId: string, kind: ActionKind, events: SimEvent[], durationTicks: number): void {
    this.emit({ t: 'actionResolved', data: { actionId: ++this.actionId, unitId, kind, result: { events, durationTicks, terrainHash: this.world.terrain.hash() }, units: this.snapshot() } });
  }

  private pushState(phase?: MatchStateView['phase']): void { if (!this.disposed) this.sink.state(this.view(phase)); }
  private emit(msg: ServerMessage): void { if (!this.disposed) this.sink.message(msg); }
  private reject(intent: MatchIntent['t'], reason: string, playerId: string): void { if (!this.disposed) this.sink.message({ t: 'rejected', intent, reason }, playerId); }

  private later(fn: () => void, ms: number): void {
    const t = this.clock.setTimeout(() => { this.timers.delete(t); if (!this.disposed) fn(); }, ms);
    this.timers.add(t);
  }
}
