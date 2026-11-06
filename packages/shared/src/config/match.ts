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

/** Peer-to-peer host behaviour (the host's browser is the authority). */
export const HOST_RULES = {
  /** Start the first turn after this long even if some peers have not sent `loaded`. */
  loadTimeoutMs: 10_000,
  /** Aim relay throttle per player (≤ 10 updates/s). */
  aimRelayMs: 100,
  /** After a host refresh: wait this long for the previously-connected players to reconnect before resuming. */
  restoreGraceMs: 15_000,
  /** After a host refresh the active player gets at least this much turn time back. */
  restoreMinTurnMs: 10_000,
  /** Countdown shown on every screen between Start and the battlefield. */
  startCountdownSec: 3,
  /** Peers ping the host every N ms (clock offset + liveness). The host treats a peer as gone after `peerTimeoutMs`. */
  pingIntervalMs: 2_000,
  peerTimeoutMs: 8_000,
  /** PeerJS id = prefix + room code, e.g. "lobbers-v2-LOB-7Q4K". Change the prefix to isolate test/dev rooms. */
  peerIdPrefix: 'lobbers-v2-',
} as const;

/** Emotes: one every this many ms per player (speech bubble stays EMOTE_BUBBLE_MS). */
export const EMOTE_RULES = { cooldownMs: 2500, bubbleMs: 2600 } as const;

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
