// Hot-seat authority: runs the same state machine the server MatchController will
// (docs/ARCHITECTURE.md § MatchController) over @lobbers/shared, in the browser.
// waiting → acting ⇄ (move/jump/ability) → resolving (shot) → acting (extra shot) | turnEnd → next turn | ended
import {
  CAMERA, TURN_RULES, activateAbility, advanceTurn, beginTurn, canActivate, checkActor, commitFire, computeResults, createRng,
  createWorld, endTurn, initialTurnState, jump, matchWinner, resolveShot, unitById, validateFire, walk, canUseWeapon,
  type ActiveTurn, type MatchIntent, type MatchSettings, type Rng, type SeatInput, type ServerMessage, type ShotModifier,
  type SimEvent, type TurnState, type World,
} from '@lobbers/shared';
import type { MatchStateView, MatchTransport, MatchTransportListener } from '../MatchTransport';

export interface LocalMatchOptions {
  settings: MatchSettings;
  seats: SeatInput[];
  seed: number;
  /** Delay before the first turn so the intro overview can play (server: "all clients loaded or 10 s"). */
  introDelayMs?: number;
  now?: () => number;
}

const MAX_MOVE_TICKS = 10;

export class LocalMatchController implements MatchTransport {
  readonly kind = 'local' as const;
  readonly localPlayerIds: ReadonlySet<string>;
  private readonly world: World;
  private readonly rng: Rng;
  private readonly now: () => number;
  private readonly listeners = new Set<MatchTransportListener>();
  private ts: TurnState = initialTurnState();
  private turn: ActiveTurn | null = null;
  private modifiers: ShotModifier[] = [];
  private actionId = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private started = false;
  private disposed = false;

  constructor(private readonly opts: LocalMatchOptions) {
    this.world = createWorld(opts.settings, opts.seats);
    this.rng = createRng(opts.seed);
    this.now = opts.now ?? Date.now;
    this.localPlayerIds = new Set(opts.seats.map((s) => s.playerId));
  }

  subscribe(l: MatchTransportListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  serverNow(): number { return this.now(); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.now();
    const w = this.world;
    this.emit({ t: 'matchStarted', data: {
      mapId: w.map.id, width: w.map.width, height: w.map.height, terrainRLE: w.terrain.encodeRLE(), terrainHash: w.terrain.hash(),
      units: this.snapshot(), settings: w.settings, props: w.props.map((p) => ({ ...p })), burnZones: [], wind: w.wind,
    } });
    this.pushState('waiting');
    this.later(() => this.turnStart(), this.opts.introDelayMs ?? CAMERA.introOverviewMs + 400);
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.listeners.clear();
  }

  // ---------------------------------------------------------------- intents
  send(intent: MatchIntent): void {
    // Hot-seat: the sender is whoever is active (controls only work for the active unit).
    const playerId = this.turn?.playerId ?? '';
    const now = this.now();
    const actor = checkActor(this.world, this.turn, playerId, now);
    if (!actor.ok) return this.reject(intent.t, actor.reason);
    const unitId = actor.value;
    switch (intent.t) {
      case 'aim':
        return this.emit({ t: 'aimUpdate', unitId, angle: intent.angle, power: intent.power, weaponId: intent.weaponId });
      case 'selectWeapon': {
        const ok = canUseWeapon(this.world, unitId, intent.weaponId);
        if (!ok.ok) this.reject(intent.t, ok.reason);
        return;
      }
      case 'move': {
        if (intent.dir !== 1 && intent.dir !== -1) return this.reject(intent.t, 'bad direction');
        const ticks = Math.max(1, Math.min(MAX_MOVE_TICKS, Math.floor(Number(intent.ticks) || 0)));
        const r = walk(this.world, unitId, intent.dir, ticks, this.rng);
        return this.resolved(unitId, 'move', r.events, r.durationTicks);
      }
      case 'jump': {
        const r = jump(this.world, unitId, this.rng);
        if (r.durationTicks === 0 && r.events.length === 0) return this.reject(intent.t, 'cannot jump now');
        return this.resolved(unitId, 'jump', r.events, r.durationTicks);
      }
      case 'useAbility': {
        const ok = canActivate(this.world, unitId, intent.slot);
        if (!ok.ok) return this.reject(intent.t, ok.reason);
        const r = activateAbility(this.world, unitId, intent.slot, this.rng);
        for (const m of r.modifiers) if (m.extraShots && this.turn) this.turn.shotsLeft += m.extraShots;
        this.modifiers.push(...r.modifiers);
        return this.resolved(unitId, 'ability', r.events, r.durationTicks);
      }
      case 'fire': return this.fire(playerId, unitId, intent, now);
      case 'skipTurn': return this.turnEnd();
    }
  }

  private fire(playerId: string, unitId: string, intent: Extract<MatchIntent, { t: 'fire' }>, now: number): void {
    const v = validateFire(this.world, this.turn, playerId, intent.aim, now);
    if (!v.ok || !this.turn) return this.reject('fire', v.ok ? 'no turn' : v.reason);
    commitFire(this.world, unitId, v.value.weaponId);
    const result = resolveShot(this.world, unitId, v.value, this.modifiers, this.rng);
    this.modifiers = [];
    this.turn.shotsLeft--;
    this.turn.phase = 'resolving';
    this.emit({ t: 'actionResolved', data: { actionId: ++this.actionId, unitId, kind: 'shot', result, units: this.snapshot() } });
    this.pushState();
    const wait = (result.durationTicks / 60) * 1000 + TURN_RULES.resolveGraceSec * 1000;
    this.later(() => this.afterShot(unitId), wait);
  }

  private afterShot(unitId: string): void {
    const t = this.turn;
    if (!t || t.unitId !== unitId) return;
    const alive = unitById(this.world, unitId).alive;
    if (matchWinner(this.world.units) === null && alive && t.shotsLeft > 0 && this.now() < t.endsAt) {
      t.phase = 'acting';
      this.pushState();
      return;
    }
    this.turnEnd();
  }

  /** Move / jump / ability: applied at once; the unit may die (void, lava) which ends the turn. */
  private resolved(unitId: string, kind: 'move' | 'jump' | 'ability', events: SimEvent[], durationTicks: number): void {
    this.emit({ t: 'actionResolved', data: { actionId: ++this.actionId, unitId, kind, result: { events, durationTicks, terrainHash: this.world.terrain.hash() }, units: this.snapshot() } });
    if (!unitById(this.world, unitId).alive || matchWinner(this.world.units) !== null) {
      if (this.turn) this.turn.phase = 'resolving';
      this.pushState();
      this.later(() => this.turnEnd(), (durationTicks / 60) * 1000 + TURN_RULES.resolveGraceSec * 1000);
    }
  }

  // ---------------------------------------------------------------- turn loop
  private turnStart(): void {
    if (this.disposed) return;
    const next = advanceTurn(this.world.units, this.ts, (u) => u.alive);
    this.ts = next.state;
    if (!next.activeUnitId) return this.end();
    const u = unitById(this.world, next.activeUnitId);
    const events = beginTurn(this.world, u.id, this.rng);
    const endsAt = this.now() + this.world.settings.turnSeconds * 1000;
    this.turn = { unitId: u.id, playerId: u.playerId, phase: 'acting', shotsLeft: TURN_RULES.shotsPerTurn, endsAt };
    this.modifiers = [];
    this.emit({ t: 'turnStarted', data: {
      turnNumber: this.world.turnNumber, activeUnitId: u.id, wind: this.world.wind, endsAt, skipped: next.skipped, events,
      burnZones: this.world.burnZones.map((z) => ({ ...z })),
    } });
    if (!u.alive) {
      // Burned out during upkeep: show it, then move on.
      this.turn.phase = 'resolving';
      this.pushState();
      this.later(() => this.turnEnd(), 1600);
      return;
    }
    this.pushState();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.onTimeout(u.id), endsAt - this.now() + 50);
  }

  private onTimeout(unitId: string): void {
    if (this.turn?.unitId === unitId && this.turn.phase === 'acting') this.turnEnd();
  }

  private turnEnd(): void {
    if (!this.turn || this.disposed) return;
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    endTurn(this.world, this.turn.unitId);
    this.turn = null;
    if (matchWinner(this.world.units) !== null) return this.end();
    this.turnStart();
  }

  private end(): void {
    const winner = matchWinner(this.world.units) ?? 'draw';
    this.turn = null;
    this.pushState('ended');
    this.emit({ t: 'matchEnded', data: { winner, turns: this.world.turnNumber, durationSec: Math.round((this.now() - this.startedAt) / 1000), players: computeResults(this.world.units, winner) } });
  }

  // ---------------------------------------------------------------- plumbing
  private snapshot(): World['units'] { return this.world.units.map((u) => structuredClone(u)); }

  private pushState(phase?: MatchStateView['phase']): void {
    const s: MatchStateView = {
      phase: phase ?? this.turn?.phase ?? 'waiting', turnNumber: this.world.turnNumber, activeUnitId: this.turn?.unitId ?? null,
      endsAt: this.turn?.endsAt ?? 0, wind: this.world.wind, shotsLeft: this.turn?.shotsLeft ?? 0,
    };
    queueMicrotask(() => { for (const l of this.listeners) l.state(s); });
  }

  private emit(msg: ServerMessage): void {
    // Deliver asynchronously, like a network hop, so callers never observe re-entrant updates.
    queueMicrotask(() => { if (!this.disposed) for (const l of this.listeners) l.message(msg); });
  }

  private reject(intent: MatchIntent['t'], reason: string): void { this.emit({ t: 'rejected', intent, reason }); }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.disposed) fn(); }, ms);
    this.timers.add(t);
  }
}
