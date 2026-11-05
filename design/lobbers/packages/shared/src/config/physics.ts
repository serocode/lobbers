// Physics constants. Units: world pixels and simulation ticks (fixed 60 Hz).
// These values reproduce the feel of the approved mockup (Battle.dc.html).
// Server simulation and the client trajectory preview MUST read from here.

export const PHYSICS = {
  tickRate: 60,
  /** Projectile gravity, px/tick². */
  gravity: 0.26,
  /** Horizontal acceleration per wind unit, px/tick². */
  windAccelPerUnit: 0.0035,
  /** Launch speed at power 100 for a speed-1 weapon, px/tick. Range at 45° ≈ v²/g ≈ 2600 px — enough to cross the 3000 px maps. */
  maxLaunchSpeed: 26,
  maxProjectileTicks: 900,
  /** Ticks during which a projectile ignores its own shooter. */
  selfImmunityTicks: 14,
  /** Distance from the machine pivot to the muzzle, px. */
  muzzleOffset: 30,
  /** Height of the barrel pivot above the feet, px. */
  muzzleHeight: 52,
  /** How many ticks of the predicted path the preview line shows. */
  previewTicks: 70,
  /** World is out of bounds beyond these margins. */
  boundsMargin: 80,

  unitGravity: 0.45,
  maxFallSpeed: 14,
  maxStepUp: 6,
  safeFallDistance: 120,
  fallDamagePerPx: 0.6,
  groundFriction: 0.75,
  airDrag: 0.995,
  /** Knockback px/tick at the centre of a knockback-1 explosion. */
  knockbackBase: 1.1,
  maxSettleTicks: 600,
} as const;

export const PROPS = {
  barrel: { damage: 130, radius: 54, knockback: 7, craterMult: 0.7, chainDelayTicks: 27, triggerReach: 30 },
  crate: { heal: 150, pickupReach: 36 },
} as const;

export const COMBAT = {
  directHitMultiplier: 1.25,
  /** Damage at the blast edge = damage × (1 − edgeFalloff). */
  edgeFalloff: 0.65,
  /** Extra reach added to a blast's radius when testing a unit's hit circle. */
  unitReach: 36,
  /** attack stat → damage multiplier: 0.85 + attack × 0.03 (attack 5 = 1.0). */
  attackBase: 0.85,
  attackPerPoint: 0.03,
  /** defense stat → mitigation: defense × 0.025 (defense 10 = 25%). */
  defensePerPoint: 0.025,
  /** Server-side damage variance (±). Clients never roll this. */
  variance: 0.05,
  ultimateChargePerDamageDealt: 0.12,
  ultimateChargePerDamageTaken: 0.06,
  assistWindowTurns: 2,
} as const;

export const WIND_RANGE: Record<'off' | 'calm' | 'variable' | 'wild', number> = {
  off: 0,
  calm: 4,
  variable: 10,
  wild: 16,
};
