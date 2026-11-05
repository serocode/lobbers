import type { AimInput, BurnZone, MachineId, MatchSettings, PropState, TeamId, UnitState, WeaponId, MapId } from './types.ts';
import type { ShotResult, SimEvent } from './sim/events.ts';

// Wire protocol. Clients send INTENTS; the server validates, simulates and
// broadcasts OUTCOMES. Nothing a client sends can set HP, damage or position.

export type LobbyIntent =
  | { t: 'setTeam'; team: TeamId }
  | { t: 'setMachine'; machine: MachineId }
  | { t: 'setReady'; ready: boolean }
  | { t: 'updateSettings'; patch: Partial<MatchSettings> }          // host only
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
  | { t: 'skipTurn' };

export type ClientIntent = LobbyIntent | MatchIntent;

export interface TurnStartedMsg {
  turnNumber: number;
  activeUnitId: string;
  wind: number;
  endsAt: number;            // server epoch ms — clients render the countdown from this
  skipped: string[];         // units whose turn was skipped (disconnected)
  events: SimEvent[];        // burn damage etc. from upkeep
  burnZones: BurnZone[];     // authoritative burn zones after upkeep (zones expire here)
}

export interface ActionResolvedMsg {
  actionId: number;
  unitId: string;
  kind: 'shot' | 'move' | 'jump' | 'ability';
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
}

export interface PlayerResult {
  playerId: string; unitId: string; name: string; team: TeamId; machine: MachineId;
  damageDealt: number; damageReceived: number; eliminations: number; assists: number; accuracy: number;
  xp: number; coins: number; mvp: boolean; survived: boolean;
}

export interface MatchEndedMsg { winner: TeamId | 'draw'; turns: number; durationSec: number; players: PlayerResult[] }

export type ServerMessage =
  | { t: 'matchStarted'; data: MatchStartedMsg }
  | { t: 'turnStarted'; data: TurnStartedMsg }
  | { t: 'actionResolved'; data: ActionResolvedMsg }
  | { t: 'aimUpdate'; unitId: string; angle: number; power: number; weaponId: WeaponId }
  | { t: 'matchEnded'; data: MatchEndedMsg }
  | { t: 'rejected'; intent: ClientIntent['t']; reason: string };
