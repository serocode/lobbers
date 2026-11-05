import type { AimInput, ShotModifier, UnitState, WeaponDef } from '../types.ts';
import { PHYSICS } from '../config/physics.ts';
import { MACHINES } from '../config/machines.ts';
import { WEAPONS } from '../config/weapons.ts';
import { hitCenter, type World } from './world.ts';

export interface Projectile {
  id: number;
  weapon: WeaponDef;
  x: number; y: number; vx: number; vy: number;
  age: number;
  spawnTick: number;
  shooterId: string;
  damage: number;
  radius: number;
  craterRadius: number;
  ignoreWind: boolean;
  modifiers: ShotModifier[];
  /** Drill: px bored so far; null until it first touches terrain. */
  drilled: number | null;
  done: boolean;
  isChild: boolean;
}

export type Hit =
  | { kind: 'terrain'; x: number; y: number }
  | { kind: 'unit'; x: number; y: number; unitId: string }
  | { kind: 'out'; x: number; y: number };

export function clampAngle(angle: number): number { return Math.max(0, Math.min(180, angle)); }
export function clampPower(power: number): number { return Math.max(0, Math.min(100, power)); }

/** Barrel pivot and muzzle for a unit aiming at `angle` (0 = right, 90 = up, 180 = left). */
export function muzzle(u: UnitState, angle: number): { x: number; y: number } {
  const a = (clampAngle(angle) * Math.PI) / 180;
  const py = u.y - PHYSICS.muzzleHeight - MACHINES[u.machine].hover;
  return { x: u.x + Math.cos(a) * PHYSICS.muzzleOffset, y: py - Math.sin(a) * PHYSICS.muzzleOffset };
}

export function launchVelocity(angle: number, power: number, speed: number): { vx: number; vy: number } {
  const a = (clampAngle(angle) * Math.PI) / 180;
  const v = (clampPower(power) / 100) * PHYSICS.maxLaunchSpeed * speed;
  return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v };
}

export function spawnProjectile(world: World, shooter: UnitState, aim: AimInput, modifiers: ShotModifier[], tick: number, origin?: { x: number; y: number }): Projectile {
  const weapon = WEAPONS[aim.weaponId];
  const o = origin ?? muzzle(shooter, aim.angle);
  const v = launchVelocity(aim.angle, aim.power, weapon.speed);
  const dm = modifiers.reduce((m, x) => m * (x.damageMult ?? 1), 1);
  const rm = modifiers.reduce((m, x) => m * (x.radiusMult ?? 1), 1);
  const cm = modifiers.reduce((m, x) => m * (x.craterMult ?? 1), 1);
  return {
    id: world.nextId++, weapon, x: o.x, y: o.y, vx: v.vx, vy: v.vy, age: 0, spawnTick: tick, shooterId: shooter.id,
    damage: weapon.damage * dm, radius: weapon.radius * rm, craterRadius: weapon.radius * rm * weapon.craterMult * cm,
    ignoreWind: modifiers.some((m) => m.ignoreWind), modifiers, drilled: null, done: false, isChild: false,
  };
}

/** Applies one tick of forces. Steering (guided) is applied by the behaviour before this. */
export function applyForces(p: Projectile, wind: number): void {
  if (!p.ignoreWind) p.vx += wind * PHYSICS.windAccelPerUnit * p.weapon.windFactor;
  p.vy += PHYSICS.gravity * p.weapon.gravityFactor;
}

/**
 * Moves the projectile one tick in ≤4 px sub-steps so fast shots cannot tunnel
 * through thin terrain or machines. Returns the first hit, or null.
 * `passTerrain` lets the drill bore through solid ground.
 */
export function moveAndCollide(p: Projectile, world: World, passTerrain = false): Hit | null {
  const speed = Math.hypot(p.vx, p.vy);
  const steps = Math.max(1, Math.ceil(speed / 4));
  const sx = p.vx / steps, sy = p.vy / steps;
  const { width, height } = world.map;
  const m = PHYSICS.boundsMargin;
  for (let i = 0; i < steps; i++) {
    p.x += sx; p.y += sy;
    if (p.x < -m || p.x > width + m || p.y > height + m) return { kind: 'out', x: p.x, y: p.y };
    for (const u of world.units) {
      if (!u.alive) continue;
      if (u.id === p.shooterId && p.age < PHYSICS.selfImmunityTicks) continue;
      const c = hitCenter(u);
      if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r * c.r) return { kind: 'unit', x: p.x, y: p.y, unitId: u.id };
    }
    if (!passTerrain && world.terrain.isSolid(p.x, p.y)) return { kind: 'terrain', x: p.x, y: p.y };
  }
  p.age++;
  return null;
}

/**
 * Trajectory preview. Uses EXACTLY the same force and collision code as the
 * server simulation, so the line the player sees is the line the shell flies
 * (until special behaviours such as guidance or cluster splits take over).
 */
export function predictTrajectory(world: World, shooterId: string, aim: AimInput, modifiers: ShotModifier[] = [], maxTicks: number = PHYSICS.maxProjectileTicks): { points: Array<[number, number]>; hit: Hit | null } {
  const shooter = world.units.find((u) => u.id === shooterId);
  if (!shooter) return { points: [], hit: null };
  const probe: World = { ...world, nextId: 0 };
  const p = spawnProjectile(probe, shooter, aim, modifiers, 0);
  const points: Array<[number, number]> = [[p.x, p.y]];
  for (let t = 0; t < maxTicks; t++) {
    applyForces(p, world.wind);
    const hit = moveAndCollide(p, world);
    points.push([p.x, p.y]);
    if (hit) return { points, hit };
  }
  return { points, hit: null };
}
