import type { TeamId, UnitState } from './types.ts';
import { REWARDS } from './config/match.ts';
import type { PlayerResult } from './protocol.ts';

/** Score used to pick the MVP (ties → winning team, then fewer damage received). */
export const mvpScore = (u: UnitState): number => u.stats.damageDealt + u.stats.eliminations * 300 + u.stats.assists * 120;

export function computeResults(units: UnitState[], winner: TeamId | 'draw'): PlayerResult[] {
  const sorted = [...units].sort((a, b) =>
    mvpScore(b) - mvpScore(a) || Number(b.team === winner) - Number(a.team === winner) || a.stats.damageReceived - b.stats.damageReceived);
  const mvpId = sorted[0]?.id;
  return units.map((u) => {
    const won = u.team === winner;
    const mvp = u.id === mvpId;
    let xp = REWARDS.xpBase + u.stats.damageDealt * REWARDS.xpPerDamage + u.stats.eliminations * REWARDS.xpPerElimination + u.stats.assists * REWARDS.xpPerAssist;
    if (won) xp *= REWARDS.winMultiplier;
    if (mvp) xp += REWARDS.mvpBonusXp;
    const coins = REWARDS.coinsBase + u.stats.eliminations * REWARDS.coinsPerElimination + (won ? REWARDS.coinsWinBonus : 0);
    return {
      playerId: u.playerId, unitId: u.id, name: u.name, team: u.team, machine: u.machine,
      damageDealt: u.stats.damageDealt, damageReceived: u.stats.damageReceived, eliminations: u.stats.eliminations, assists: u.stats.assists,
      accuracy: u.stats.shots ? Math.round((u.stats.hits / u.stats.shots) * 100) : 0, shots: u.stats.shots, hits: u.stats.hits,
      xp: Math.round(xp), coins, mvp, survived: u.alive,
    };
  });
}

/** Applies XP to a profile level. Returns new level/xp and how many levels were gained. */
export function applyXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let l = level, x = xp + gained, n = 0;
  while (x >= REWARDS.xpForLevel(l)) { x -= REWARDS.xpForLevel(l); l++; n++; }
  return { level: l, xp: x, levelsGained: n };
}
