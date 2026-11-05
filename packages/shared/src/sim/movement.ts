import { PHYSICS, PROPS } from '../config/physics.ts';
import { MACHINES } from '../config/machines.ts';
import { settleUnits, type SimContext } from './combat.ts';
import type { SimEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { isGrounded, unitById, type World } from './world.ts';

export interface MoveResult { events: SimEvent[]; durationTicks: number; fuelUsed: number }

/**
 * Walks a unit for up to `ticks` ticks (server sends ~6 ticks per held-key
 * message). Climbs slopes up to maxStepUp px, stops at walls, walks off
 * ledges (then falls via settleUnits, which applies fall damage/hazards).
 */
export function walk(world: World, unitId: string, dir: -1 | 1, ticks: number, rng: Rng): MoveResult {
  const u = unitById(world, unitId);
  const m = MACHINES[u.machine];
  const ctx: SimContext = { world, rng, events: [], tick: 0 };
  u.facing = dir;
  if (!u.alive || u.status.frozenTurns > 0 || !isGrounded(world, u)) return { events: [], durationTicks: 0, fuelUsed: 0 };
  const points: Array<[number, number]> = [[u.x, u.y]];
  let used = 0, t = 0, fell = false;
  for (; t < ticks; t++) {
    if (u.fuel <= 0) break;
    const step = Math.min(m.walkSpeed, u.fuel);
    const nx = Math.max(12, Math.min(world.map.width - 12, u.x + dir * step));
    if (nx === u.x) break;
    // Wall check at body height above the max step.
    if (world.terrain.isSolid(nx, u.y - PHYSICS.maxStepUp - 2) && world.terrain.isSolid(nx, u.y - m.hitHeight)) break;
    const ny = world.terrain.surfaceBelow(nx, u.y - PHYSICS.maxStepUp);
    if (ny === null || ny - u.y > PHYSICS.maxStepUp * 2) { u.x = nx; if (ny !== null) u.y = Math.min(u.y, ny); fell = true; points.push([u.x, u.y]); break; }
    if (u.y - ny > PHYSICS.maxStepUp) break;
    u.x = nx; u.y = ny;
    if (!u.status.unlimitedFuel) { u.fuel -= step; used += step; }
    points.push([Math.round(u.x * 10) / 10, u.y]);
    // Drive over a repair crate to collect it.
    for (const p of world.props) {
      if (!p.alive || p.kind !== 'crate' || Math.abs(p.x - u.x) > PROPS.crate.pickupReach) continue;
      p.alive = false;
      const amount = Math.min(PROPS.crate.heal, u.maxHp - u.hp);
      u.hp += amount;
      ctx.events.push({ t: 'prop', tick: t, propId: p.id, change: 'collected', unitId });
      ctx.events.push({ t: 'heal', tick: t, unitId, amount, hpAfter: u.hp });
    }
  }
  ctx.events.push({ t: 'unitPath', startTick: 0, unitId, points });
  let end = t;
  if (fell) { ctx.tick = t; end = settleUnits(ctx); }
  return { events: ctx.events, durationTicks: end, fuelUsed: used };
}

/** Hop forward. Costs a little fuel; frozen units cannot jump. */
export function jump(world: World, unitId: string, rng: Rng): MoveResult {
  const u = unitById(world, unitId);
  const m = MACHINES[u.machine];
  const cost = 12;
  if (!u.alive || u.status.frozenTurns > 0 || !isGrounded(world, u) || (!u.status.unlimitedFuel && u.fuel < cost)) return { events: [], durationTicks: 0, fuelUsed: 0 };
  if (!u.status.unlimitedFuel) u.fuel -= cost;
  u.vx = u.facing * 2.2; u.vy = -m.jumpVelocity;
  u.y -= 1;
  const ctx: SimContext = { world, rng, events: [], tick: 0 };
  const end = settleUnits(ctx);
  return { events: ctx.events, durationTicks: end, fuelUsed: cost };
}
