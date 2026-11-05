import type { AimInput, WeaponId } from './types.ts';
import { MACHINES } from './config/machines.ts';
import { WEAPONS } from './config/weapons.ts';
import { clampAngle, clampPower } from './sim/projectile.ts';
import type { World } from './sim/world.ts';

/** Server-side gatekeeping for match intents. Pure and unit-testable. */
export type Verdict<T = void> = { ok: true; value: T } | { ok: false; reason: string };
const no = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

export type TurnPhase = 'waiting' | 'acting' | 'resolving' | 'ended';
export interface ActiveTurn { unitId: string; playerId: string; phase: TurnPhase; shotsLeft: number; endsAt: number }

export function checkActor(world: World, turn: ActiveTurn | null, playerId: string, now: number): Verdict<string> {
  if (!turn || turn.phase !== 'acting') return no('not accepting actions');
  if (turn.playerId !== playerId) return no('not your turn');
  if (now > turn.endsAt) return no('turn expired');
  const u = world.units.find((x) => x.id === turn.unitId);
  if (!u || !u.alive) return no('eliminated');
  return { ok: true, value: u.id };
}

export function canUseWeapon(world: World, unitId: string, weaponId: WeaponId): Verdict {
  const u = world.units.find((x) => x.id === unitId);
  if (!u) return no('unknown unit');
  if (!(weaponId in WEAPONS)) return no('unknown weapon');
  if (!MACHINES[u.machine].loadout.includes(weaponId)) return no('weapon not in loadout');
  if ((u.ammo[weaponId] ?? 0) === 0) return no('out of ammo');
  if ((u.weaponCooldowns[weaponId] ?? 0) > 0) return no('weapon on cooldown');
  return { ok: true, value: undefined };
}

/** Sanitises a fire intent (clamps angle/power, rejects NaN). */
export function validateFire(world: World, turn: ActiveTurn | null, playerId: string, aim: AimInput, now: number): Verdict<AimInput> {
  const actor = checkActor(world, turn, playerId, now);
  if (!actor.ok) return actor;
  if (!turn || turn.shotsLeft <= 0) return no('no shots left');
  if (!Number.isFinite(aim.angle) || !Number.isFinite(aim.power)) return no('bad aim');
  const w = canUseWeapon(world, actor.value, aim.weaponId);
  if (!w.ok) return w;
  return { ok: true, value: { angle: clampAngle(aim.angle), power: clampPower(aim.power), weaponId: aim.weaponId } };
}

/** Spend ammo and start the cooldown (beginTurn decrements it on the unit's next turn). */
export function commitFire(world: World, unitId: string, weaponId: WeaponId): void {
  const u = world.units.find((x) => x.id === unitId);
  if (!u) return;
  const a = u.ammo[weaponId];
  if (a !== undefined && a > 0) u.ammo[weaponId] = a - 1;
  const cd = WEAPONS[weaponId].cooldownTurns;
  if (cd > 0) u.weaponCooldowns[weaponId] = cd + 1;
}
