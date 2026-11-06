import { describe, expect, it } from 'vitest';
import { createProfile, creditMatch, type LocalProfile, type MatchEndedMsg, type PlayerResult } from '@lobbers/shared';
import { avatarKind, careerStats, equippedRows, historyPage, mostPlayed, ownedTitles } from './model';

const res = (id: string, team: 'red' | 'blue', o: Partial<PlayerResult> = {}): PlayerResult => ({
  playerId: id, unitId: `${team}-${id}`, name: id, team, machine: 'thumper', damageDealt: 500, damageReceived: 100, eliminations: 1, assists: 0,
  accuracy: 50, shots: 4, hits: 2, xp: 300, coins: 40, mvp: false, survived: true, ...o,
});
const play = (p: LocalProfile, i: number, won: boolean, machine: PlayerResult['machine'] = 'thumper'): LocalProfile => creditMatch(p, {
  matchId: `M${i}`, mapId: 'cobalt', mode: 'team-deathmatch', winner: won ? 'red' : 'blue', turns: 9, durationSec: 200, endedAt: 1000 + i,
  players: [res('me', 'red', { machine }), res('x', 'blue')], mvpHighlight: '', details: { damageByTurn: [], weapons: [] },
} satisfies MatchEndedMsg).profile;

describe('profile model', () => {
  it('career stats, favourite = most played, paginated history (8 per page, tabs)', () => {
    let p = createProfile('Me', 'me', new Date(2026, 2, 1).getTime());
    for (let i = 0; i < 11; i++) p = play(p, i, i % 3 !== 0, i < 7 ? 'mollusk' : 'thumper');
    const c = careerStats(p);
    expect(c.winRate).toBe(64);
    expect(c.cards.map((x) => x.v)).toEqual(['11', '7', '4', '50%']);
    expect(c.cards[0].sub).toBe('since Mar 2026');
    expect(mostPlayed(p)).toEqual({ id: 'mollusk', matches: 7, winPct: 57 });
    const h0 = historyPage(p, () => 'Cobalt Crags', 'All', 0);
    expect(h0.rows).toHaveLength(8); expect(h0.pages).toBe(2);
    expect(h0.rows[0].matchId).toBe('M10');
    expect(historyPage(p, () => '', 'All', 5).page).toBe(1);
    expect(historyPage(p, () => '', 'Losses', 0).rows.every((r) => !r.won)).toBe(true);
  });

  it('identity: avatar falls back to the favourite machine; equipped rows; owned titles', () => {
    const p = createProfile('Me', 'me', 0);
    expect(avatarKind(p)).toBe('thumper');
    expect(avatarKind({ ...p, equipped: { ...p.equipped, avatar: 'avatar:boomba' } })).toBe('thumper');   // not owned
    expect(avatarKind({ ...p, equipped: { ...p.equipped, avatar: 'avatar:cinder' } })).toBe('cinder');
    expect(equippedRows(p).map((r) => r.slot)).toEqual(['MACHINE SKIN', 'PROJECTILE TRAIL', 'EXPLOSION', 'TITLE', 'EMOTE']);
    expect(equippedRows(p)[0].name).toBe('Factory Thumper');
    expect(ownedTitles(p).map((t) => t.name)).toContain('Rookie');
  });
});
