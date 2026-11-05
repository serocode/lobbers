import type { TeamId, UnitState } from '../types.ts';
import { MACHINES } from '../config/machines.ts';
import { WIND_RANGE } from '../config/physics.ts';
import { dealDamage, type SimContext } from './combat.ts';
import type { SimEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { hitCenter, unitById, type World } from './world.ts';

export interface TurnState {
  turnNumber: number;
  activeUnitId: string | null;
  lastTeam: TeamId | null;
  /** Next slot index to try per team (round-robin inside a team). */
  cursor: Record<TeamId, number>;
}

export const initialTurnState = (): TurnState => ({ turnNumber: 0, activeUnitId: null, lastTeam: null, cursor: { red: 0, blue: 0 } });

const other = (t: TeamId): TeamId => (t === 'red' ? 'blue' : 'red');

/**
 * Picks the next actor: teams alternate; within a team, players rotate in slot
 * order. Eliminated units are never picked. Units for which `canAct` is false
 * (e.g. disconnected) are skipped and reported. If a team has no one able to
 * act, the other team goes again.
 */
export function advanceTurn(units: UnitState[], ts: TurnState, canAct: (u: UnitState) => boolean, firstTeam: TeamId = 'red'): { state: TurnState; activeUnitId: string | null; skipped: string[] } {
  const skipped: string[] = [];
  const order: TeamId[] = ts.lastTeam ? [other(ts.lastTeam), ts.lastTeam] : [firstTeam, other(firstTeam)];
  for (const team of order) {
    const members = units.filter((u) => u.team === team).sort((a, b) => a.id.localeCompare(b.id));
    if (members.length === 0) continue;
    for (let k = 0; k < members.length; k++) {
      const idx = (ts.cursor[team] + k) % members.length;
      const u = members[idx];
      if (!u.alive) continue;
      if (!canAct(u)) { skipped.push(u.id); continue; }
      return {
        state: { turnNumber: ts.turnNumber + 1, activeUnitId: u.id, lastTeam: team, cursor: { ...ts.cursor, [team]: (idx + 1) % members.length } },
        activeUnitId: u.id, skipped,
      };
    }
  }
  return { state: { ...ts, activeUnitId: null }, activeUnitId: null, skipped };
}

export function matchWinner(units: UnitState[]): TeamId | 'draw' | null {
  const red = units.some((u) => u.team === 'red' && u.alive);
  const blue = units.some((u) => u.team === 'blue' && u.alive);
  if (red && blue) return null;
  if (!red && !blue) return 'draw';
  return red ? 'red' : 'blue';
}

/**
 * Start-of-turn upkeep for the active unit: new wind, fuel refill, cooldowns,
 * shield expiry, burn-zone damage. Returns events to broadcast.
 */
export function beginTurn(world: World, unitId: string, rng: Rng): SimEvent[] {
  const u = unitById(world, unitId);
  const ctx: SimContext = { world, rng, events: [], tick: 0 };
  world.turnNumber++;
  const range = WIND_RANGE[world.settings.wind];
  world.wind = range === 0 ? 0 : rng.int(-range, range);
  u.fuel = MACHINES[u.machine].fuel;
  u.status.unlimitedFuel = false;
  u.specialCooldown = Math.max(0, u.specialCooldown - 1);
  for (const k of Object.keys(u.weaponCooldowns) as Array<keyof typeof u.weaponCooldowns>) {
    const v = (u.weaponCooldowns[k] ?? 0) - 1;
    if (v <= 0) delete u.weaponCooldowns[k]; else u.weaponCooldowns[k] = v;
  }
  if (u.status.shield) { u.status.shield.rounds--; if (u.status.shield.rounds <= 0) u.status.shield = null; }
  for (const z of world.burnZones) {
    const c = hitCenter(u);
    if (Math.hypot(c.x - z.x, c.y - z.y) < z.radius) dealDamage(ctx, u, z.damagePerTurn, z.ownerId, 'burn');
    const owner = world.units.find((x) => x.id === z.ownerId);
    if (z.ownerId === unitId || !owner?.alive) z.turnsLeft--;
  }
  world.burnZones = world.burnZones.filter((z) => z.turnsLeft > 0);
  return ctx.events;
}

/** End-of-turn upkeep: a frozen unit thaws after the turn it spent frozen. */
export function endTurn(world: World, unitId: string): void {
  const u = unitById(world, unitId);
  if (u.status.frozenTurns > 0) u.status.frozenTurns--;
}
