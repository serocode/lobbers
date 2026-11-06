// Behaviour carried over from the Colyseus/MatchFlow version into HostSession/HostMatch (P2P migration, step 1):
// forfeits, skipped-turn forfeit, emotes + cosmetics, the Results tally (incl. rejoin + host refresh), chat
// hygiene, ping RTT, burn zones on turn start, reconnect deadlines, host leaving closes the room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botAim, flush, playToEnd, prof, setup, startMatch, step } from './hostEnv.ts';
import {
  CONNECTION_RULES, DEFAULT_EQUIPPED, DEFAULT_LOADOUT, EMOTE_RULES, HostSession, MatchTally, memoryStore, parsePeerMessage, sanitizeLoadout,
  type HostMessage, type MatchDetails,
} from '../src/index.ts';

test('forfeit removes only the sender; surrender in 1v1 ends the match for the other team', async () => {
  const env = setup(4);
  await startMatch(env);
  const m = env.session.match!;
  const [host, p1] = env.peers;
  p1.client.send({ t: 'forfeit' }); await flush();
  const mine = m.world.units.find((u) => u.playerId === p1.id)!;
  assert.equal(mine.alive, false);
  assert.equal(m.world.units.filter((u) => !u.alive).length, 1, 'nobody else');
  assert.ok(host.client.actions.some((a) => a.kind === 'forfeit' && a.unitId === mine.id));
  const solo = setup(2);
  await startMatch(solo);
  solo.peers[1].client.send({ t: 'forfeit' }); await flush();
  await step(solo.clock, 3000);
  assert.equal(solo.session.match!.result?.winner, 'red');
});

test(`${CONNECTION_RULES.maxSkippedTurnsWhileDisconnected} skipped turns while disconnected → forfeit`, async () => {
  const env = setup(4);
  await startMatch(env);
  const m = env.session.match!;
  const away = env.peers.find((p) => p.id !== 'h' && p.id !== m.turn!.playerId)!;
  away.link.drop(); await flush();
  for (let i = 0; i < 8 && m.world.units.find((u) => u.playerId === away.id)!.alive; i++) {
    const active = env.peers.find((p) => p.id === m.turn?.playerId);
    active?.client.send({ t: 'skipTurn' }); await flush();
  }
  assert.equal(m.world.units.find((u) => u.playerId === away.id)!.alive, false);
  assert.ok(env.peers[0].client.match!.reconnectUntil[away.id] > 0, 'deadline shown while away');
});

test('emotes: own 4 equipped emotes only, any time, cooldown; cosmetics resolved into matchStarted', async () => {
  const env = setup(2);
  // Re-join p1 with a fancy (catalog-valid) loadout and one bogus slot.
  const fancy = { ...DEFAULT_EQUIPPED, trail: 't-rainbow', 'skin:voltaic': 's-thunder', 'emote:2': 'e-boom', explosion: 'not-a-thing' };
  env.peers[1].link.drop(); await flush();
  env.peers[1] = env.attach('p1', { ...prof('p1', 'voltaic'), cosmetics: fancy }, false, memoryStore());
  await startMatch(env);
  const started = env.peers[0].client.started!;
  const u1 = started.units.find((u) => u.playerId === 'p1')!;
  assert.equal(started.cosmetics[u1.id].trail.style, 'rainbow');
  assert.equal(started.cosmetics[u1.id].paint, '#7C88C2');
  assert.equal(started.cosmetics[u1.id].explosion.style, 'classic', 'unknown id falls back to the default');
  const seen: HostMessage[] = [];
  env.peers[0].client.on('emote', (m) => seen.push(m));
  const p1 = env.peers[1];
  p1.client.send({ t: 'emote', slot: 1 }); await flush();       // not p1's turn — emotes are allowed any time
  assert.deepEqual(seen[0], { t: 'emote', unitId: u1.id, emoteId: 'e-boom' });
  p1.client.send({ t: 'emote', slot: 0 }); await flush();
  assert.equal(p1.rejected.at(-1), 'slow down');
  await step(env.clock, EMOTE_RULES.cooldownMs);
  p1.client.send({ t: 'emote', slot: 0 }); await flush();
  assert.equal(seen.length, 2);
  assert.equal(parsePeerMessage({ t: 'emote', slot: 9 }), null, 'codec drops bad slots');
  assert.deepEqual(sanitizeLoadout({}, new Set()), DEFAULT_LOADOUT);
});

test('Results tally: MVP line + details on matchEnded; a peer that rejoined mid-match gets identical details', async () => {
  const env = setup(4, { seed: 5 });
  await startMatch(env);
  let dropped = false;
  const result = await playToEnd(env, 6000, async (turn) => {
    const m = env.session.match!;
    if (turn === 3 && !dropped) {
      dropped = true;
      const p = env.peers[2];
      p.link.drop(); await flush();
      env.reattach(p); await flush();
      return;
    }
    const peer = env.peers.find((p) => p.id === m.turn!.playerId && p.client.status === 'joined');
    if (peer) { peer.client.send({ t: 'fire', aim: botAim(env.session, m.turn!.unitId) }); await flush(); }
    else { env.peers[0].client.send({ t: 'skipTurn' }); await flush(); }
  });
  await flush();
  assert.ok(result.mvpHighlight.length > 0);
  assert.ok(result.details.damageByTurn.some((t) => t.red + t.blue > 0));
  assert.ok(result.details.weapons.length > 0);
  for (const p of env.peers) assert.deepEqual(p.client.ended?.details, result.details, `${p.id} got the same details`);
});

test('Results tally survives a host refresh mid-match', async () => {
  const store = memoryStore();
  const env = setup(2, { store, seed: 9 });
  await startMatch(env);
  let before: MatchDetails | null = null;
  let restored: HostSession | null = null;
  const result = await playToEnd(env, 6000, async (turn) => {
    const s = restored ?? env.session;
    const m = s.match!;
    if (turn === 5 && !restored) {
      before = MatchTally.restore(m.snapshot().tally).details();
      const saved = memoryStore(store.dump());
      m.dispose();
      for (const p of env.peers) p.link.drop();
      restored = HostSession.restore({ code: 'LOB-TEST', roomName: '', host: env.host, clock: env.clock, store: saved, random: Math.random });
      assert.ok(restored);
      Object.assign(env, { session: restored });
      for (const p of [...env.peers]) env.reattach(p);
      await flush();
      return;
    }
    const peer = env.peers.find((p) => p.id === m.turn!.playerId)!;
    peer.client.send({ t: 'fire', aim: botAim(s, m.turn!.unitId) });
    await flush();
  });
  assert.ok(before);
  const pre = before as MatchDetails;
  assert.ok(pre.damageByTurn.length > 0, 'damage before the refresh');
  for (const t of pre.damageByTurn) assert.deepEqual(result.details.damageByTurn.find((x) => x.turn === t.turn), t, `turn ${t.turn} kept`);
  for (const w of pre.weapons) assert.ok((result.details.weapons.find((x) => x.weaponId === w.weaponId)?.shots ?? 0) >= w.shots);
});

test('lobby hygiene: chat masked, unknown machine dropped, team full, ping RTT shown on the slot', async () => {
  const env = setup(8);
  await flush();
  const [host, p1] = env.peers;
  p1.client.send({ t: 'chat', text: '  well   shit  ' }); await flush();
  assert.equal(host.client.lobby!.chat.at(-1)?.text, 'well s***');
  const before = JSON.stringify(host.client.lobby!.players);
  p1.client.send({ t: 'setMachine', machine: 'death-star' } as never); await flush();
  assert.equal(JSON.stringify(host.client.lobby!.players), before, 'codec dropped it');
  const blue = env.peers.find((p) => host.client.lobby!.players.find((x) => x.id === p.id)?.team === 'blue')!;
  blue.client.send({ t: 'setTeam', team: 'red' }); await flush();
  assert.equal(blue.rejected.at(-1), 'team full');
  await step(env.clock, 4000);   // two ping rounds: the second carries the measured RTT
  assert.equal(typeof host.client.lobby!.players.find((x) => x.id === 'p1')!.ping, 'number');
});

test('burn zones ride on turnStarted; reconnect deadline appears while away and clears on rejoin', async () => {
  const env = setup(4);
  await startMatch(env);
  assert.ok(Array.isArray(env.peers[1].client.turn!.burnZones));
  const m = env.session.match!;
  const away = env.peers.find((p) => p.id !== 'h' && p.id !== m.turn!.playerId)!;
  away.link.drop(); await flush();
  const until = env.peers[0].client.match!.reconnectUntil[away.id];
  assert.ok(until > env.clock.now() && until <= env.clock.now() + CONNECTION_RULES.reconnectWindowSec * 1000);
  env.reattach(away); await flush();
  assert.equal(env.peers[0].client.match!.reconnectUntil[away.id], undefined);
});

test('host leaving closes the room for everyone (no host transfer)', async () => {
  const env = setup(3);
  await flush();
  env.peers[0].client.send({ t: 'leave' }); await flush(); await flush();
  for (const p of env.peers.slice(1)) assert.equal(p.client.closedReason, 'host closed the room');
});
