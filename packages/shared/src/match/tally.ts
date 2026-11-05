// Match bookkeeping for the Results screen: team damage per turn, weapon usage, and the MVP's
// highlight line. Fed with the same events the clients replay; never affects the simulation.
import type { TeamId, UnitState, WeaponId } from '../types.ts';
import type { MatchDetails } from '../protocol.ts';
import { WEAPONS } from '../config/weapons.ts';
import type { SimEvent } from '../sim/events.ts';

interface BigHit { unitId: string; amount: number; weaponId: WeaponId | null }

export class MatchTally {
  private byTurn = new Map<number, { red: number; blue: number }>();
  private weapons = new Map<WeaponId, { shots: number; damage: number }>();
  private biggest = new Map<string, BigHit>();
  private finalBlow: { unitId: string; victim: string } | null = null;

  shot(turn: number, shooterId: string, weaponId: WeaponId, events: SimEvent[], units: UnitState[]): void {
    const w = this.weapons.get(weaponId) ?? { shots: 0, damage: 0 };
    w.shots++;
    w.damage += events.reduce((n, e) => n + (e.t === 'damage' && e.sourceUnitId === shooterId && e.cause !== 'burn' ? e.amount : 0), 0);
    this.weapons.set(weaponId, w);
    this.events(turn, events, units, weaponId);
  }

  events(turn: number, events: SimEvent[], units: UnitState[], weaponId: WeaponId | null = null): void {
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
