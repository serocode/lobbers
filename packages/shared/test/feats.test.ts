// Per-player feats the host counts for achievements and daily missions (protocol v4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchTally, WIND_HIT_MIN, type SimEvent, type UnitState } from '../src/index.ts';
import { playToEnd, setup, startMatch } from './hostEnv.ts';

const units = [
  { id: 'r0', team: 'red', name: 'R0' }, { id: 'r1', team: 'red', name: 'R1' },
  { id: 'b0', team: 'blue', name: 'B0' }, { id: 'b1', team: 'blue', name: 'B1' }, { id: 'b2', team: 'blue', name: 'B2' },
] as unknown as UnitState[];
const dmg = (unitId: string, src: string, amount: number, cause: 'explosion' | 'bolt' | 'burn' = 'explosion', direct = true): SimEvent =>
  ({ t: 'damage', tick: 1, unitId, amount, sourceUnitId: src, direct, hpAfter: 100, cause });
const elim = (unitId: string, by: string): SimEvent => ({ t: 'eliminated', tick: 2, unitId, byUnitId: by, cause: 'explosion' });

test('feats: direct hits, teammate hits, burn damage, carved terrain, wind and guided hits', () => {
  const t = new MatchTally();
  t.shot(1, 'r0', 'heavy-bomb', [dmg('b0', 'r0', 200), dmg('b1', 'r0', 50, 'explosion', false), dmg('r1', 'r0', 30), { t: 'carve', tick: 1, x: 0, y: 0, r: 10 }], units, WIND_HIT_MIN);
  t.shot(3, 'r0', 'guided-missile', [dmg('b0', 'r0', 90)], units, 2);
  t.events(5, [dmg('b2', 'r0', 40, 'burn', false)], units, null, { actorId: 'b2' });   // burn ticks at b2's turn start
  const f = t.feats('r0');
  assert.equal(f.directHits, 2, 'two direct enemy hits (splash and teammate hits are not direct hits)');
  assert.equal(f.friendlyHits, 1);
  assert.equal(f.burnDamage, 40);
  assert.equal(f.carvedPx, Math.round(Math.PI * 100));
  assert.equal(f.windHits, 1, 'only the shot fired in wind ≥ 10');
  assert.equal(f.guidedHits, 1);
  assert.deepEqual(t.feats('nobody').directHits, 0);
});

test('feats: lightning chain length, enemies frozen by one action, eliminations in one turn, ice eliminations', () => {
  const t = new MatchTally();
  t.shot(1, 'r0', 'lightning-strike', [dmg('b0', 'r0', 80, 'bolt'), dmg('b1', 'r0', 40, 'bolt'), dmg('b2', 'r0', 40, 'bolt')], units, 0);
  t.events(3, [1, 2, 3].map((i): SimEvent => ({ t: 'status', tick: 1, unitId: `b${i - 1}`, status: 'frozen', value: 1 })), units, null, { actorId: 'r1' });
  t.shot(5, 'r0', 'ice-bomb', [dmg('b0', 'r0', 300), elim('b0', 'r0')], units, 0);
  t.shot(5, 'r0', 'heavy-bomb', [dmg('b1', 'r0', 300), elim('b1', 'r0')], units, 0);
  t.shot(7, 'r0', 'heavy-bomb', [dmg('b2', 'r0', 300), elim('b2', 'r0')], units, 0);
  assert.equal(t.feats('r0').bestChain, 3);
  assert.equal(t.feats('r1').bestFreeze, 3);
  assert.equal(t.feats('r0').bestTurnElims, 2, 'two in turn 5, one in turn 7');
  assert.equal(t.feats('r0').iceElims, 1);
});

test('feats survive snapshot/restore (host refresh) and keep counting', () => {
  const t = new MatchTally();
  t.shot(1, 'r0', 'heavy-bomb', [dmg('b0', 'r0', 100), elim('b0', 'r0')], units, 0);
  const r = MatchTally.restore(JSON.parse(JSON.stringify(t.snapshot())));
  r.shot(1, 'r0', 'heavy-bomb', [dmg('b1', 'r0', 100), elim('b1', 'r0')], units, 0);
  assert.equal(r.feats('r0').directHits, 2);
  assert.equal(r.feats('r0').bestTurnElims, 2, 'the per-turn count carried over the restore');
});

test('a real match: every result carries feats, consistent with the shot stats', async () => {
  const env = setup(4);
  await startMatch(env);
  const end = await playToEnd(env);
  for (const p of end.players) {
    assert.ok(p.feats, `${p.name} has feats`);
    assert.ok(p.feats.directHits <= p.hits + p.eliminations * 4, 'direct hits never exceed what landed');
  }
  assert.ok(end.players.some((p) => (p.feats?.directHits ?? 0) > 0), 'somebody landed a direct hit');
  assert.ok(end.players.some((p) => (p.feats?.carvedPx ?? 0) > 0), 'somebody carved terrain');
});
