import type { ShotModifier } from '../types.ts';
import { MACHINES } from '../config/machines.ts';
import { computeDamage, dealDamage, settleUnits, type SimContext } from './combat.ts';
import type { SimEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { hitCenter, unitById, type World } from './world.ts';

export type AbilitySlot = 'special' | 'ultimate';

export function canActivate(world: World, unitId: string, slot: AbilitySlot): { ok: true } | { ok: false; reason: string } {
  const u = unitById(world, unitId);
  if (!u.alive) return { ok: false, reason: 'eliminated' };
  const m = MACHINES[u.machine];
  if (slot === 'special' && u.specialCooldown > 0) return { ok: false, reason: `special on cooldown (${u.specialCooldown})` };
  if (slot === 'ultimate' && u.charge < (m.ultimate.chargeCost ?? 100)) return { ok: false, reason: 'ultimate not charged' };
  return { ok: true };
}

/**
 * Executes instant effects now and returns shot modifiers that the server
 * must attach to this unit's next shot this turn.
 */
export function activateAbility(world: World, unitId: string, slot: AbilitySlot, rng: Rng): { modifiers: ShotModifier[]; events: SimEvent[]; durationTicks: number } {
  const check = canActivate(world, unitId, slot);
  if (!check.ok) throw new Error(check.reason);
  const u = unitById(world, unitId);
  const m = MACHINES[u.machine];
  const def = slot === 'special' ? m.special : m.ultimate;
  if (slot === 'special') u.specialCooldown = def.cooldownTurns ?? 0;
  else u.charge = 0;
  const ctx: SimContext = { world, rng, events: [], tick: 0 };
  const modifiers: ShotModifier[] = [];
  let end = 0;
  for (const e of def.effects) {
    switch (e.type) {
      case 'shotModifier': modifiers.push(e); break;
      case 'unlimitedFuel':
        u.status.unlimitedFuel = true;
        ctx.events.push({ t: 'status', tick: 0, unitId, status: 'unlimitedFuel', value: 1 });
        break;
      case 'shield':
        for (const a of world.units) {
          if (!a.alive || a.team !== u.team || Math.abs(a.x - u.x) > e.radius) continue;
          a.status.shield = { reduction: e.reduction, rounds: e.rounds };
          ctx.events.push({ t: 'status', tick: 0, unitId: a.id, status: 'shield', value: e.rounds });
        }
        break;
      case 'hop': {
        const tx = Math.max(20, Math.min(world.map.width - 20, u.x + u.facing * e.distance));
        const steps = 30, sx = u.x, sy = u.y;
        const ty = world.terrain.surfaceBelow(tx, 0);
        const points: Array<[number, number]> = [];
        for (let i = 0; i <= steps; i++) {
          const k = i / steps;
          points.push([sx + (tx - sx) * k, sy + ((ty ?? sy) - sy) * k - Math.sin(k * Math.PI) * 90]);
        }
        u.x = tx; u.y = ty ?? world.map.height + 10;
        ctx.events.push({ t: 'unitPath', startTick: 0, unitId, points });
        ctx.tick = steps;
        end = settleUnits(ctx);
        break;
      }
      case 'strikeEnemies':
        for (const v of world.units) {
          if (!v.alive || v.team === u.team) continue;
          const c = hitCenter(v);
          if (Math.hypot(c.x - u.x, c.y - u.y) > e.radius) continue;
          ctx.events.push({ t: 'bolt', tick: ctx.tick, x: Math.round(c.x), fromY: 0, toY: Math.round(c.y), chain: [] });
          dealDamage(ctx, v, computeDamage(world, e.damage, u, v, rng), u.id, 'ability', true);
          if (e.freezeTurns && v.alive) { v.status.frozenTurns = Math.max(v.status.frozenTurns, e.freezeTurns); ctx.events.push({ t: 'status', tick: ctx.tick, unitId: v.id, status: 'frozen', value: v.status.frozenTurns }); }
        }
        break;
    }
  }
  return { modifiers, events: ctx.events, durationTicks: Math.max(end, 30) };
}
