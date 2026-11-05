import type { ShotModifier, UnitState, WeaponId } from '../types.ts';
import { COMBAT, PHYSICS, PROPS } from '../config/physics.ts';
import { MACHINES } from '../config/machines.ts';
import { WEAPONS } from '../config/weapons.ts';
import type { DamageCause, SimEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { hitCenter, isGrounded, type World } from './world.ts';

export interface SimContext {
  world: World;
  rng: Rng;
  events: SimEvent[];
  tick: number;
  /** Barrels set off by explosions, detonated later in the same action (chain reactions). */
  pendingBarrels?: Array<{ tick: number; x: number; y: number; shooterId: string }>;
}

export interface ExplosionSpec {
  x: number; y: number;
  damage: number;
  radius: number;
  craterRadius: number;
  knockback: number;
  /** Positive pulls units toward the centre instead of pushing them away. */
  pull?: number;
  pullRadius?: number;
  weaponId: WeaponId;
  shooterId: string;
  directUnitId?: string | null;
  modifiers: ShotModifier[];
  freezeTurns?: number;
}

/** Damage after attack, defense, shields and friendly fire. Returns 0 if blocked by FF = 0. */
export function computeDamage(world: World, raw: number, attacker: UnitState | null, victim: UnitState, rng: Rng): number {
  let dmg = raw;
  if (attacker) {
    dmg *= COMBAT.attackBase + MACHINES[attacker.machine].stats.attack * COMBAT.attackPerPoint;
    if (attacker.team === victim.team && attacker.id !== victim.id) dmg *= world.settings.friendlyFire;
  }
  dmg *= 1 - MACHINES[victim.machine].stats.defense * COMBAT.defensePerPoint;
  if (victim.status.shield) dmg *= 1 - victim.status.shield.reduction;
  dmg *= 1 - COMBAT.variance + rng.next() * COMBAT.variance * 2;
  return Math.max(0, Math.round(dmg));
}

/** Applies damage, stats, ultimate charge, assists and elimination. */
export function dealDamage(ctx: SimContext, victim: UnitState, amount: number, attackerId: string | null, cause: DamageCause, direct = false): void {
  if (!victim.alive || amount <= 0) return;
  const world = ctx.world;
  const attacker = attackerId ? world.units.find((u) => u.id === attackerId) ?? null : null;
  const dealt = Math.min(victim.hp, amount);
  victim.hp -= dealt;
  victim.stats.damageReceived += dealt;
  victim.charge = Math.min(100, victim.charge + dealt * COMBAT.ultimateChargePerDamageTaken);
  if (attacker && attacker.team !== victim.team) {
    attacker.stats.damageDealt += dealt;
    attacker.charge = Math.min(100, attacker.charge + dealt * COMBAT.ultimateChargePerDamageDealt);
    (world.recentDamage[victim.id] ??= {})[attacker.id] = world.turnNumber;
  }
  ctx.events.push({ t: 'damage', tick: ctx.tick, unitId: victim.id, amount: dealt, sourceUnitId: attackerId, direct, hpAfter: victim.hp, cause });
  if (victim.hp <= 0) eliminate(ctx, victim, attacker, cause);
}

export function eliminate(ctx: SimContext, victim: UnitState, by: UnitState | null, cause: DamageCause): void {
  if (!victim.alive) return;
  victim.alive = false;
  victim.hp = 0;
  victim.vx = 0; victim.vy = 0;
  const world = ctx.world;
  // Hazard / fall deaths are credited to the most recent enemy damager.
  let killer = by && by.team !== victim.team ? by : null;
  if (!killer) {
    const recent = Object.entries(world.recentDamage[victim.id] ?? {}).sort((a, b) => b[1] - a[1])[0];
    const cand = recent ? world.units.find((u) => u.id === recent[0]) : undefined;
    if (cand && cand.team !== victim.team && world.turnNumber - recent[1] <= COMBAT.assistWindowTurns) killer = cand;
  }
  if (killer) killer.stats.eliminations++;
  const helpers = world.recentDamage[victim.id] ?? {};
  for (const [aid, turn] of Object.entries(helpers)) {
    if (aid === killer?.id || world.turnNumber - turn > COMBAT.assistWindowTurns) continue;
    const a = world.units.find((u) => u.id === aid);
    if (a && a.team !== victim.team) a.stats.assists++;
  }
  ctx.events.push({ t: 'eliminated', tick: ctx.tick, unitId: victim.id, byUnitId: killer?.id ?? null, cause });
}

/** Carves terrain, damages, freezes, knocks back. Terrain removal changes collision immediately. */
export function applyExplosion(ctx: SimContext, ex: ExplosionSpec): void {
  const world = ctx.world;
  const x = Math.round(ex.x), y = Math.round(ex.y), crater = Math.round(ex.craterRadius);
  ctx.events.push({ t: 'explosion', tick: ctx.tick, x, y, radius: ex.radius, craterRadius: crater, weaponId: ex.weaponId, color: WEAPONS[ex.weaponId].color });
  if (crater > 0) {
    world.terrain.carveCircle(x, y, crater);
    ctx.events.push({ t: 'carve', tick: ctx.tick, x, y, r: crater });
  }
  const shooter = world.units.find((u) => u.id === ex.shooterId) ?? null;
  const freeze = Math.max(ex.freezeTurns ?? 0, ...ex.modifiers.map((m) => m.freezeTurns ?? 0));
  let hitAny = false;
  for (const u of world.units) {
    if (!u.alive) continue;
    const c = hitCenter(u);
    const d = Math.hypot(c.x - x, c.y - y);
    const reach = ex.radius + COMBAT.unitReach;
    if (ex.damage > 0 && ex.radius > 0 && d < reach) {
      let raw = ex.damage * (1 - COMBAT.edgeFalloff * (d / reach));
      const direct = ex.directUnitId === u.id;
      if (direct) raw *= COMBAT.directHitMultiplier;
      const dmg = computeDamage(world, raw, shooter, u, ctx.rng);
      if (dmg > 0) {
        hitAny = true;
        dealDamage(ctx, u, dmg, ex.shooterId, 'explosion', direct);
        if (freeze > 0 && u.alive) { u.status.frozenTurns = Math.max(u.status.frozenTurns, freeze); ctx.events.push({ t: 'status', tick: ctx.tick, unitId: u.id, status: 'frozen', value: u.status.frozenTurns }); }
      }
      if (ex.knockback > 0 && u.alive) {
        const k = ex.knockback * PHYSICS.knockbackBase * (1 - d / reach);
        const nx = d > 0.001 ? (c.x - x) / d : 0, ny = d > 0.001 ? (c.y - y) / d : -1;
        u.vx += nx * k; u.vy += Math.min(ny, -0.35) * k;
      }
    }
    const pr = ex.pullRadius ?? 0;
    if (ex.pull && u.alive && d < pr && d > 4) {
      const k = ex.pull * (1 - d / pr);
      u.vx += ((x - c.x) / d) * k; u.vy += -Math.abs(k) * 0.45;
    }
  }
  if (hitAny && shooter) shooter.stats.hits++;
  // Interactive props: blasts destroy crates and set off barrels.
  for (const p of world.props) {
    if (!p.alive || Math.hypot(p.x - x, p.y - 18 - y) >= ex.radius + PROPS.barrel.triggerReach) continue;
    p.alive = false;
    if (p.kind === 'barrel') {
      ctx.events.push({ t: 'prop', tick: ctx.tick, propId: p.id, change: 'exploded' });
      (ctx.pendingBarrels ??= []).push({ tick: ctx.tick + PROPS.barrel.chainDelayTicks, x: p.x, y: p.y - 18, shooterId: ex.shooterId });
    } else ctx.events.push({ t: 'prop', tick: ctx.tick, propId: p.id, change: 'destroyed' });
  }
  const burn = ex.modifiers.find((m) => m.burn)?.burn;
  if (burn) addBurnZone(ctx, x, y, burn.radius, burn.damagePerTurn, burn.turns, ex.shooterId);
}

export function addBurnZone(ctx: SimContext, x: number, y: number, radius: number, damagePerTurn: number, turns: number, ownerId: string): void {
  const zone = { id: ctx.world.nextId++, x, y, radius, damagePerTurn, turnsLeft: turns, ownerId };
  ctx.world.burnZones.push(zone);
  ctx.events.push({ t: 'burnZone', tick: ctx.tick, zone });
}

/**
 * Lets every unit with velocity or no ground under it move until it rests:
 * knockback slides, falling into craters, fall damage, and the map hazard
 * (void / lava / water) below `map.hazard.level`.
 */
export function settleUnits(ctx: SimContext): number {
  const world = ctx.world;
  let lastTick = ctx.tick;
  for (const u of world.units) {
    if (!u.alive) continue;
    if (Math.abs(u.vx) < 0.01 && Math.abs(u.vy) < 0.01 && isGrounded(world, u)) continue;
    const points: Array<[number, number]> = [[u.x, u.y]];
    let peakY = u.y, t = 0;
    for (; t < PHYSICS.maxSettleTicks; t++) {
      u.vy = Math.min(PHYSICS.maxFallSpeed, u.vy + PHYSICS.unitGravity);
      u.vx *= PHYSICS.airDrag;
      const steps = Math.max(1, Math.ceil(Math.hypot(u.vx, u.vy) / 3));
      let landed = false;
      for (let i = 0; i < steps; i++) {
        const nx = u.x + u.vx / steps, ny = u.y + u.vy / steps;
        const bodyY = ny - MACHINES[u.machine].hitHeight;
        if (world.terrain.isSolid(nx, bodyY)) { u.vx = 0; } else u.x = nx;
        if (u.vy >= 0 && world.terrain.isSolid(u.x, ny)) {
          u.y = (world.terrain.surfaceBelow(u.x, ny - PHYSICS.maxStepUp) ?? ny);
          landed = true; break;
        }
        u.y = ny;
        if (u.vy < 0) peakY = Math.min(peakY, u.y);
      }
      u.x = Math.max(0, Math.min(world.map.width, u.x));
      points.push([Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10]);
      if (u.y > world.map.hazard.level || u.x <= 0 || u.x >= world.map.width) {
        const tick = ctx.tick; ctx.tick = ctx.tick + t;
        dealDamage(ctx, u, u.hp, null, 'hazard');
        ctx.tick = tick; break;
      }
      if (landed) {
        u.vy = 0; u.vx *= PHYSICS.groundFriction;
        const fall = u.y - peakY;
        if (fall > PHYSICS.safeFallDistance) {
          const tick = ctx.tick; ctx.tick = ctx.tick + t;
          dealDamage(ctx, u, Math.round((fall - PHYSICS.safeFallDistance) * PHYSICS.fallDamagePerPx), null, 'fall');
          ctx.tick = tick;
        }
        peakY = u.y;
        if (Math.abs(u.vx) < 0.15 && isGrounded(world, u)) { u.vx = 0; break; }
      }
    }
    ctx.events.push({ t: 'unitPath', startTick: ctx.tick, unitId: u.id, points });
    lastTick = Math.max(lastTick, ctx.tick + t);
  }
  // Props drop into craters or fall out of the world.
  for (const p of world.props) {
    if (!p.alive || world.terrain.isSolid(p.x, p.y + 1)) continue;
    const ny = world.terrain.surfaceBelow(p.x, p.y);
    if (ny === null) { p.alive = false; ctx.events.push({ t: 'prop', tick: ctx.tick, propId: p.id, change: 'destroyed' }); }
    else { p.y = ny; ctx.events.push({ t: 'prop', tick: ctx.tick, propId: p.id, change: 'moved', y: ny }); }
  }
  return lastTick;
}
