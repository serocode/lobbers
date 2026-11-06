// Friends view model (DESIGN_SPEC §2.8 + §3.9 P2P tabs): Starred / Recent players from profile.recentPlayers.
import { rankFor, type LocalProfile, type MachineId, type RecentPlayer } from '@lobbers/shared';
import { ago } from '../../state/format';

export type FriendsTab = 'Starred' | 'Recent players';
export const ROOM_CODE = /^LOB-[A-Z0-9]{4}$/;

export interface FriendRow extends RecentPlayer { machine: MachineId; status: string; rank: string }

/** The machine they played the last time you met (from your match history). */
export function lastMachine(p: LocalProfile, id: string): MachineId {
  for (const h of p.history) { const x = h.players.find((q) => q.id === id); if (x) return x.machine; }
  return 'thumper';
}

export function friendRows(p: LocalProfile, tab: FriendsTab, now = Date.now()): FriendRow[] {
  const list = [...p.recentPlayers].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).filter((r) => tab === 'Recent players' || r.starred);
  return list.map((r) => ({
    ...r, machine: lastMachine(p, r.id), rank: rankFor(r.rating).label,
    status: `played ${r.matchesTogether}× · last ${ago(r.lastPlayedAt, now)}`,
  }));
}

export const counts = (p: LocalProfile): Record<FriendsTab, number> => ({ Starred: p.recentPlayers.filter((r) => r.starred).length, 'Recent players': p.recentPlayers.length });

/** "lob-7q4k" / " LOB-7Q4K " → "LOB-7Q4K"; null if it isn't a room code. */
export function normaliseCode(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return ROOM_CODE.test(c) ? c : null;
}
