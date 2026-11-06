// Match bookkeeping for the Results screen: team damage per turn, weapon usage, and the MVP's
// highlight line. Fed with the same events the clients replay; never affects the simulation.
import type { TeamId, UnitState, WeaponId } from '../types.ts';
import type { MatchDetails, PlayerFeats } from '../protocol.ts';
import { WEAPONS } from '../config/weapons.ts';
import type { SimEvent } from '../sim/events.ts';

interface BigHit { unitId: string; amount: number; weaponId: WeaponId | null }

/** Wind strength (|wind|) at or above which a hit counts as a "wind hit" (Wind Whisperer). */
export const WIND_HIT_MIN = 10;

export const emptyFeats = (): PlayerFeats => ({
  directHits: 0, burnDamage: 0, carvedPx: 0, friendlyHits: 0, windHits: 0, bestChain: 0, bestFreeze: 0, bestTurnElims: 0, iceElims: 0, guidedHits: 0,
});

/** What one action (shot, ability, move, turn upkeep) was, for feat counting. */
export interface ActionInfo { actorId: string | null; weaponId?: WeaponId | null; wind?: number }

/** Plain-JSON form for HostMatch.snapshot() (host refresh keeps the tally). */
export interface TallySnapshot {
  byTurn: Array<[number, { red: number; blue: number }]>;
  weapons: Array<[WeaponId, { shots: number; damage: number }]>;
  biggest: Array<[string, BigHit]>;
  finalBlow: { unitId: string; victim: string } | null;
  feats?: Array<[string, PlayerFeats]>;
  turnElims?: Array<[string, number]>;
}

export class MatchTally {
  private byTurn = new Map<number, { red: number; blue: number }>();
  private weapons = new Map<WeaponId, { shots: number; damage: number }>();
  private biggest = new Map<string, BigHit>();
  private finalBlow: { unitId: string; victim: string } | null = null;
  private featsBy = new Map<string, PlayerFeats>();
  /** `${turn}:${unitId}` → eliminations that turn (Demolition Derby). */
  private turnElims = new Map<string, number>();

  snapshot(): TallySnapshot {
    return {
      byTurn: [...this.byTurn].map(([k, v]) => [k, { ...v }]), weapons: [...this.weapons].map(([k, v]) => [k, { ...v }]), biggest: [...this.biggest].map(([k, v]) => [k, { ...v }]),
      finalBlow: this.finalBlow ? { ...this.finalBlow } : null, feats: [...this.featsBy].map(([k, v]) => [k, { ...v }]), turnElims: [...this.turnElims],
    };
  }

  static restore(s: TallySnapshot | undefined): MatchTally {
    const t = new MatchTally();
    if (!s) return t;
    t.byTurn = new Map(s.byTurn); t.weapons = new Map(s.weapons); t.biggest = new Map(s.biggest); t.finalBlow = s.finalBlow;
    t.featsBy = new Map(s.feats ?? []); t.turnElims = new Map(s.turnElims ?? []);
    return t;
  }

  shot(turn: number, shooterId: string, weaponId: WeaponId, events: SimEvent[], units: UnitState[], wind = 0): void {
    const w = this.weapons.get(weaponId) ?? { shots: 0, damage: 0 };
    w.shots++;
    w.damage += events.reduce((n, e) => n + (e.t === 'damage' && e.sourceUnitId === shooterId && e.cause !== 'burn' ? e.amount : 0), 0);
    this.weapons.set(weaponId, w);
    this.events(turn, events, units, weaponId, { actorId: shooterId, weaponId, wind });
  }

  /** Feats of one unit so far (zeros if it did nothing). */
  feats(unitId: string): PlayerFeats { return { ...(this.featsBy.get(unitId) ?? emptyFeats()) }; }

  private feat(unitId: string): PlayerFeats {
    let f = this.featsBy.get(unitId);
    if (!f) { f = emptyFeats(); this.featsBy.set(unitId, f); }
    return f;
  }

  /** Per-player feats for achievements and missions. Counted from the same events the peers replay. */
  private countFeats(turn: number, events: SimEvent[], units: UnitState[], action: ActionInfo): void {
    const team = (id: string | null): TeamId | null => units.find((u) => u.id === id)?.team ?? null;
    const enemyHitBy = new Set<string>();       // actors that damaged an enemy in this action
    const bolted = new Map<string, Set<string>>();
    const frozen = new Map<string, number>();
    for (const e of events) {
      if (e.t === 'damage' && e.sourceUnitId && e.amount > 0) {
        const src = e.sourceUnitId, f = this.feat(src);
        const friendly = e.unitId !== src && team(e.unitId) === team(src);
        if (e.cause === 'burn') f.burnDamage += e.amount;
        if (friendly) f.friendlyHits++;
        else if (e.unitId !== src) {
          enemyHitBy.add(src);
          if (e.direct && e.cause !== 'burn') f.directHits++;
          if (e.cause === 'bolt') { const s = bolted.get(src) ?? new Set<string>(); s.add(e.unitId); bolted.set(src, s); }
        }
      } else if (e.t === 'carve' && action.actorId) {
        this.feat(action.actorId).carvedPx += Math.round(Math.PI * e.r * e.r);
      } else if (e.t === 'status' && e.status === 'frozen' && e.value > 0 && action.actorId && team(e.unitId) !== team(action.actorId)) {
        frozen.set(action.actorId, (frozen.get(action.actorId) ?? 0) + 1);
      } else if (e.t === 'eliminated' && e.byUnitId && e.cause !== 'forfeit' && team(e.unitId) !== team(e.byUnitId)) {
        const key = `${turn}:${e.byUnitId}`, n = (this.turnElims.get(key) ?? 0) + 1;
        this.turnElims.set(key, n);
        const f = this.feat(e.byUnitId);
        f.bestTurnElims = Math.max(f.bestTurnElims, n);
        if (e.byUnitId === action.actorId && action.weaponId && WEAPONS[action.weaponId].category === 'Ice') f.iceElims++;
      }
    }
    for (const [src, set] of bolted) { const f = this.feat(src); f.bestChain = Math.max(f.bestChain, set.size); }
    for (const [src, n] of frozen) { const f = this.feat(src); f.bestFreeze = Math.max(f.bestFreeze, n); }
    const a = action.actorId;
    if (a && enemyHitBy.has(a) && action.weaponId) {
      const f = this.feat(a);
      if (Math.abs(action.wind ?? 0) >= WIND_HIT_MIN) f.windHits++;
      if (WEAPONS[action.weaponId].category === 'Guided') f.guidedHits++;
    }
  }

  events(turn: number, events: SimEvent[], units: UnitState[], weaponId: WeaponId | null = null, action: ActionInfo = { actorId: null }): void {
    this.countFeats(turn, events, units, action);
    const team = (id: string | null): TeamId | null => units.find((u) => u.id === id)?.team ?? null;
    for (const e of events) {
      if (e.t === 'damage' && e.sourceUnitId) {
        const t = team(e.sourceUnitId);
        if (!t) continue;
        const row = this.byTurn.get(turn) ?? { red: 0, blue: 0 };
        row[t] += e.amount;
        this.byTurn.set(turn, row);
        const prev = this.biggest.get(e.sourceUnitId);
        if (!prev || e.amount > prev.amount) this.biggest.set(e.sourceUnitId, { unitId: e.sourceUnitId, amount: e.amount, weaponId: e.cause === 'burn' ? null : weaponId });
      } else if (e.t === 'eliminated' && e.byUnitId) {
        const victim = units.find((u) => u.id === e.unitId);
        this.finalBlow = { unitId: e.byUnitId, victim: victim?.name ?? '' };
      }
    }
  }

  details(): MatchDetails {
    const turns = [...this.byTurn.keys()];
    const last = turns.length ? Math.max(...turns) : 0;
    const damageByTurn: MatchDetails['damageByTurn'] = [];
    for (let turn = 1; turn <= last; turn++) damageByTurn.push({ turn, ...(this.byTurn.get(turn) ?? { red: 0, blue: 0 }) });
    const weapons = [...this.weapons.entries()].map(([weaponId, v]) => ({ weaponId, ...v })).sort((a, b) => b.shots - a.shots || b.damage - a.damage);
    return { damageByTurn, weapons };
  }

  /** One line about the MVP: final blow if they landed it, else their biggest single hit. */
  highlight(mvpUnitId: string): string {
    if (this.finalBlow?.unitId === mvpUnitId && this.finalBlow.victim) return `Landed the final blow on ${this.finalBlow.victim}`;
    const hit = this.biggest.get(mvpUnitId);
    if (!hit) return 'Kept the team alive to the end';
    return hit.weaponId ? `Biggest hit: ${hit.amount} with ${WEAPONS[hit.weaponId].name}` : `Biggest hit: ${hit.amount}`;
  }
}
