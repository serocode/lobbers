// Daily missions, achievements, lifetime counters and unlock requirements on the local profile (Phase 4).
// `applyProgress` runs inside `creditMatch`, so it is idempotent per match like the rewards.
import {
  ACHIEVEMENTS, DAILY_MISSIONS, MACHINE_UNLOCKS, type AchievementDef, type AchievementId, type CounterId, type MissionDef, type Requirement,
} from '../config/progression.ts';
import { COSMETICS } from '../config/cosmetics.ts';
import type { MatchEndedMsg, PlayerResult } from '../protocol.ts';
import type { MachineId } from '../types.ts';
import type { Verdict } from '../rules.ts';
import type { LocalProfile } from './profile.ts';

const DAILY = 'daily:';

/** Local calendar day, e.g. "2026-11-06" (missions reset at local midnight). */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Epoch ms of the next local midnight after `t`. */
export function nextMidnight(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

const yesterdayOf = (t: number): string => { const d = new Date(t); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime()); };

export interface MissionStatus { def: MissionDef; value: number; done: boolean; claimed: boolean; resetAt: number }
export interface AchievementStatus { def: AchievementDef; value: number; done: boolean; unlockedAt: number | null }

/** Today's missions (an entry from an earlier day counts as fresh). */
export function missionStatus(p: LocalProfile, now: number): MissionStatus[] {
  return DAILY_MISSIONS.map((def) => {
    const e = p.progress[DAILY + def.id];
    const live = e && e.resetAt !== null && e.resetAt > now;
    const value = live ? Math.min(e.value, def.goal) : 0;
    return { def, value, done: value >= def.goal, claimed: !!(live && e.claimedAt), resetAt: live && e.resetAt !== null ? e.resetAt : nextMidnight(now) };
  });
}

export const claimableMissions = (p: LocalProfile, now: number): number => missionStatus(p, now).filter((m) => m.done && !m.claimed).length;

export function claimMission(p: LocalProfile, id: string, now: number): Verdict<LocalProfile> {
  const m = missionStatus(p, now).find((x) => x.def.id === id);
  if (!m) return { ok: false, reason: 'unknown mission' };
  if (!m.done) return { ok: false, reason: 'not finished yet' };
  if (m.claimed) return { ok: false, reason: 'already claimed' };
  const r = m.def.reward;
  return {
    ok: true,
    value: {
      ...p, coins: p.coins + ('coins' in r ? r.coins : 0), gems: p.gems + ('gems' in r ? r.gems : 0),
      progress: { ...p.progress, [DAILY + id]: { value: m.value, claimedAt: now, resetAt: m.resetAt } },
    },
  };
}

function achievementValue(p: LocalProfile, a: AchievementDef): number {
  switch (a.source.kind) {
    case 'counter': return p.counters[a.source.counter] ?? 0;
    case 'wins': return p.stats.wins;
    case 'best': return p.best[a.source.feat] ?? 0;
    case 'winsOn': return p.winsOn[a.source.map] ?? 0;
  }
}

export function achievementStatus(p: LocalProfile): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    const value = achievementValue(p, def);
    return { def, value, done: value >= def.goal, unlockedAt: p.progress[def.id]?.claimedAt ?? null };
  });
}

/** Progress toward a requirement (value/goal) and whether it is met. */
export function requirementProgress(p: LocalProfile, r: Requirement): { met: boolean; value: number; goal: number } {
  const v = (value: number, goal: number): { met: boolean; value: number; goal: number } => ({ met: value >= goal, value: Math.min(value, goal), goal });
  switch (r.kind) {
    case 'level': return v(p.level, r.n);
    case 'rating': return v(p.rating, r.n);
    case 'matches': return v(p.stats.matches, r.n);
    case 'wins': return v(p.stats.wins, r.n);
    case 'winsWith': return v(p.stats.byMachine[r.machine]?.wins ?? 0, r.n);
    case 'winsOn': return v(p.winsOn[r.map] ?? 0, r.n);
    case 'counter': return v(p.counters[r.counter] ?? 0, r.n);
    case 'achievement': { const a = achievementStatus(p).find((x) => x.def.id === r.id); return v(a?.done ? 1 : 0, 1); }
    case 'streak': return v(p.streak.count, r.n);
  }
}

/** A requirement-locked catalog item (or machine) whose requirement is met becomes owned for free. */
export function unlockByRequirement(p: LocalProfile, itemId: string): Verdict<LocalProfile> {
  if (p.owned.includes(itemId)) return { ok: false, reason: 'already owned' };
  const need = requirementFor(itemId);
  if (!need) return { ok: false, reason: 'not unlocked by a requirement' };
  if (!requirementProgress(p, need).met) return { ok: false, reason: 'requirement not met' };
  return { ok: true, value: { ...p, owned: [...p.owned, itemId] } };
}

function requirementFor(itemId: string): Requirement | null {
  if (itemId.startsWith('machine:')) {
    const u = MACHINE_UNLOCKS[itemId.slice('machine:'.length) as MachineId];
    return u?.kind === 'requirement' ? u.need : null;
  }
  const c = COSMETICS.find((x) => x.id === itemId);
  return c?.unlock.kind === 'requirement' ? c.unlock.need : null;
}

export interface ProgressOutcome { profile: LocalProfile; missionsDone: string[]; achievementsUnlocked: AchievementId[] }

/**
 * Applies THIS player's match result to counters, best feats, wins per map, the play streak, today's missions and
 * achievements. `p` already has the match's stats applied (creditMatch); `starredBefore` = ids starred before the match.
 */
export function applyProgress(p: LocalProfile, result: MatchEndedMsg, me: PlayerResult, starredBefore: ReadonlySet<string>): ProgressOutcome {
  const f = me.feats;
  const won = result.winner === me.team;
  const team = result.players.filter((x) => x.team === me.team);
  const teamAlive = team.filter((x) => x.survived);
  const counters = { ...p.counters };
  const add = (k: CounterId, n: number): void => { if (n) counters[k] = (counters[k] ?? 0) + n; };
  if (f) { add('directHits', f.directHits); add('burnDamage', f.burnDamage); add('carvedPx', f.carvedPx); add('friendlyHits', f.friendlyHits); add('windHits', f.windHits); add('guidedHits', f.guidedHits); add('iceElims', f.iceElims); }
  if (won && me.damageReceived === 0) add('untouchableWins', 1);
  if (won && me.survived && team.length > 1 && teamAlive.length === 1) add('lastLobberWins', 1);   // needs a teammate who went down
  const best = { ...p.best };
  if (f) { best.bestChain = Math.max(best.bestChain, f.bestChain); best.bestFreeze = Math.max(best.bestFreeze, f.bestFreeze); best.bestTurnElims = Math.max(best.bestTurnElims, f.bestTurnElims); }
  best.winStreak = won ? best.winStreak + 1 : 0;
  best.bestWinStreak = Math.max(best.bestWinStreak, best.winStreak);
  const winsOn = { ...p.winsOn };
  if (won) winsOn[result.mapId] = (winsOn[result.mapId] ?? 0) + 1;

  const today = dayKey(result.endedAt);
  const streak = p.streak.day === today ? p.streak : { day: today, count: p.streak.day === yesterdayOf(result.endedAt) ? p.streak.count + 1 : 1 };

  // Daily missions.
  const playedWithFriend = result.players.some((x) => x.playerId !== me.playerId && starredBefore.has(x.playerId));
  const inc: Record<string, number> = {
    'm-direct': f?.directHits ?? 0, 'm-thumper': won && me.machine === 'thumper' ? 1 : 0, 'm-damage': me.damageDealt,
    'm-ice': f?.iceElims ?? 0, 'm-friend': playedWithFriend ? 1 : 0,
  };
  const progress = { ...p.progress };
  const before = missionStatus(p, result.endedAt);
  const missionsDone: string[] = [];
  for (const m of before) {
    const value = m.value + (inc[m.def.id] ?? 0);
    progress[DAILY + m.def.id] = { value, claimedAt: m.claimed ? (p.progress[DAILY + m.def.id]?.claimedAt ?? null) : null, resetAt: m.resetAt };
    if (!m.done && value >= m.def.goal) missionsDone.push(m.def.id);
  }
  add('missionsCompleted', missionsDone.length);

  const next: LocalProfile = { ...p, counters, best, winsOn, streak, progress };
  const achievementsUnlocked: AchievementId[] = [];
  for (const a of achievementStatus(next)) {
    if (a.done && !p.progress[a.def.id]?.claimedAt) {
      progress[a.def.id] = { value: a.value, claimedAt: result.endedAt, resetAt: null };
      achievementsUnlocked.push(a.def.id);
    }
  }
  return { profile: { ...next, progress }, missionsDone, achievementsUnlocked };
}
