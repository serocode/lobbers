import type { AimInput, BurnZone, MachineId, MatchSettings, PropState, TeamId, UnitState, WeaponId, MapId } from './types.ts';
import type { ShotResult, SimEvent } from './sim/events.ts';
import type { LobbyPlayer } from './lobby.ts';
import type { TurnPhase } from './rules.ts';

// Wire protocol (peer-to-peer). Every player's browser — including the host's own UI — is a PEER that sends
// INTENTS. The HOST's browser runs `HostSession` (packages/shared/src/host), validates, simulates and sends OUTCOMES.
// Nothing a peer sends can set HP, damage or position. Messages are JSON over a WebRTC data channel (PeerJS).

/** Bump when a message shape changes; the host refuses peers on another version ("Update the page"). */
export const PROTOCOL_VERSION = 2;
/** Hard cap on one inbound message (JSON chars). Larger messages are dropped. */
export const MAX_PEER_MESSAGE_CHARS = 16_000;

/** What a peer tells the host about itself (from its localStorage profile). Purely cosmetic / display. */
export interface PeerProfile {
  id: string;
  name: string;
  level: number;
  rating: number;
  title: string | null;
  avatar: string | null;
  favoriteMachine: MachineId;
  /** Equipped cosmetics by slot (skin per machine, trail, explosion…) — rendered by everyone, never trusted for gameplay. */
  cosmetics: Record<string, string>;
}

// ---------------------------------------------------------------- peer → host
export type SessionIntent =
  | { t: 'hello'; v: number; profile: PeerProfile; rejoinToken?: string }
  | { t: 'ping'; clientTime: number }
  | { t: 'loaded' }                                                  // match assets ready
  | { t: 'leave' };                                                  // consented leave (lobby) — in a match use `forfeit`

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
  | { t: 'move'; dir: -1 | 1; ticks: number }                        // ticks clamped by the host (≤ 10)
  | { t: 'jump' }
  | { t: 'selectWeapon'; weaponId: WeaponId }
  | { t: 'useAbility'; slot: 'special' | 'ultimate' }
  | { t: 'fire'; aim: AimInput }
  | { t: 'skipTurn' }
  | { t: 'forfeit' };                                                // Surrender (pause menu)

export type ClientIntent = LobbyIntent | MatchIntent;
export type PeerMessage = SessionIntent | ClientIntent;

// ---------------------------------------------------------------- host → peer
export interface ChatLine { from: string | null; name: string; text: string; at: number }

export interface LobbyView {
  code: string;
  name: string;
  hostId: string;
  settings: MatchSettings;
  players: LobbyPlayer[];
  chat: ChatLine[];
  phase: 'open' | 'starting' | 'inMatch';
}

/** Small, frequently-changing match state (replaces the old Colyseus schema state). Sent on every change. */
export interface MatchView {
  matchId: string;
  phase: TurnPhase;
  turnNumber: number;
  activeUnitId: string | null;
  endsAt: number;                 // host epoch ms; 0 when no turn is running
  wind: number;
  units: UnitState[];
  /** playerId → connected */
  connected: Record<string, boolean>;
  /** true while the host is restoring after a refresh (timer frozen). */
  paused: boolean;
}

export interface TurnStartedMsg {
  turnNumber: number;
  activeUnitId: string;
  wind: number;
  endsAt: number;            // host epoch ms — peers render the countdown from this (+ clock offset)
  skipped: string[];         // units whose turn was skipped (disconnected)
  events: SimEvent[];        // burn damage etc. from upkeep
}

export interface ActionResolvedMsg {
  actionId: number;
  unitId: string;
  kind: 'shot' | 'move' | 'jump' | 'ability' | 'forfeit';
  result: ShotResult | { events: SimEvent[]; durationTicks: number; terrainHash: number };
  /** Authoritative post-action snapshot — peers snap to this after animating. */
  units: UnitState[];
  props: PropState[];
}

export interface MatchStartedMsg {
  matchId: string;
  mapId: MapId;
  width: number;
  height: number;
  terrainRLE: number[];
  terrainHash: number;
  units: UnitState[];
  props: PropState[];
  burnZones: BurnZone[];
  wind: number;
  settings: MatchSettings;
}

export interface PlayerResult {
  playerId: string; unitId: string; name: string; team: TeamId; machine: MachineId;
  damageDealt: number; damageReceived: number; eliminations: number; assists: number; accuracy: number; shots: number; hits: number;
  xp: number; coins: number; mvp: boolean; survived: boolean;
}

export interface MatchEndedMsg { matchId: string; mapId: MapId; mode: MatchSettings['mode']; winner: TeamId | 'draw'; turns: number; durationSec: number; endedAt: number; players: PlayerResult[] }

export type CloseReason = 'kicked' | 'room full' | 'match in progress' | 'already joined' | 'version mismatch' | 'host closed the room' | 'bad hello';

/** Match messages (unchanged names from the Colyseus version so the battle scene/HUD keep working). */
export type ServerMessage =
  | { t: 'matchStarted'; data: MatchStartedMsg }
  | { t: 'turnStarted'; data: TurnStartedMsg }
  | { t: 'actionResolved'; data: ActionResolvedMsg }
  | { t: 'aimUpdate'; unitId: string; angle: number; power: number; weaponId: WeaponId }
  | { t: 'matchEnded'; data: MatchEndedMsg }
  | { t: 'rejected'; intent: PeerMessage['t']; reason: string };

export type HostMessage =
  | ServerMessage
  | { t: 'welcome'; playerId: string; rejoinToken: string; hostTime: number; code: string; protocol: number }
  | { t: 'pong'; clientTime: number; hostTime: number }
  | { t: 'lobbyState'; data: LobbyView }
  | { t: 'matchStarting'; countdown: number; matchId: string }
  | { t: 'matchState'; data: MatchView }
  | { t: 'closed'; reason: CloseReason };
