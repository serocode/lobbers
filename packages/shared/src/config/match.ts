import type { MatchSettings } from '../types.ts';

export const ROOM_LIMITS = {
  maxPlayers: 8,
  maxPerTeam: 4,
  minPlayers: 2,
  /** Room code shape shown in the lobby, e.g. LOB-7Q4K. Ambiguous characters removed. */
  codePrefix: 'LOB-',
  codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  codeLength: 4,
  chatMaxLength: 140,
  chatRateLimitPerSec: 2,
} as const;

export const CONNECTION_RULES = {
  /** Seconds a dropped player can reconnect and resume their seat. */
  reconnectWindowSec: 60,
  /** A disconnected player's turns are skipped; after this many skipped turns they forfeit (unit removed). */
  maxSkippedTurnsWhileDisconnected: 2,
  /** A connected player who lets the timer expire this many turns in a row is treated as AFK and forfeits. */
  maxConsecutiveTimeouts: 3,
} as const;

export const TURN_RULES = {
  /** Seconds between shot resolution and the next turn (lets animations finish). */
  resolveGraceSec: 1.5,
  maxMovePerTurnFuelScale: 1,
  shotsPerTurn: 1,
} as const;

/** Values the lobby's six setting buttons cycle through (Lobby.dc.html). */
export const SETTING_OPTIONS = {
  mode: ['team-deathmatch', 'capture-the-hill'],
  turnSeconds: [20, 30, 45],
  wind: ['off', 'calm', 'variable', 'wild'],
  itemsEnabled: [true, false],
  friendlyFire: [0.5, 0, 1],
  bestOf: [1, 3],
} as const;

export const DEFAULT_SETTINGS: MatchSettings = {
  mode: 'team-deathmatch',
  mapId: 'cobalt',
  turnSeconds: 30,
  wind: 'variable',
  friendlyFire: 0.5,
  itemsEnabled: true,
  bestOf: 1,
  isPrivate: true,
};

export const REWARDS = {
  xpBase: 120,
  xpPerDamage: 0.12,
  xpPerElimination: 40,
  xpPerAssist: 15,
  winMultiplier: 1.5,
  mvpBonusXp: 100,
  coinsBase: 50,
  coinsPerElimination: 25,
  coinsWinBonus: 100,
  /** XP required to go from level L to L+1. */
  xpForLevel: (level: number): number => 4000 + level * 147,
} as const;
