// Daily missions, achievements, unlock requirements, streak (persist/progress.ts via creditMatch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  achievementStatus, claimMission, claimableMissions, createProfile, creditMatch, loadProfile, memoryStore, missionStatus, nextMidnight,
  purchase, rankFor, requirementProgress, saveProfile, starPlayer, unlockByRequirement, PROFILE_KEY,
  type LocalProfile, type MatchEndedMsg, type PlayerFeats, type PlayerResult,
} from '../src/index.ts';

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 6, 15, 0).getTime();   // local 15:00
const feats = (f: Partial<PlayerFeats> = {}): PlayerFeats => ({ directHits: 0, burnDamage: 0, carvedPx: 0, friendlyHits: 0, windHits: 0, bestChain: 0, bestFreeze: 0, bestTurnElims: 0, iceElims: 0, guidedHits: 0, ...f });
const player = (id: string, team: 'red' | 'blue', o: Partial<PlayerResult> = {}): PlayerResult => ({
  playerId: id, unitId: `${team}-${id}`, name: id, team, machine: 'thumper', damageDealt: 0, damageReceived: 100, eliminations: 0, assists: 0,
  accuracy: 0, shots: 1, hits: 0, xp: 100, coins: 50, mvp: false, survived: true, feats: feats(), ...o,
});
let n = 0;
const match = (me: Partial<PlayerResult>, o: { at?: number; winner?: 'red' | 'blue'; map?: MatchEndedMsg['mapId']; mates?: PlayerResult[] } = {}): MatchEndedMsg => ({
  matchId: `M${++n}`, mapId: o.map ?? 'cobalt', mode: 'team-deathmatch', winner: o.winner ?? 'red', turns: 10, durationSec: 300, endedAt: o.at ?? T0,
  players: [player('me', 'red', me), ...(o.mates ?? []), player('foe', 'blue', { survived: false })], mvpHighlight: '', details: { damageByTurn: [], weapons: [] },
});
const fresh = (): LocalProfile => createProfile('Tester', 'me', T0 - DAY);

test('daily missions advance from your own result, claim pays once, reset at local midnight', () => {
  let p = fresh();
  p = creditMatch(p, match({ damageDealt: 3000, feats: feats({ directHits: 3 }) })).profile;
  p = creditMatch(p, match({ damageDealt: 2500, feats: feats({ directHits: 2, iceElims: 2 }) })).profile;
  const s = Object.fromEntries(missionStatus(p, T0).map((m) => [m.def.id, m]));
  assert.equal(s['m-direct'].value, 5); assert.equal(s['m-direct'].done, true);
  assert.equal(s['m-damage'].done, true, '5,500 ≥ 5,000');
  assert.equal(s['m-thumper'].value, 2, 'two wins as Thumper');
  assert.equal(s['m-ice'].done, true);
  assert.equal(claimableMissions(p, T0), 3);
  const coins = p.coins, gems = p.gems;
  const c1 = claimMission(p, 'm-direct', T0); assert.ok(c1.ok);
  p = c1.value;
  assert.equal(p.coins, coins + 150);
  assert.deepEqual(claimMission(p, 'm-direct', T0), { ok: false, reason: 'already claimed' });
  const c2 = claimMission(p, 'm-ice', T0); assert.ok(c2.ok); assert.equal(c2.value.gems, gems + 80);
  assert.deepEqual(claimMission(p, 'm-friend', T0), { ok: false, reason: 'not finished yet' });
  // Next local day: fresh missions.
  const tomorrow = nextMidnight(T0) + 1000;
  assert.ok(missionStatus(p, tomorrow).every((m) => m.value === 0 && !m.claimed));
  assert.equal(p.counters.missionsCompleted, 3, 'direct hits, damage, ice: counted when the goal is reached');
});

test('"Play a match with a friend" needs someone you had starred before the match', () => {
  let p = creditMatch(fresh(), match({}, { mates: [player('pal', 'red')] })).profile;
  assert.equal(missionStatus(p, T0).find((m) => m.def.id === 'm-friend')!.done, false, 'pal was not starred yet');
  p = starPlayer(p, 'pal', true);
  p = creditMatch(p, match({}, { mates: [player('pal', 'red')] })).profile;
  assert.equal(missionStatus(p, T0).find((m) => m.def.id === 'm-friend')!.done, true);
});

test('achievements unlock once from feats and stats; unlock time is recorded', () => {
  let p = fresh();
  const first = match({ damageReceived: 0, feats: feats({ windHits: 1, bestChain: 3, bestTurnElims: 2, carvedPx: 1200 }) }, { mates: [player('m2', 'red', { survived: false })] });
  const r = creditMatch(p, first);
  p = r.profile;
  assert.deepEqual([...r.achievementsUnlocked].sort(), ['electrician', 'last-lobber', 'untouchable', 'wind-whisperer']);
  const a = Object.fromEntries(achievementStatus(p).map((x) => [x.def.id, x]));
  assert.equal(a['wind-whisperer'].unlockedAt, T0);
  assert.equal(a['demolition-derby'].value, 2); assert.equal(a['demolition-derby'].done, false);
  assert.equal(a['crater-maker'].value, 1200);
  const again = creditMatch(p, match({ feats: feats({ windHits: 1 }) }));
  assert.deepEqual(again.achievementsUnlocked, [], 'never twice');
  assert.equal(creditMatch(again.profile, first).credited, false, 'the same match is not credited twice');
});

test('requirements: typed checks, free unlock when met, machines by coins or level', () => {
  let p = fresh();
  assert.equal(requirementProgress(p, { kind: 'level', n: 40 }).met, false);
  assert.deepEqual(unlockByRequirement(p, 'machine:whirligig'), { ok: false, reason: 'requirement not met' });
  assert.deepEqual(unlockByRequirement(p, 'ti-wind'), { ok: false, reason: 'requirement not met' });
  p = creditMatch(p, match({ feats: feats({ windHits: 1 }) })).profile;
  const t = unlockByRequirement(p, 'ti-wind'); assert.ok(t.ok, 'Wind Whisperer title after the achievement');
  assert.ok(t.value.owned.includes('ti-wind'));
  p = { ...t.value, level: 40 };
  const w = unlockByRequirement(p, 'machine:whirligig'); assert.ok(w.ok);
  assert.deepEqual(unlockByRequirement(w.value, 'machine:frostbite'), { ok: false, reason: 'not unlocked by a requirement' });
  assert.deepEqual(purchase({ ...w.value, coins: 5999 }, { id: 'machine:frostbite', priceCoins: 6000 }), { ok: false, reason: 'not enough currency' });
  const f = purchase({ ...w.value, coins: 6000 }, { id: 'machine:frostbite', priceCoins: 6000 }); assert.ok(f.ok);
  assert.equal(f.value.coins, 0);
  assert.equal(requirementProgress(p, { kind: 'winsOn', map: 'glacier', n: 10 }).value, 0);
  p = creditMatch(p, match({}, { map: 'glacier' })).profile;
  assert.equal(requirementProgress(p, { kind: 'winsOn', map: 'glacier', n: 10 }).value, 1);
});

test('play streak: consecutive local days count up, a missed day restarts it', () => {
  let p = creditMatch(fresh(), match({}, { at: T0 })).profile;
  p = creditMatch(p, match({}, { at: T0 + 3600_000 })).profile;
  assert.equal(p.streak.count, 1, 'same day');
  p = creditMatch(p, match({}, { at: T0 + DAY })).profile;
  p = creditMatch(p, match({}, { at: T0 + 2 * DAY })).profile;
  assert.equal(p.streak.count, 3);
  p = creditMatch(p, match({}, { at: T0 + 4 * DAY })).profile;
  assert.equal(p.streak.count, 1);
});

test('saves from before Phase 4 load with empty progress fields', () => {
  const store = memoryStore();
  const old = fresh() as Partial<LocalProfile>;
  delete old.counters; delete old.best; delete old.winsOn; delete old.streak;
  store.setItem(PROFILE_KEY, JSON.stringify(old));
  const p = loadProfile(store)!;
  assert.deepEqual(p.counters, {}); assert.deepEqual(p.best, { bestChain: 0, bestFreeze: 0, bestTurnElims: 0, winStreak: 0, bestWinStreak: 0 }); assert.equal(p.streak.count, 0);
  saveProfile(store, creditMatch(p, match({ feats: feats({ directHits: 1 }) })).profile);
  assert.equal(loadProfile(store)!.counters.directHits, 1);
});

test('rank tiers and win streaks', () => {
  assert.equal(rankFor(1000).label, 'BRONZE I');
  assert.equal(rankFor(1200).label, 'GOLD I');
  assert.equal(rankFor(1350).label, 'GOLD III');
  assert.equal(rankFor(1700).label, 'DIAMOND');
  let p = fresh();
  for (const w of ['red', 'red', 'blue', 'red'] as const) p = creditMatch(p, match({}, { winner: w })).profile;
  assert.equal(p.best.winStreak, 1); assert.equal(p.best.bestWinStreak, 2);
});

test('Last Lobber needs teammates: a solo win (1v1) is not "last machine standing"', () => {
  const r = creditMatch(fresh(), match({}));
  assert.equal(r.profile.counters.lastLobberWins ?? 0, 0);
});

test('setCosmetics in the lobby: the host keeps the new loadout and resolves it at match start (protocol v4)', async () => {
  const { setup, startMatch, flush } = await import('./hostEnv.ts');
  const env = setup(2);
  await flush();
  env.peers[1].client.send({ t: 'setCosmetics', cosmetics: { trail: 't-rainbow', title: 'ti-rookie' }, title: 'Rookie' });
  env.peers[1].client.send({ t: 'setCosmetics', cosmetics: 'nope' } as never);   // malformed → dropped by the codec
  await flush();
  assert.equal(env.peers[0].client.lobby!.players.find((x) => x.id === env.peers[1].id)!.cosmetics?.trail, 't-rainbow');
  await startMatch(env);
  const u = env.peers[0].client.started!.units.find((x) => x.playerId === env.peers[1].id)!;
  assert.equal(env.peers[0].client.started!.cosmetics[u.id].trail.style, 'rainbow');
});

test('a hosted room is saved at creation: F5 before anyone joins still resumes it', async () => {
  const { HostSession, ManualClock } = await import('../src/index.ts');
  const store = memoryStore();
  const host = { id: 'h', name: 'Hosty', level: 1, rating: 1000, title: null, avatar: null, favoriteMachine: 'thumper' as const, cosmetics: {} };
  const s1 = new HostSession({ code: 'LOB-SAVE', roomName: 'Saved', host, clock: new ManualClock(0), store, random: () => 0.5 });
  assert.ok(store.getItem(HostSession.storageKey('LOB-SAVE')), 'snapshot written at creation');
  const s2 = HostSession.restore({ code: 'LOB-SAVE', roomName: '', host, clock: new ManualClock(0), store, random: () => 0.5 });
  assert.ok(s2, 'restored');
  s2.close(); s1.close();
});
