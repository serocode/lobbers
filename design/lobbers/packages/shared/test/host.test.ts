// Peer-to-peer host engine: lobby, matches, reconnection, host refresh, profile persistence.
// Run: node --experimental-strip-types --test packages/shared/test/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HostSession, PeerClient, ManualClock, connectLoopback, WorldMirror, memoryStore, parsePeerMessage, Terrain, predictTrajectory, unitById, createRng,
  MACHINES, WEAPONS, CONNECTION_RULES, PROTOCOL_VERSION, createProfile, toPeerProfile, creditMatch, purchase, equip, exportProfile, importProfile,
  loadProfile, saveProfile, localLeaderboard, starPlayer, PROFILE_KEY, MAX_PEER_MESSAGE_CHARS,
  type PeerProfile, type HostMessage, type AimInput, type WeaponId, type MatchEndedMsg, type MachineId, type KeyValueStore,
} from '../src/index.ts';

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));
const prof = (id: string, machine: MachineId = 'thumper'): PeerProfile => ({ id, name: `Player ${id}`, level: 3, rating: 1000, title: null, avatar: null, favoriteMachine: machine, cosmetics: {} });

interface Peer { id: string; client: PeerClient; link: { drop(): void }; tokens: KeyValueStore; mirror: Terrain | null; desyncs: number; rejected: string[] }

function setup(n: number, opts: { store?: KeyValueStore; seed?: number } = {}) {
  const clock = new ManualClock();
  const rng = createRng(opts.seed ?? 7);
  const machines: MachineId[] = ['thumper', 'voltaic', 'cinder', 'mollusk', 'sprocket', 'boomba', 'frostbite', 'whirligig'];
  const host = prof('h', machines[0]);
  const session = new HostSession({ code: 'LOB-TEST', roomName: 'Test room', host, clock, store: opts.store, random: () => rng.next() });
  const peers: Peer[] = [];
  // eslint-disable-next-line prefer-const
  let env: { clock: ManualClock; session: HostSession; peers: Peer[]; host: PeerProfile; reattach: (p: Peer) => Peer; attach: (id: string, profile: PeerProfile, local: boolean, tokens: KeyValueStore) => Peer };
  const attach = (id: string, profile: PeerProfile, local: boolean, tokens: KeyValueStore): Peer => {
    const client = new PeerClient({ code: 'LOB-TEST', profile, clock, tokenStore: tokens });
    const p: Peer = { id, client, link: { drop() {} }, tokens, mirror: null, desyncs: 0, rejected: [] };
    // Exactly what the real client does: a WorldMirror per match, carving the same circles.
    let wm: WorldMirror | null = null;
    client.on('matchStarted', (m) => { if (m.t === 'matchStarted') { wm = new WorldMirror(m.data); p.mirror = wm.world.terrain; } });
    client.on('actionResolved', (m) => { if (m.t === 'actionResolved' && wm && !wm.applyAction(m.data)) p.desyncs++; });
    client.on('rejected', (m) => { if (m.t === 'rejected') p.rejected.push(m.reason); });
    p.link = connectLoopback(env.session, client, { local });
    return p;
  };
  const reattach = (p: Peer): Peer => { const q = attach(p.id, prof(p.id, machines[peers.indexOf(p) % 8]), p.id === 'h', p.tokens); peers[peers.indexOf(p)] = q; return q; };
  env = { clock, session, peers, host, reattach, attach };
  peers.push(attach('h', host, true, memoryStore()));
  for (let i = 1; i < n; i++) peers.push(attach(`p${i}`, prof(`p${i}`, machines[i % 8]), false, memoryStore()));
  return env;
}

/** Advances time in ≤1 s slices so peer pings (delivered as microtasks) keep links alive, like real time would. */
async function step(clock: ManualClock, ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 1000) { clock.advance(Math.min(1000, left)); await flush(); }
}

/** Picks a real aim at the nearest enemy using the shared preview (still sent as an intent through the link). */
function botAim(s: HostSession, unitId: string): AimInput {
  const w = s.match!.world;
  const me = unitById(w, unitId);
  const foe = w.units.filter((u) => u.alive && u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
  const weaponId: WeaponId = (Object.keys(me.ammo) as WeaponId[]).find((id) => (me.ammo[id] ?? 0) !== 0 && !me.weaponCooldowns[id] && WEAPONS[id].damage >= 140) ?? 'standard-rocket';
  const angle = foe.x > me.x ? 52 : 128;
  let best: AimInput = { angle, power: 60, weaponId }, bd = Infinity;
  for (let p = 20; p <= 100; p += 1) {
    const r = predictTrajectory(w, unitId, { angle, power: p, weaponId });
    if (!r.hit || r.hit.kind === 'out') continue;
    const d = Math.abs(r.hit.x - foe.x);
    if (d < bd) { bd = d; best = { angle, power: p, weaponId }; }
  }
  return best;
}

async function playToEnd(env: ReturnType<typeof setup>, maxSteps = 4000, onTurn?: (turn: number) => Promise<void> | void): Promise<MatchEndedMsg> {
  let lastTurn = -1;
  for (let i = 0; i < maxSteps; i++) {
    await flush();
    const { clock, session } = env;
    const m = session.match!;
    if (m.result) return m.result;
    if (m.turn && m.phase === 'acting' && !m.paused) {
      const t = m.view().turnNumber;
      if (t !== lastTurn) {
        lastTurn = t;
        if (onTurn) { await onTurn(t); continue; }
        const peer = env.peers.find((p) => p.id === m.turn!.playerId && p.client.status === 'joined');
        if (peer) { peer.client.send({ t: 'fire', aim: botAim(session, m.turn.unitId) }); await flush(); continue; }
      }
    }
    await step(clock, 250);
  }
  throw new Error('match did not finish');
}

async function startMatch(env: ReturnType<typeof setup>, patch: Record<string, unknown> = {}): Promise<void> {
  const [host, ...guests] = env.peers;
  await flush();
  if (Object.keys(patch).length) host.client.send({ t: 'updateSettings', patch });
  await flush();
  for (const g of guests) g.client.send({ t: 'setReady', ready: true });
  await flush();
  host.client.send({ t: 'startMatch' });
  await flush();
  await step(env.clock, 3000);   // countdown
  for (const p of env.peers) p.client.send({ t: 'loaded' });
  await flush();
}

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
  const res: MatchEndedMsg = {
    matchId: 'LOB-TEST-1', mapId: 'cobalt', mode: 'team-deathmatch', winner: 'red', turns: 12, durationSec: 400, endedAt: 5000,
    players: [
      { playerId: 'u1', unitId: 'red-0', name: 'Kaboomerang', team: 'red', machine: 'thumper', damageDealt: 900, damageReceived: 100, eliminations: 2, assists: 1, accuracy: 60, shots: 5, hits: 3, xp: 4500, coins: 200, mvp: true, survived: true },
      { playerId: 'u2', unitId: 'blue-0', name: 'Tidecaller', team: 'blue', machine: 'mollusk', damageDealt: 100, damageReceived: 900, eliminations: 0, assists: 0, accuracy: 20, shots: 5, hits: 1, xp: 200, coins: 50, mvp: false, survived: false },
    ],
  };
  const c1 = creditMatch(p, res, [{ id: 'u2', name: 'Tidecaller', level: 45, rating: 1300, title: null }]);
  assert.ok(c1.credited && c1.levelsGained === 1 && c1.coinsGained === 200 && c1.ratingChange === 25);
  p = c1.profile;
  assert.equal(creditMatch(p, res).credited, false, 'idempotent per match');
  assert.equal(p.stats.wins, 1); assert.equal(p.stats.hits, 3); assert.equal(p.history[0].mvp, true);
  assert.equal(p.recentPlayers[0].name, 'Tidecaller');
  const buy = purchase(p, { id: 'trail:comet', priceCoins: 300 });
  assert.ok(buy.ok); if (buy.ok) p = buy.value;
  assert.equal(purchase(p, { id: 'trail:comet', priceCoins: 1 }).ok, false);
  assert.equal(purchase(p, { id: 'skin:gold', priceCoins: 99999 }).ok, false);
  assert.equal(equip(p, 'trail', 'trail:nope').ok, false);
  const eq = equip(p, 'trail', 'trail:comet'); assert.ok(eq.ok); if (eq.ok) p = eq.value;
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
