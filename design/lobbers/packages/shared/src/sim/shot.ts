import type { AimInput, ShotModifier } from '../types.ts';
import { PHYSICS, PROPS } from '../config/physics.ts';
import { WEAPONS } from '../config/weapons.ts';
import { applyExplosion, settleUnits, type SimContext } from './combat.ts';
import type { ProjectileTrack, ShotResult } from './events.ts';
import { handlerFor, type BehaviorApi } from './behaviors.ts';
import { applyForces, clampAngle, moveAndCollide, spawnProjectile, type Projectile } from './projectile.ts';
import type { Rng } from './rng.ts';
import { unitById, type World } from './world.ts';

/**
 * Authoritative shot resolution. Runs on the SERVER, mutates `world`
 * (terrain, HP, positions, statuses) and returns everything clients need to
 * replay it: per-tick projectile tracks and a tick-stamped event list.
 * Validation (turn, ammo, cooldown) happens before this — see rules.ts.
 */
export function resolveShot(world: World, shooterId: string, aim: AimInput, modifiers: ShotModifier[], rng: Rng): ShotResult {
  const shooter = unitById(world, shooterId);
  shooter.facing = Math.cos((clampAngle(aim.angle) * Math.PI) / 180) >= 0 ? 1 : -1;
  shooter.stats.shots++;
  const ctx: SimContext = { world, rng, events: [], tick: 0 };
  const pending: Projectile[] = [];
  const active: Projectile[] = [];
  const tracks = new Map<number, ProjectileTrack>();

  const api: BehaviorApi = {
    ctx,
    explode(p, at, directUnitId, extra) {
      applyExplosion(ctx, {
        x: at.x, y: at.y, damage: p.damage, radius: p.radius, craterRadius: p.craterRadius, knockback: p.weapon.knockback,
        weaponId: p.weapon.id, shooterId: p.shooterId, directUnitId, modifiers: p.modifiers, ...extra,
      });
    },
    spawn(p) { pending.push(p); },
  };

  const spread = modifiers.find((m) => m.spread)?.spread;
  if (spread) {
    for (let i = 0; i < spread.count; i++) {
      const angle = aim.angle + (i - (spread.count - 1) / 2) * spread.angleStep;
      pending.push(spawnProjectile(world, shooter, { ...aim, angle, weaponId: spread.weaponId ?? aim.weaponId }, modifiers, 0));
    }
  } else pending.push(spawnProjectile(world, shooter, aim, modifiers, 0));

  let tick = 0;
  for (; tick < PHYSICS.maxProjectileTicks * 2; tick++) {
    ctx.tick = tick;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].spawnTick <= tick) {
        const p = pending.splice(i, 1)[0];
        active.push(p);
        tracks.set(p.id, { id: p.id, weaponId: p.weapon.id, spawnTick: tick, points: [[p.x, p.y]], color: WEAPONS[p.weapon.id].color });
      }
    }
    for (const p of active) {
      if (p.done) continue;
      const h = handlerFor(p);
      h.steer?.(p, api);
      if (!h.skipForces?.(p)) applyForces(p, world.wind);
      const hit = moveAndCollide(p, world, h.passTerrain?.(p) ?? false);
      tracks.get(p.id)?.points.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
      if (hit) { if (h.onHit(p, hit, api) === 'done') p.done = true; }
      else if (h.postMove?.(p, api) === 'done') p.done = true;
      if (p.age > PHYSICS.maxProjectileTicks) p.done = true;
    }
    if (pending.length === 0 && active.every((p) => p.done)) break;
  }
  // Barrel chain reactions (each detonation can trigger more barrels).
  while (ctx.pendingBarrels && ctx.pendingBarrels.length) {
    const b = ctx.pendingBarrels.shift()!;
    ctx.tick = Math.max(tick, b.tick); tick = ctx.tick;
    applyExplosion(ctx, { x: b.x, y: b.y, damage: PROPS.barrel.damage, radius: PROPS.barrel.radius, craterRadius: PROPS.barrel.radius * PROPS.barrel.craterMult,
      knockback: PROPS.barrel.knockback, weaponId: 'heavy-bomb', shooterId: b.shooterId, directUnitId: null, modifiers: [] });
  }
  ctx.tick = tick + 1;
  const end = settleUnits(ctx);
  return { tracks: [...tracks.values()], events: ctx.events, durationTicks: end + 10, terrainHash: world.terrain.hash() };
}
