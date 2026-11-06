// Bot players. Bots are seats the HOST adds to a room; each one is a PeerClient running in the host's tab that
// plays through ordinary intents (aim, move, useAbility, fire) — the host validates them like any other peer.
// Every number that shapes how a bot plays lives here.

export type BotDifficulty = 'easy' | 'normal' | 'hard';
export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'normal', 'hard'];
export const BOT_LABEL: Record<BotDifficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

/** Bot player ids start with this; humans may not claim it (the host refuses such hellos). */
export const BOT_ID_PREFIX = 'bot-';
/** Display names ("Bot Clank"). Kept ≤ 12 chars so "Bot " + name fits the 16-char name rule. */
export const BOT_NAMES = ['Clank', 'Rivet', 'Gizmo', 'Bolt', 'Widget', 'Tinker', 'Cog', 'Sparky', 'Dynamo', 'Gadget', 'Piston', 'Ratchet'] as const;

export interface BotTuning {
  /** Grid search: coarse angle / power steps, then a fine pass around the best few candidates. */
  coarseAngleStep: number;
  coarsePowerStep: number;
  refineCandidates: number;
  /** Aim error added after solving (normal distribution, σ in degrees / power points). */
  angleErrorSd: number;
  powerErrorSd: number;
  /** false = the bot solves as if there were no wind (it misses more in strong wind). */
  windAware: boolean;
  /** How many of its best weapons the bot considers besides the Standard Rocket (0 = rocket only). */
  weaponChoices: number;
  /** Chance per turn to use a ready special / ultimate when it would help. */
  abilityChance: number;
  /** When no shot can reach an enemy, walk toward one for up to this many `move` intents (each ≤ 10 ticks). */
  maxMoves: number;
  /** "Thinking" pause before the first action, ms [min, max]. */
  thinkMs: readonly [number, number];
}

export const BOT_TUNING: Record<BotDifficulty, BotTuning> = {
  easy: { coarseAngleStep: 9, coarsePowerStep: 8, refineCandidates: 1, angleErrorSd: 5, powerErrorSd: 6, windAware: false, weaponChoices: 1, abilityChance: 0.25, maxMoves: 0, thinkMs: [1600, 2600] },
  normal: { coarseAngleStep: 6, coarsePowerStep: 5, refineCandidates: 3, angleErrorSd: 1.8, powerErrorSd: 2.4, windAware: true, weaponChoices: 3, abilityChance: 0.6, maxMoves: 3, thinkMs: [1200, 2000] },
  hard: { coarseAngleStep: 5, coarsePowerStep: 5, refineCandidates: 4, angleErrorSd: 0.5, powerErrorSd: 0.8, windAware: true, weaponChoices: 5, abilityChance: 0.9, maxMoves: 5, thinkMs: [900, 1500] },
};

export const BOT_RULES = {
  /** Angles the search covers (0 = right, 180 = left); straight-up shots are skipped. */
  minAngle: 8,
  maxAngle: 172,
  minPower: 15,
  /** Fine pass: ±span around a coarse candidate in steps of 1. */
  refineAngleSpan: 4,
  refinePowerSpan: 4,
  /** Barrel sweep shown to other players before firing: this many `aim` updates, this far apart (≥ HOST_RULES.aimRelayMs). */
  aimSweepSteps: 4,
  aimSweepMs: 160,
  /** Pause after one of its own actions finishes animating before the bot acts again. */
  settleMs: 500,
  /** If less than this is left on the turn timer the bot fires at once (no moves, no sweep). */
  hurryMs: 4000,
  /** Expected damage below this means "no real shot from here" (the bot may walk). */
  viableShot: 30,
  /** Score penalty per expected point of damage to itself / a teammate (on top of friendly-fire scaling). */
  selfHarmWeight: 1.5,
  allyHarmWeight: 1.2,
  /** Tie-breaker when nothing hits: prefer landing closer to an enemy (score per px). */
  distanceWeight: 0.02,
  /** Ammo-limited weapons must beat the rocket's expected damage by this factor to be spent. */
  limitedAmmoBias: 1.15,
  /** Effective damage/radius of spread weapons relative to the config numbers (bomblets don't all land on one spot). */
  clusterHitShare: 0.5,
  airstrikeHitShare: 0.45,
  /** Cluster reach ≈ child radius + spread speed × this many ticks of bomblet flight. */
  clusterSpreadTicks: 20,
  /** Burn zones: share of their total damage-over-time counted at impact. */
  burnValueShare: 0.5,
  /** A blow expected to finish a machine is worth this share of its remaining HP extra. */
  killBonusShare: 0.5,
  /** When every enemy is on one side, also search this many degrees past vertical. */
  sideOverlap: 15,
  /** Rejections in one turn before the bot gives up and skips. */
  maxRejections: 3,
} as const;
