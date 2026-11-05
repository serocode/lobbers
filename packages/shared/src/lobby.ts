import type { MachineId, TeamId } from './types.ts';
import { ROOM_LIMITS } from './config/match.ts';
import type { Rng } from './sim/rng.ts';

export interface LobbyPlayer {
  id: string;
  name: string;
  team: TeamId;
  slot: number;
  machine: MachineId;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  joinedAt: number;
}

type Result = { ok: true } | { ok: false; reason: string };

export function generateRoomCode(rng: Rng, taken: Set<string> = new Set()): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = '';
    for (let i = 0; i < ROOM_LIMITS.codeLength; i++) s += ROOM_LIMITS.codeAlphabet[rng.int(0, ROOM_LIMITS.codeAlphabet.length - 1)];
    const code = ROOM_LIMITS.codePrefix + s;
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not generate a unique room code');
}

export const teamCount = (ps: LobbyPlayer[], team: TeamId): number => ps.filter((p) => p.team === team).length;

export function canJoinRoom(ps: LobbyPlayer[]): Result {
  return ps.length >= ROOM_LIMITS.maxPlayers ? { ok: false, reason: 'room full' } : { ok: true };
}

/** Auto-assign: smaller team, red on ties. */
export function pickTeam(ps: LobbyPlayer[]): TeamId {
  return teamCount(ps, 'blue') < teamCount(ps, 'red') ? 'blue' : 'red';
}

export function freeSlot(ps: LobbyPlayer[], team: TeamId): number {
  for (let i = 0; i < ROOM_LIMITS.maxPerTeam; i++) if (!ps.some((p) => p.team === team && p.slot === i)) return i;
  return -1;
}

export function canSwitchTeam(ps: LobbyPlayer[], playerId: string, team: TeamId): Result {
  const p = ps.find((x) => x.id === playerId);
  if (!p) return { ok: false, reason: 'unknown player' };
  if (p.team === team) return { ok: false, reason: 'already on that team' };
  if (teamCount(ps, team) >= ROOM_LIMITS.maxPerTeam) return { ok: false, reason: 'team full' };
  return { ok: true };
}

export function validateStart(ps: LobbyPlayer[], requesterId: string): Result {
  const req = ps.find((p) => p.id === requesterId);
  if (!req?.isHost) return { ok: false, reason: 'only the host can start' };
  if (ps.length < ROOM_LIMITS.minPlayers) return { ok: false, reason: `need at least ${ROOM_LIMITS.minPlayers} players` };
  if (ps.length > ROOM_LIMITS.maxPlayers) return { ok: false, reason: 'too many players' };
  for (const t of ['red', 'blue'] as const) {
    const n = teamCount(ps, t);
    if (n === 0) return { ok: false, reason: `team ${t} is empty` };
    if (n > ROOM_LIMITS.maxPerTeam) return { ok: false, reason: `team ${t} has more than ${ROOM_LIMITS.maxPerTeam}` };
  }
  const notReady = ps.filter((p) => !p.ready && !p.isHost);
  if (notReady.length) return { ok: false, reason: `${notReady.length} player(s) not ready` };
  return { ok: true };
}

/** Next host = longest-connected eligible player. Settings are untouched. */
export function transferHost(ps: LobbyPlayer[]): LobbyPlayer[] {
  const candidates = ps.filter((p) => p.connected && !p.isHost).sort((a, b) => a.joinedAt - b.joinedAt);
  const next = candidates[0];
  if (!next) return ps;
  return ps.map((p) => ({ ...p, isHost: p.id === next.id }));
}
