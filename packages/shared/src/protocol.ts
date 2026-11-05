import type { AimInput, BurnZone, GameMode, MachineId, MatchSettings, PropState, TeamId, UnitState, WeaponId, MapId } from './types.ts';
import type { ShotResult, SimEvent } from './sim/events.ts';
import type { TurnPhase } from './rules.ts';
import type { UnitCosmetics } from './config/cosmetics.ts';

// Wire protocol. Clients send INTENTS; the server validates, simulates and
// broadcasts OUTCOMES. Nothing a client sends can set HP, damage or position.

export type LobbyIntent =
  | { t: 'setTeam'; team: TeamId }
  | { t: 'setMachine'; machine: MachineId }
  | { t: 'setReady'; ready: boolean }
  | { t: 'updateSettings'; patch: Partial<MatchSettings> }          // host only
  | { t: 'setRoomName'; name: string }                               // host only
  | { t: 'setCosmetics'; loadout?: unknown }                         // sanitised server-side against owned items
  | { t: 'kick'; playerId: string }                                  // host only
  | { t: 'startMatch' }                                              // host only
  | { t: 'chat'; text: string };

export type MatchIntent =
  | { t: 'aim'; angle: number; power: number; weaponId: WeaponId }  // cosmetic sync only, throttled ≤10/s
  | { t: 'move'; dir: -1 | 1; ticks: number }                        // ticks clamped server-side (≤ 10)
  | { t: 'jump' }
  | { t: 'selectWeapon'; weaponId: WeaponId }
  | { t: 'useAbility'; slot: 'special' | 'ultimate' }
  | { t: 'fire'; aim: AimInput }
  | { t: 'skipTurn' }
  | { t: 'forfeit' }                                                 // surrender: any time, own unit only
  | { t: 'emote'; slot: number };                                    // one of your 4 equipped emotes, rate-limited

export type ClientIntent = LobbyIntent | MatchIntent;

/** Synced match state (the Colyseus `MatchState` schema, also produced by the hot-seat authority). */
export interface MatchStateView {
  phase: TurnPhase;
  turnNumber: number;
  activeUnitId: string | null;
  /** Server epoch ms when the current turn ends. */
  endsAt: number;
  wind: number;
  /** Shots the active unit may still fire this turn. */
  shotsLeft: number;
  /** Disconnected players → server epoch ms when their reconnect window closes. */
  offline: Record<string, number>;
}

export interface TurnStartedMsg {
  turnNumber: number;
  activeUnitId: string;
  wind: number;
  endsAt: number;            // server epoch ms — clients render the countdown from this
  skipped: string[];         // units whose turn was skipped (disconnected)
  events: SimEvent[];        // burn damage etc. from upkeep
  burnZones: BurnZone[];     // authoritative burn zones after upkeep (zones expire here)
}

export type ActionKind = 'shot' | 'move' | 'jump' | 'ability' | 'forfeit';

export interface ActionResolvedMsg {
  actionId: number;
  unitId: string;
  kind: ActionKind;
  result: ShotResult | { events: SimEvent[]; durationTicks: number; terrainHash: number };
  /** Authoritative post-action unit snapshot — clients snap to this after animating. */
  units: UnitState[];
}

export interface MatchStartedMsg {
  mapId: MapId;
  width: number;
  height: number;
  terrainRLE: number[];
  terrainHash: number;
  units: UnitState[];
  settings: MatchSettings;
  /** Barrels and crates as they are now (full snapshot, also used on reconnect). */
  props: PropState[];
  burnZones: BurnZone[];
  wind: number;
  /** Resolved cosmetics per unit id (skins, trails, explosions, shell colours, title, emotes). */
  cosmetics: Record<string, UnitCosmetics>;
}

export interface PlayerResult {
  playerId: string; unitId: string; name: string; team: TeamId; machine: MachineId;
  damageDealt: number; damageReceived: number; eliminations: number; assists: number; accuracy: number;
  xp: number; coins: number; mvp: boolean; survived: boolean;
}

/** Per-turn team damage and per-weapon usage for the Results "Match details" modal. */
export interface MatchDetails {
  damageByTurn: Array<{ turn: number; red: number; blue: number }>;
  weapons: Array<{ weaponId: WeaponId; shots: number; damage: number }>;
}

export interface MatchEndedMsg {
  winner: TeamId | 'draw';
  turns: number;
  durationSec: number;
  players: PlayerResult[];
  mapId: MapId;
  mode: GameMode;
  /** Server-written MVP line, e.g. "Biggest hit: 412 with Heavy Bomb". */
  mvpHighlight: string;
  details: MatchDetails;
}

export type ServerMessage =
  | { t: 'matchStarted'; data: MatchStartedMsg }
  | { t: 'turnStarted'; data: TurnStartedMsg }
  | { t: 'actionResolved'; data: ActionResolvedMsg }
  | { t: 'aimUpdate'; unitId: string; angle: number; power: number; weaponId: WeaponId }
  | { t: 'emote'; unitId: string; emoteId: string }
  | { t: 'matchEnded'; data: MatchEndedMsg }
  | { t: 'rejected'; intent: ClientIntent['t']; reason: string };

// ---------------------------------------------------------------- lobby (plain views of the LobbyRoom schema)

export interface LobbyPlayerView {
  id: string;
  name: string;
  title: string;
  level: number;
  team: TeamId;
  slot: number;
  machine: MachineId;
  ready: boolean;
  connected: boolean;
  /** Server epoch ms when a disconnected player's seat is released (0 while connected). */
  reconnectUntil: number;
  isHost: boolean;
  ping: number;
  joinedAt: number;
}

export interface ChatLineView { id: number; playerId: string; name: string; team: TeamId | 'system'; text: string; at: number }

export type LobbyPhase = 'open' | 'starting' | 'inMatch';

export interface LobbyView {
  code: string;
  name: string;
  isPrivate: boolean;
  ranked: boolean;
  hostId: string;
  phase: LobbyPhase;
  /** Server epoch ms when the 3-2-1 countdown ends (phase 'starting'). */
  countdownEndsAt: number;
  /** Match room id while phase is 'inMatch' (or the last finished match). */
  matchId: string;
  settings: MatchSettings;
  players: LobbyPlayerView[];
  chat: ChatLineView[];
}

/** Messages the LobbyRoom sends to one client or broadcasts. `reservation` is Colyseus' opaque seat reservation. */
export type LobbyServerMessage =
  | { t: 'matchStarting'; countdown: number; endsAt: number }
  | { t: 'matchReady'; matchId: string; reservation: unknown }
  | { t: 'kicked'; reason: string }
  | { t: 'rejected'; intent: LobbyIntent['t']; reason: string };

/** Room-level clock sync (median of 3 round trips → offset = serverTime − local midpoint). */
export interface TimeSyncReply { clientTime: number; serverTime: number }

/** Public room list row (`GET /api/rooms`). */
export interface PublicRoomInfo { roomId: string; code: string; name: string; mode: GameMode; mapId: MapId; players: number; maxPlayers: number; hostName: string; ranked: boolean }
