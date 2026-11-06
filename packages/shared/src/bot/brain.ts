import type { AimInput, ShotModifier, UnitState, WeaponDef, WeaponId } from '../types.ts';
import { BOT_RULES, type BotTuning } from '../config/bots.ts';
import { MACHINES } from '../config/machines.ts';
import { WEAPONS } from '../config/weapons.ts';
import { canUseWeapon } from '../rules.ts';
import { canActivate, type AbilitySlot } from '../sim/abilities.ts';
import { predictTrajectory, type Hit } from '../sim/projectile.ts';
import type { Rng } from '../sim/rng.ts';
import { hitCenter, type World } from '../sim/world.ts';

// How a bot decides. Pure functions over a World (the bot's WorldMirror): it only CHOOSES an intent — the host
// still validates and simulates the shot. The search runs the same `predictTrajectory` as the aim preview.

export interface ShotPlan {
  aim: AimInput;
  /** Expected damage to enemies minus harm to itself/allies (BOT_RULES weights). */
  expected: number;
}

interface Candidate { angle: number; power: number; score: number; expected: number }

/** Rough damage + reach of a weapon for scoring (spread weapons count a share of their bomblets). */
function weaponReach(def: WeaponDef, modifiers: ShotModifier[]): { damage: number; radius: number } {
  const dm = modifiers.reduce((m, x) => m * (x.damageMult ?? 1), 1);
  const rm = modifiers.reduce((m, x) => m * (x.radiusMult ?? 1), 1);
  const b = def.behavior;
  let damage = def.damage, radius = def.radius;
  if (b.kind === 'cluster') { damage = b.count * b.childDamage * BOT_RULES.clusterHitShare; radius = b.childRadius + b.spreadSpeed * BOT_RULES.clusterSpreadTicks; }
  else if (b.kind === 'airstrike') { damage = b.bombs * b.bombDamage * BOT_RULES.airstrikeHitShare; radius = ((b.bombs - 1) * b.spacing) / 2 + b.bombRadius; }
  else if (b.kind === 'lightning') { damage += b.boltDamage; radius = Math.max(radius, b.boltRadius); }
  else if (b.kind === 'fire') damage += b.damagePerTurn * b.turns * BOT_RULES.burnValueShare;
  return { damage: damage * dm, radius: radius * rm };
}

/** Expected value of a shell landing at `hit`: enemy damage (kills count extra) minus self / team harm. */
function scoreHit(world: World, me: UnitState, hit: Hit | null, reach: { damage: number; radius: number }): { score: number; expected: number } {
  if (!hit || hit.kind === 'out') return { score: -1e6, expected: 0 };
  let expected = 0;
  let nearest = Infinity;
  for (const u of world.units) {
    if (!u.alive) continue;
    const c = hitCenter(u);
    const d = Math.hypot(c.x - hit.x, c.y - hit.y);
    if (u.team !== me.team) nearest = Math.min(nearest, d);
    const direct = hit.kind === 'unit' && hit.unitId === u.id;
    const falloff = direct ? 1 : Math.max(0, 1 - Math.max(0, d - c.r) / Math.max(1, reach.radius));
    if (falloff <= 0) continue;
    const dmg = Math.min(u.hp, reach.damage * falloff);
    if (u.id === me.id) expected -= dmg * BOT_RULES.selfHarmWeight;
    else if (u.team === me.team) expected -= dmg * world.settings.friendlyFire * BOT_RULES.allyHarmWeight;
    else expected += dmg + (reach.damage * falloff >= u.hp ? u.hp * BOT_RULES.killBonusShare : 0);
  }
  return { score: expected - (Number.isFinite(nearest) ? nearest * BOT_RULES.distanceWeight : 0), expected };
}

function evaluate(world: World, me: UnitState, weaponId: WeaponId, angle: number, power: number, modifiers: ShotModifier[]): Candidate {
  const { hit } = predictTrajectory(world, me.id, { angle, power, weaponId }, modifiers);
  const r = scoreHit(world, me, hit, weaponReach(WEAPONS[weaponId], modifiers));
  return { angle, power, ...r };
}

/** Angle range worth searching: only toward the side(s) enemies are on. */
function angleRange(world: World, me: UnitState): [number, number] {
  const foes = world.units.filter((u) => u.alive && u.team !== me.team);
  const right = foes.some((u) => u.x >= me.x), left = foes.some((u) => u.x < me.x);
  if (right && !left) return [BOT_RULES.minAngle, 90 + BOT_RULES.sideOverlap];
  if (left && !right) return [90 - BOT_RULES.sideOverlap, BOT_RULES.maxAngle];
  return [BOT_RULES.minAngle, BOT_RULES.maxAngle];
}

function coarse(world: World, me: UnitState, weaponId: WeaponId, modifiers: ShotModifier[], t: BotTuning): Candidate[] {
  const [a0, a1] = angleRange(world, me);
  const out: Candidate[] = [];
  for (let a = a0; a <= a1; a += t.coarseAngleStep)
    for (let p = BOT_RULES.minPower; p <= 100; p += t.coarsePowerStep) out.push(evaluate(world, me, weaponId, a, p, modifiers));
  return out.sort((x, y) => y.score - x.score);
}

function refine(world: World, me: UnitState, weaponId: WeaponId, modifiers: ShotModifier[], seeds: Candidate[]): Candidate {
  let best = seeds[0];
  for (const s of seeds) {
    for (let da = -BOT_RULES.refineAngleSpan; da <= BOT_RULES.refineAngleSpan; da++) {
      for (let dp = -BOT_RULES.refinePowerSpan; dp <= BOT_RULES.refinePowerSpan; dp++) {
        const a = s.angle + da, p = s.power + dp;
        if (a < 0 || a > 180 || p < 1 || p > 100) continue;
        const c = evaluate(world, me, weaponId, a, p, modifiers);
        if (c.score > best.score) best = c;
      }
    }
  }
  return best;
}

/** Weapons the bot will try: the Standard Rocket plus its `weaponChoices` strongest usable weapons. */
export function weaponOptions(world: World, me: UnitState, t: BotTuning): WeaponId[] {
  const usable = (Object.keys(me.ammo) as WeaponId[]).filter((id) => canUseWeapon(world, me.id, id).ok);
  const extras = usable.filter((id) => id !== 'standard-rocket')
    .sort((a, b) => weaponReach(WEAPONS[b], []).damage - weaponReach(WEAPONS[a], []).damage)
    .slice(0, t.weaponChoices);
  const base: WeaponId[] = usable.includes('standard-rocket') ? ['standard-rocket'] : usable.slice(0, 1);
  return [...base, ...extras.filter((id) => !base.includes(id))];
}

function gaussian(rng: Rng): number {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Picks the best shot from where the unit stands: coarse grid over angle × power for each candidate weapon, a
 * fine pass on the winner, then difficulty-based aim error. Returns null if the unit can't fire at all.
 */
export function planShot(world: World, unitId: string, t: BotTuning, rng: Rng, modifiers: ShotModifier[] = []): ShotPlan | null {
  const me = world.units.find((u) => u.id === unitId);
  if (!me || !me.alive) return null;
  const view: World = t.windAware ? world : { ...world, wind: 0 };
  const weapons = weaponOptions(world, me, t);
  if (!weapons.length) return null;
  let pick: { weaponId: WeaponId; list: Candidate[] } | null = null;
  let rocketBest = -Infinity;
  for (const weaponId of weapons) {
    const list = coarse(view, me, weaponId, modifiers, t);
    if (!list.length) continue;
    const limited = (me.ammo[weaponId] ?? -1) >= 0;
    if (weaponId === 'standard-rocket') rocketBest = list[0].expected;
    // Spend limited ammo only when it clearly beats the rocket.
    const worth = limited ? list[0].expected >= rocketBest * BOT_RULES.limitedAmmoBias : true;
    if (!pick || (worth && list[0].score > pick.list[0].score)) pick = { weaponId, list };
  }
  if (!pick) return null;
  const best = refine(view, me, pick.weaponId, modifiers, pick.list.slice(0, Math.max(1, t.refineCandidates)));
  const angle = Math.max(0, Math.min(180, best.angle + gaussian(rng) * t.angleErrorSd));
  const power = Math.max(1, Math.min(100, best.power + gaussian(rng) * t.powerErrorSd));
  return { aim: { angle: Math.round(angle * 10) / 10, power: Math.round(power * 10) / 10, weaponId: pick.weaponId }, expected: best.expected };
}

/** Shot modifiers an ability arms for the next shot (fed to `planShot` so the search sees e.g. Updraft's no-wind). */
export function abilityModifiers(world: World, unitId: string, slot: AbilitySlot): ShotModifier[] {
  const u = world.units.find((x) => x.id === unitId);
  if (!u) return [];
  const def = slot === 'special' ? MACHINES[u.machine].special : MACHINES[u.machine].ultimate;
  return def.effects.filter((e): e is ShotModifier => e.type === 'shotModifier');
}

/**
 * Whether to use an ability before shooting. Skips hops (they can carry the bot off a ledge) and enemy strikes
 * with nobody in range; otherwise rolls `abilityChance`. Ultimate first.
 */
export function chooseAbility(world: World, unitId: string, t: BotTuning, rng: Rng): AbilitySlot | null {
  const me = world.units.find((u) => u.id === unitId);
  if (!me || !me.alive) return null;
  for (const slot of ['ultimate', 'special'] as const) {
    if (!canActivate(world, unitId, slot).ok) continue;
    const def = slot === 'special' ? MACHINES[me.machine].special : MACHINES[me.machine].ultimate;
    if (def.effects.some((e) => e.type === 'hop')) continue;
    const strike = def.effects.find((e) => e.type === 'strikeEnemies');
    if (strike && strike.type === 'strikeEnemies' && !world.units.some((u) => u.alive && u.team !== me.team && Math.hypot(u.x - me.x, u.y - me.y) <= strike.radius)) continue;
    if (rng.next() < t.abilityChance) return slot;
  }
  return null;
}

/** Walking direction when there is no shot: toward the nearest living enemy. */
export function approachDir(world: World, unitId: string): -1 | 1 {
  const me = world.units.find((u) => u.id === unitId);
  if (!me) return 1;
  const foe = world.units.filter((u) => u.alive && u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
  return foe && foe.x < me.x ? -1 : 1;
}
