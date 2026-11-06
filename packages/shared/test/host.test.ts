// Peer-to-peer host engine: lobby, matches, reconnection, host refresh, profile persistence.
// Run: node --experimental-strip-types --test packages/shared/test/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botAim, flush, playToEnd, prof, setup, startMatch, step } from './hostEnv.ts';
import {
  HostSession, PeerClient, memoryStore, parsePeerMessage,
  MACHINES, CONNECTION_RULES, PROTOCOL_VERSION, createProfile, toPeerProfile, creditMatch, purchase, equip, exportProfile, importProfile,
  loadProfile, saveProfile, localLeaderboard, starPlayer, PROFILE_KEY, MAX_PEER_MESSAGE_CHARS,
  DEFAULT_EQUIPPED, STARTER_MACHINES, machineItemId, ownsMachine, resultFromHistory, rememberRoom,
  type PeerProfile, type HostMessage, type AimInput, type WeaponId, type MatchEndedMsg, type MachineId, type KeyValueStore,
} from '../src/index.ts';

test('lobby over the wire: join, auto teams, host-only actions, chat limits, room full, kick, version check', async () => {
  const env = setup(8);
  await flush();
  const [host, p1] = env.peers;
  for (const p of env.peers) assert.equal(p.client.status, 'joined', p.id);
  const view = p1.client.lobby!;
  assert.equal(view.players.length, 8);
  assert.equal(view.players.filter((p) => p.team === 'red').length, 4);
  assert.ok(view.players.find((p) => p.id === 'h')!.isHost);
  // 9th player refused
  const late = env.attach('p9', prof('p9'), false, memoryStore()); await flush();
  assert.equal(late.client.closedReason, 'room full');
  // host-only
  p1.client.send({ t: 'startMatch' }); p1.client.send({ t: 'updateSettings', patch: { mapId: 'dunes' } }); await flush();
  assert.deepEqual(p1.rejected, ['only the host can do that', 'only the host can do that']);
  host.client.send({ t: 'updateSettings', patch: { mapId: 'dunes', turnSeconds: 45 } }); await flush();
  assert.equal(p1.client.lobby!.settings.mapId, 'dunes');
  // not everyone ready
  host.client.send({ t: 'startMatch' }); await flush();
  assert.match(host.rejected[0], /not ready/);
  // chat rate limit: 2/s
  for (let i = 0; i < 3; i++) p1.client.send({ t: 'chat', text: `hi ${i}` });
  await flush();
  assert.equal(p1.rejected.at(-1), 'slow down');
  assert.equal(host.client.lobby!.chat.filter((c) => c.from === 'p1').length, 2);
  // kick
  host.client.send({ t: 'kick', playerId: 'p7' }); await flush();
  assert.equal(env.peers[7].client.closedReason, 'kicked');
  assert.equal(host.client.lobby!.players.length, 7);
  // wrong protocol version
  const old = new PeerClient({ code: 'LOB-TEST', profile: prof('old'), clock: env.clock });
  const msgs: HostMessage[] = []; old.on('*', (m) => msgs.push(m));
  const link = { sent: [] as string[], send(m: HostMessage) { this.sent.push(JSON.stringify(m)); }, close() {} };
  env.session.connect(link);
  env.session.receive(link, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION + 1, profile: prof('old') }));
  assert.match(link.sent[0], /version mismatch/);
});

test('codec drops garbage and clamps numbers', () => {
  assert.equal(parsePeerMessage('{not json'), null);
  assert.equal(parsePeerMessage({ t: 'fire', aim: { angle: 'x', power: 1, weaponId: 'standard-rocket' } }), null);
  assert.equal(parsePeerMessage({ t: 'fire', aim: { angle: 1, power: 1, weaponId: 'laser' } }), null);
  assert.deepEqual(parsePeerMessage({ t: 'move', dir: 1, ticks: 999 }), { t: 'move', dir: 1, ticks: 10 });
  assert.deepEqual(parsePeerMessage({ t: 'aim', angle: -50, power: 300, weaponId: 'ice-bomb' }), { t: 'aim', angle: 0, power: 100, weaponId: 'ice-bomb' });
  assert.equal(parsePeerMessage({ t: 'updateSettings', patch: { turnSeconds: 999 } }), null);
  assert.equal(parsePeerMessage({ t: 'hello', v: 2, profile: { id: 'a', name: 'x' } }), null, 'name too short');
  assert.equal(parsePeerMessage('x'.repeat(MAX_PEER_MESSAGE_CHARS + 1)), null);
  assert.equal(parsePeerMessage({ t: 'chat', text: '   ' }), null);
});

for (const [n, mapId] of [[2, 'cobalt'], [4, 'skyreach'], [8, 'dunes']] as const) {
  test(`${n / 2}v${n / 2} match over loopback on ${mapId}: every peer stays in sync and gets the same result`, async () => {
    const env = setup(n, { seed: n });
    await startMatch(env, { mapId });
    assert.ok(env.peers.every((p) => p.client.started?.mapId === mapId));
    const result = await playToEnd(env);
    await flush();
    for (const p of env.peers) {
      assert.equal(p.desyncs, 0, `${p.id} terrain mirror matched every action`);
      assert.deepEqual(p.client.ended, result);
      assert.equal(p.client.match!.phase, 'ended');
      assert.equal(p.client.actions.length, env.peers[0].client.actions.length);
    }
    assert.ok(result.players.length === n && result.players.filter((r) => r.mvp).length === 1);
    assert.equal(env.peers[1].client.lobby!.phase, 'open', 'room reopens for Play again');
  });
}

test('out-of-turn and illegal intents are rejected without changing state', async () => {
  const env = setup(2);
  await startMatch(env);
  const m = env.session.match!;
  const active = m.turn!.playerId;
  const idle = env.peers.find((p) => p.id !== active)!;
  const before = JSON.stringify(m.world.units);
  idle.client.send({ t: 'fire', aim: { angle: 45, power: 80, weaponId: 'standard-rocket' } });
  idle.client.send({ t: 'move', dir: 1, ticks: 5 });
  await flush();
  assert.deepEqual(idle.rejected, ['not your turn', 'not your turn']);
  assert.equal(JSON.stringify(m.world.units), before);
  const me = env.peers.find((p) => p.id === active)!;
  me.client.send({ t: 'useAbility', slot: 'ultimate' }); await flush();
  assert.equal(me.rejected[0], 'ultimate not charged');
});

test('turn timer: expiry passes the turn; 3 timeouts in a row forfeit (AFK)', async () => {
  const env = setup(2);
  await startMatch(env, { turnSeconds: 20 });
  const m = env.session.match!;
  const first = m.turn!.playerId;
  await step(env.clock, 20_000 + 10);
  assert.notEqual(m.turn!.playerId, first, 'turn moved on after the timer');
  // let everybody idle: the first player to time out three times forfeits → match over
  for (let i = 0; i < 12 && !m.result; i++) await step(env.clock, 20_010);
  assert.ok(m.result, 'AFK forfeit ended the match');
  assert.ok(m.world.units.some((u) => !u.alive));
});

test('disconnect: active player drops → turn passes; reconnect with token → same seat + full snapshot', async () => {
  const env = setup(4);
  await startMatch(env);
  const m = env.session.match!;
  const active = m.turn!.playerId === 'h' ? (await (async () => { env.peers[0].client.send({ t: 'skipTurn' }); await flush(); return m.turn!.playerId; })()) : m.turn!.playerId;
  const peer = env.peers.find((p) => p.id === active)!;
  const unitId = m.turn!.unitId;
  peer.link.drop(); await flush();
  assert.notEqual(m.turn?.playerId, active, 'turn passed');
  assert.equal(env.peers[0].client.match!.connected[active], false, 'others see the disconnected badge');
  const back = env.reattach(peer); await flush();
  assert.equal(back.client.status, 'joined');
  assert.equal(back.client.playerId, active);
  assert.ok(back.client.started && back.client.match!.units.some((u) => u.id === unitId));
  assert.equal(back.mirror!.hash(), m.world.terrain.hash());
  assert.equal(env.peers[0].client.match!.connected[active], true);
});

test('a player who stays away past the reconnect window forfeits', async () => {
  const env = setup(4);
  await startMatch(env);
  const away = env.peers[3];
  away.link.drop(); await flush();
  await step(env.clock, CONNECTION_RULES.reconnectWindowSec * 1000 + 50);
  const u = env.session.match!.world.units.find((x) => x.playerId === away.id)!;
  assert.equal(u.alive, false);
});

test('host refresh mid-match: state restored from localStorage, peers rejoin, match finishes in sync', async () => {
  const store = memoryStore();
  const env = setup(4, { store, seed: 11 });
  await startMatch(env);
  let refreshed = false;
  let restored: HostSession | null = null;
  const result = await playToEnd(env, 6000, async (turn) => {
    const s = restored ?? env.session;
    const m = s.match!;
    if (turn === 4 && !refreshed) {
      refreshed = true;
      const hashBefore = m.world.terrain.hash();
      const hpBefore = m.world.units.map((u) => u.hp).join();
      // "F5" on the host: the page (and its timers) die instantly; only localStorage survives.
      const saved = memoryStore(store.dump());
      const old = env.session;
      Object.assign(old, { opts: { ...(old as unknown as { opts: object }).opts, store: undefined } });
      m.dispose();   // (no close(): a crashed/refreshed page never says goodbye)
      for (const p of env.peers) p.link.drop();
      restored = HostSession.restore({ code: 'LOB-TEST', roomName: '', host: env.host, clock: env.clock, store: saved, random: Math.random });
      assert.ok(restored, 'snapshot found');
      Object.assign(env, { session: restored });
      for (const p of [...env.peers]) env.reattach(p);
      await flush();
      const r = restored!.match!;
      assert.equal(r.world.terrain.hash(), hashBefore);
      assert.equal(r.world.units.map((u) => u.hp).join(), hpBefore);
      assert.equal(r.paused, false, 'resumed once everyone was back');
      for (const p of env.peers) assert.equal(p.mirror!.hash(), hashBefore, `${p.id} got the snapshot`);
      return;
    }
    const peer = env.peers.find((p) => p.id === m.turn!.playerId)!;
    peer.client.send({ t: 'fire', aim: botAim(s, m.turn!.unitId) });
    await flush();
  });
  assert.ok(refreshed);
  for (const p of env.peers) { assert.equal(p.desyncs, 0); assert.deepEqual(p.client.ended, result); }
});

test('profile: create → credit once → buy → equip → export/import → leaderboard; corrupt saves are quarantined', () => {
  const store = memoryStore();
  assert.equal(loadProfile(store), null);
  let p = createProfile('Kaboomerang', 'u1', 1000);
  saveProfile(store, p);
  assert.equal(loadProfile(store)!.name, 'Kaboomerang');
  assert.equal(toPeerProfile(p).id, 'u1');
  // Starter inventory uses our catalog ids; machines are owned as machine:<id>; slot names = catalog slots.
  for (const m of STARTER_MACHINES) assert.ok(ownsMachine(p, m) && p.owned.includes(machineItemId(m)));
  assert.equal(ownsMachine(p, 'boomba'), false);
  assert.deepEqual(p.equipped, DEFAULT_EQUIPPED);
  assert.deepEqual(Object.keys(p.equipped).sort(), ['emote:1', 'emote:2', 'emote:3', 'emote:4', 'explosion', 'title', 'trail']);
  assert.equal(toPeerProfile(p).title, 'Rookie');
  assert.equal(toPeerProfile({ ...p, equipped: { ...p.equipped, trail: 't-rainbow' } }).cosmetics.trail, 't-smoke', 'unowned items are not sent');
  const res: MatchEndedMsg = {
    matchId: 'LOB-TEST-1', mapId: 'cobalt', mode: 'team-deathmatch', winner: 'red', turns: 12, durationSec: 400, endedAt: 5000,
    players: [
      { playerId: 'u1', unitId: 'red-0', name: 'Kaboomerang', team: 'red', machine: 'thumper', damageDealt: 900, damageReceived: 100, eliminations: 2, assists: 1, accuracy: 60, shots: 5, hits: 3, xp: 4500, coins: 200, mvp: true, survived: true },
      { playerId: 'u2', unitId: 'blue-0', name: 'Tidecaller', team: 'blue', machine: 'mollusk', damageDealt: 100, damageReceived: 900, eliminations: 0, assists: 0, accuracy: 20, shots: 5, hits: 1, xp: 200, coins: 50, mvp: false, survived: false },
    ],
    mvpHighlight: 'Landed the final blow on Tidecaller',
    details: { damageByTurn: Array.from({ length: 20 }, (_, i) => ({ turn: i + 1, red: 50, blue: 10 })), weapons: [{ weaponId: 'heavy-bomb', shots: 3, damage: 700 }] },
  };
  const c1 = creditMatch(p, res, [{ id: 'u2', name: 'Tidecaller', level: 45, rating: 1300, title: null }]);
  assert.ok(c1.credited && c1.levelsGained === 1 && c1.coinsGained === 200 && c1.ratingChange === 25);
  p = c1.profile;
  assert.equal(creditMatch(p, res).credited, false, 'idempotent per match');
  assert.equal(p.stats.wins, 1); assert.equal(p.stats.hits, 3); assert.equal(p.history[0].mvp, true);
  assert.equal(p.recentPlayers[0].name, 'Tidecaller');
  // Results revisit: the compact summary rebuilds the result (details capped to the last 14 turns).
  const back1 = resultFromHistory(p.history[0]);
  assert.equal(back1?.mvpHighlight, res.mvpHighlight);
  assert.equal(back1?.details.damageByTurn.length, 14);
  assert.deepEqual(back1?.players, res.players);
  const buy = purchase(p, { id: 't-pixel', priceCoins: 600 });
  assert.ok(buy.ok); if (buy.ok) p = buy.value;
  assert.equal(purchase(p, { id: 't-pixel', priceCoins: 1 }).ok, false);
  assert.equal(purchase(p, { id: 's-gild', priceCoins: 99999 }).ok, false);
  assert.equal(equip(p, 'trail', 't-rainbow').ok, false, 'not owned');
  assert.equal(equip(p, 'explosion', 't-pixel').ok, false, 'wrong slot');
  const eq = equip(p, 'trail', 't-pixel'); assert.ok(eq.ok); if (eq.ok) p = eq.value;
  assert.equal(toPeerProfile(p).cosmetics.trail, 't-pixel');
  p = rememberRoom(rememberRoom(p, { code: 'LOB-AAAA', name: 'A', at: 1, hosted: true }), { code: 'LOB-BBBB', name: 'B', at: 2, hosted: false });
  assert.deepEqual(p.recentRooms.map((r) => r.code), ['LOB-BBBB', 'LOB-AAAA']);
  p = starPlayer(p, 'u2', true);
  assert.deepEqual(localLeaderboard(p).map((r) => r.id), ['u2', 'u1']);
  const code = exportProfile(p);
  const back = importProfile(code);
  assert.ok(back.ok); if (back.ok) assert.deepEqual(back.value, p);
  assert.equal(importProfile(code.slice(0, -4) + 'AAAA').ok, false);
  store.setItem(PROFILE_KEY, '{"v":1,');
  assert.equal(loadProfile(store), null);
  assert.ok(store.getItem(`${PROFILE_KEY}:corrupt`));
});

test('machines in a P2P match keep their stats and loadouts (Items off)', async () => {
  const env = setup(2);
  await startMatch(env, { itemsEnabled: false });
  const w = env.session.match!.world;
  for (const u of w.units) assert.deepEqual(Object.keys(u.ammo).sort(), [...MACHINES[u.machine].loadout].sort());
});
