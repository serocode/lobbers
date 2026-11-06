import { describe, expect, it } from 'vitest';
import { createProfile, starPlayer, type LocalProfile } from '@lobbers/shared';
import { counts, friendRows, normaliseCode } from './model';

const withPlayers = (): LocalProfile => ({
  ...createProfile('Me', 'me', 0),
  recentPlayers: [
    { id: 'a', name: 'Alpha', level: 5, rating: 1210, title: 'Rookie', lastPlayedAt: 1000, matchesTogether: 3, starred: false },
    { id: 'b', name: 'Bravo', level: 9, rating: 990, title: null, lastPlayedAt: 5000, matchesTogether: 1, starred: false },
  ],
  history: [{ matchId: 'M', endedAt: 1, mapId: 'cobalt', mode: 'team-deathmatch', team: 'red', won: true, draw: false, machine: 'thumper', damageDealt: 0, eliminations: 0, assists: 0, accuracy: 0, mvp: false, xp: 0, coins: 0, players: [{ id: 'a', name: 'Alpha', team: 'blue', machine: 'cinder', mvp: false }] }],
});

describe('friends model', () => {
  it('recent players newest first, with their last machine, rank and "played n×" line; starred tab filters', () => {
    let p = withPlayers();
    const rows = friendRows(p, 'Recent players', 60_000 + 5000);
    expect(rows.map((r) => r.name)).toEqual(['Bravo', 'Alpha']);
    expect(rows[1].machine).toBe('cinder');
    expect(rows[1].rank).toBe('GOLD I');
    expect(rows[0].status).toBe('played 1× · last 1 min ago');
    expect(friendRows(p, 'Starred')).toHaveLength(0);
    p = starPlayer(p, 'a', true);
    expect(friendRows(p, 'Starred').map((r) => r.id)).toEqual(['a']);
    expect(counts(p)).toEqual({ Starred: 1, 'Recent players': 2 });
  });
  it('join by code validates LOB-XXXX', () => {
    expect(normaliseCode(' lob-7q4k ')).toBe('LOB-7Q4K');
    expect(normaliseCode('LOB-7Q4')).toBeNull();
    expect(normaliseCode('hello')).toBeNull();
  });
});
