import type { WeaponBehavior } from '../types.ts';
import { PHYSICS } from '../config/physics.ts';
import { computeDamage, dealDamage, addBurnZone, type ExplosionSpec, type SimContext } from './combat.ts';
import type { Hit, Projectile } from './projectile.ts';
import { hitCenter } from './world.ts';

/**
 * Modular weapon behaviours. The shot engine (shot.ts) knows nothing about
 * individual weapons: it asks the handler registered for `weapon.behavior.kind`.
 * New weapon with an existing kind → config only. New kind → register a handler.
 */
export interface BehaviorApi {
  ctx: SimContext;
  explode(p: Projectile, at: { x: number; y: number }, directUnitId: string | null, extra?: Partial<ExplosionSpec>): void;
  spawn(p: Projectile): void;
}

export interface BehaviorHandler {
  /** Adjust velocity before forces (guidance). */
  steer?(p: Projectile, api: BehaviorApi): void;
  /** Skip normal gravity/wind this tick (e.g. while drilling). */
  skipForces?(p: Projectile): boolean;
  /** Projectile ignores terrain collision this tick. */
  passTerrain?(p: Projectile): boolean;
  /** Called after a tick with no collision. Return 'done' to finish the projectile. */
  postMove?(p: Projectile, api: BehaviorApi): 'done' | 'continue';
  onHit(p: Projectile, hit: Hit, api: BehaviorApi): 'done' | 'continue';
}

type Kind = WeaponBehavior['kind'];
const registry = new Map<Kind, BehaviorHandler>();
export function registerBehavior(kind: Kind, handler: BehaviorHandler): void { registry.set(kind, handler); }
export function handlerFor(p: Projectile): BehaviorHandler {
  const kind: Kind = p.isChild ? 'impact' : p.weapon.behavior.kind;
  const h = registry.get(kind);
  if (!h) throw new Error(`No behaviour registered for ${kind}`);
  return h;
}
const behaviorOf = <K extends Kind>(p: Projectile, kind: K): Extract<WeaponBehavior, { kind: K }> => {
  if (p.weapon.behavior.kind !== kind) throw new Error(`Expected ${kind}`);
  return p.weapon.behavior as Extract<WeaponBehavior, { kind: K }>;
};
const directId = (hit: Hit): string | null => (hit.kind === 'unit' ? hit.unitId : null);

const impact: BehaviorHandler = {
  onHit(p, hit, api) { if (hit.kind !== 'out') api.explode(p, hit, directId(hit)); return 'done'; },
};
registerBehavior('impact', impact);
registerBehavior('ice', {
  onHit(p, hit, api) { if (hit.kind !== 'out') api.explode(p, hit, directId(hit), { freezeTurns: behaviorOf(p, 'ice').freezeTurns }); return 'done'; },
});
registerBehavior('fire', {
  onHit(p, hit, api) {
    if (hit.kind === 'out') return 'done';
    const b = behaviorOf(p, 'fire');
    api.explode(p, hit, directId(hit));
    addBurnZone(api.ctx, Math.round(hit.x), Math.round(hit.y), b.zoneRadius, b.damagePerTurn, b.turns, p.shooterId);
    return 'done';
  },
});
registerBehavior('gravity', {
  onHit(p, hit, api) {
    if (hit.kind === 'out') return 'done';
    const b = behaviorOf(p, 'gravity');
    api.explode(p, hit, directId(hit), { pull: b.pullStrength, pullRadius: b.pullRadius });
    return 'done';
  },
});

registerBehavior('cluster', {
  onHit(p, hit, api) {
    if (hit.kind === 'out') return 'done';
    const b = behaviorOf(p, 'cluster');
    api.explode(p, hit, directId(hit));
    for (let i = 0; i < b.count; i++) {
      const a = ((50 + (80 * i) / Math.max(1, b.count - 1)) * Math.PI) / 180;
      const speed = b.spreadSpeed * (0.85 + 0.3 * ((i * 7) % 5) / 4);
      api.spawn({
        ...p, id: api.ctx.world.nextId++, x: hit.x, y: hit.y - 6, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed,
        age: PHYSICS.selfImmunityTicks, spawnTick: api.ctx.tick + 1, damage: b.childDamage, radius: b.childRadius,
        craterRadius: b.childRadius * p.weapon.craterMult, isChild: true, done: false,
      });
    }
    return 'done';
  },
});

registerBehavior('guided', {
  steer(p, api) {
    if (p.vy <= 0) return;
    const b = behaviorOf(p, 'guided');
    const shooter = api.ctx.world.units.find((u) => u.id === p.shooterId);
    let best: { x: number; y: number } | null = null, bd = b.seekRadius;
    for (const u of api.ctx.world.units) {
      if (!u.alive || !shooter || u.team === shooter.team) continue;
      const c = hitCenter(u); const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    const speed = Math.hypot(p.vx, p.vy);
    const cur = Math.atan2(p.vy, p.vx), want = Math.atan2(best.y - p.y, best.x - p.x);
    let diff = want - cur; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    const next = cur + Math.max(-b.turnRate, Math.min(b.turnRate, diff));
    p.vx = Math.cos(next) * speed; p.vy = Math.sin(next) * speed;
  },
  onHit: impact.onHit,
});

registerBehavior('drill', {
  skipForces: (p) => p.drilled !== null,
  passTerrain: (p) => p.drilled !== null,
  postMove(p, api) {
    if (p.drilled === null) return 'continue';
    const b = behaviorOf(p, 'drill');
    api.ctx.world.terrain.carveCircle(p.x, p.y, b.tunnelRadius);
    api.ctx.events.push({ t: 'carve', tick: api.ctx.tick, x: Math.round(p.x), y: Math.round(p.y), r: b.tunnelRadius });
    p.drilled += Math.hypot(p.vx, p.vy);
    if (p.drilled >= b.depth) { api.explode(p, p, null); return 'done'; }
    return 'continue';
  },
  onHit(p, hit, api) {
    if (hit.kind === 'terrain' && p.drilled === null) {
      p.drilled = 0;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      p.vx = (p.vx / sp) * 6; p.vy = (p.vy / sp) * 6;
      return 'continue';
    }
    if (hit.kind !== 'out') api.explode(p, hit, directId(hit));
    return 'done';
  },
});

registerBehavior('lightning', {
  onHit(p, hit, api) {
    if (hit.kind === 'out') return 'done';
    const b = behaviorOf(p, 'lightning');
    const { world } = api.ctx;
    api.explode(p, hit, directId(hit));
    const x = Math.round(hit.x);
    // Bolt drops straight down the column: first machine whose hit circle touches it, else the ground.
    let target: { id: string; y: number } | null = null;
    for (const u of world.units) {
      if (!u.alive) continue;
      const c = hitCenter(u);
      if (Math.abs(c.x - x) < c.r && (!target || c.y < target.y)) target = { id: u.id, y: c.y };
    }
    const ground = world.terrain.surfaceBelow(x, 0) ?? world.map.height;
    const toY = target && target.y < ground ? target.y : ground;
    const shooter = world.units.find((u) => u.id === p.shooterId) ?? null;
    const chain: Array<{ x: number; y: number }> = [];
    const struck = new Set<string>();
    const strike = (uid: string, raw: number): void => {
      const u = world.units.find((v) => v.id === uid);
      if (!u || !u.alive) return;
      struck.add(uid);
      dealDamage(api.ctx, u, computeDamage(world, raw, shooter, u, api.ctx.rng), p.shooterId, 'bolt', true);
    };
    if (target && target.y < ground) strike(target.id, b.boltDamage * (p.damage / Math.max(1, p.weapon.damage)));
    else api.explode(p, { x, y: ground }, null, { damage: b.boltDamage * 0.6, radius: b.boltRadius, craterRadius: b.boltRadius * 0.5 });
    const extra = p.modifiers.reduce((n, m) => n + (m.chainExtraTargets ?? 0), 0);
    let from = { x, y: toY };
    for (let i = 0; i < 1 + extra; i++) {
      let next: { id: string; x: number; y: number } | null = null, bd = b.chainRange;
      for (const u of world.units) {
        if (!u.alive || struck.has(u.id) || u.id === p.shooterId) continue;
        const c = hitCenter(u); const d = Math.hypot(c.x - from.x, c.y - from.y);
        if (d < bd) { bd = d; next = { id: u.id, x: c.x, y: c.y }; }
      }
      if (!next) break;
      chain.push({ x: next.x, y: next.y });
      strike(next.id, b.boltDamage * b.chainDamageMult);
      from = next;
    }
    api.ctx.events.push({ t: 'bolt', tick: api.ctx.tick, x, fromY: 0, toY, chain });
    return 'done';
  },
});

registerBehavior('airstrike', {
  onHit(p, hit, api) {
    if (hit.kind === 'out') return 'done';
    const b = behaviorOf(p, 'airstrike');
    const shooter = api.ctx.world.units.find((u) => u.id === p.shooterId);
    const dir = shooter && shooter.x < hit.x ? 1 : -1;
    for (let i = 0; i < b.bombs; i++) {
      api.spawn({
        ...p, id: api.ctx.world.nextId++, x: hit.x + (i - (b.bombs - 1) / 2) * b.spacing * dir, y: -40, vx: 0, vy: 3,
        age: PHYSICS.selfImmunityTicks, spawnTick: api.ctx.tick + 30 + i * 6, damage: b.bombDamage, radius: b.bombRadius,
        craterRadius: b.bombRadius, isChild: true, done: false,
      });
    }
    return 'done';
  },
});
