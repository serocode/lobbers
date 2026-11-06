// Bots: host-only lobby intents, the shot planner, whole matches against bots, host refresh with bots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flush, playToEnd, prof, setup, startMatch, step } from './hostEnv.ts';
import {
  BOT_TUNING, HostSession, PeerClient, createProfile, createRng, createWorld, creditMatch, memoryStore, parsePeerMessage, planShot, predictTrajectory,
  DEFAULT_SETTINGS, PROTOCOL_VERSION, hitCenter, type HostMessage, type MatchEndedMsg,
} from '../src/index.ts';

test('lobby: host adds, re-tunes and removes bots; bots are always ready; guests cannot', async () => {
  const env = setup(2);
  await flush();
  const [host, guest] = env.peers;
  guest.client.send({ t: 'addBot', team: 'blue', difficulty: 'easy' }); await flush();
  assert.equal(guest.rejected.at(-1), 'only the host can do that');
  host.client.send({ t: 'addBot', team: 'blue', difficulty: 'hard', machine: 'cinder' });
  host.client.send({ t: 'addBot', team: 'red', difficulty: 'normal' });
  await flush();
  const bots = host.client.lobby!.players.filter((p) => p.bot);
  assert.equal(bots.length, 2);
  const blueBot = bots.find((b) => b.team === 'blue')!;
  assert.deepEqual([blueBot.bot, blueBot.machine, blueBot.ready, blueBot.connected], ['hard', 'cinder', true, true]);
  assert.match(blueBot.name, /^Bot /);
  assert.notEqual(bots[0].name, bots[1].name);
  // Settings change: humans re-confirm, bots stay ready.
  guest.client.send({ t: 'setReady', ready: true }); await flush();
  host.client.send({ t: 'updateSettings', patch: { mapId: 'dunes' } }); await flush();
  const after = host.client.lobby!.players;
  assert.equal(after.find((p) => p.id === 'p1')!.ready, false);
  assert.ok(after.filter((p) => p.bot).every((p) => p.ready));
  // Difficulty
  host.client.send({ t: 'setBot', playerId: blueBot.id, difficulty: 'easy' }); await flush();
  assert.equal(host.client.lobby!.players.find((p) => p.id === blueBot.id)!.bot, 'easy');
  host.client.send({ t: 'setBot', playerId: 'p1', difficulty: 'easy' }); await flush();
  assert.equal(host.rejected.at(-1), 'not a bot');
  // Team full
  for (let i = 0; i < 3; i++) host.client.send({ t: 'addBot', team: 'blue', difficulty: 'easy' });
  await flush();
  assert.equal(host.rejected.at(-1), 'team full');
  // Remove with kick
  host.client.send({ t: 'kick', playerId: blueBot.id }); await flush();
  assert.ok(!host.client.lobby!.players.some((p) => p.id === blueBot.id));
  env.session.close();
});

test('codec + hello: bot intents are validated, humans cannot claim a bot id', () => {
  assert.deepEqual(parsePeerMessage({ t: 'addBot', team: 'red', difficulty: 'hard', machine: 'nope' }), { t: 'addBot', team: 'red', difficulty: 'hard' });
  assert.equal(parsePeerMessage({ t: 'addBot', team: 'red', difficulty: 'godlike' }), null);
  assert.equal(parsePeerMessage({ t: 'setBot', playerId: 'bot-1' }), null);
  const env = setup(1);
  const link = { sent: [] as string[], send(m: HostMessage) { this.sent.push(JSON.stringify(m)); }, close() {} };
  env.session.connect(link);
  env.session.receive(link, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, profile: prof('bot-1') }));
  assert.match(link.sent[0], /bad hello/);
  env.session.close();
});

test('planner: a hard bot on a calm field lands its shell on or next to an enemy', () => {
  const settings = { ...DEFAULT_SETTINGS, wind: 'off' as const, mapId: 'cobalt' as const };
  const world = createWorld(settings, [
    { playerId: 'a', name: 'Alpha', team: 'red', machine: 'thumper', slot: 0 },
    { playerId: 'b', name: 'Bravo', team: 'blue', machine: 'mollusk', slot: 0 },
  ]);
  const me = world.units.find((u) => u.playerId === 'a')!, foe = world.units.find((u) => u.playerId === 'b')!;
  const plan = planShot(world, me.id, { ...BOT_TUNING.hard, angleErrorSd: 0, powerErrorSd: 0 }, createRng(3));
  assert.ok(plan, 'has a plan');
  assert.ok(plan.expected > 30, `expected damage ${plan.expected}`);
  const { hit } = predictTrajectory(world, me.id, plan.aim);
  const c = hitCenter(foe);
  assert.ok(hit && Math.hypot(hit.x - c.x, hit.y - c.y) < 80, `lands ${hit ? Math.round(Math.hypot(hit.x - c.x, hit.y - c.y)) : '∞'} px away`);
});

test('match vs bots: a passive host loses to two hard bots; results tag bots; bots never become Recent players', async () => {
  const env = setup(1);
  await flush();
  const [host] = env.peers;
  host.client.send({ t: 'addBot', team: 'blue', difficulty: 'hard' });
  host.client.send({ t: 'addBot', team: 'blue', difficulty: 'hard' });
  await startMatch(env, { wind: 'calm' });
  const rejectedBefore = host.rejected.length;
  const result: MatchEndedMsg = await playToEnd(env, 6000, async () => { if (env.session.match!.turn?.playerId === 'h') host.client.send({ t: 'skipTurn' }); await step(env.clock, 250); });
  assert.equal(result.winner, 'blue');
  const bots = result.players.filter((p) => p.bot);
  assert.equal(bots.length, 2);
  assert.ok(bots.every((b) => b.bot === 'hard'));
  assert.ok(bots.reduce((n, b) => n + b.hits, 0) > 0, 'bots hit something');
  assert.equal(host.rejected.length, rejectedBefore);
  const me = { ...createProfile('Host', 'h', 0) };
  const credited = creditMatch(me, result);
  assert.ok(credited.credited);
  assert.equal(credited.profile.recentPlayers.length, 0);
  env.session.close();
});

test('mixed room: humans and bots on both teams play a full match to the end', async () => {
  const env = setup(2);
  await flush();
  const [host] = env.peers;
  host.client.send({ t: 'addBot', team: 'red', difficulty: 'easy' });
  host.client.send({ t: 'addBot', team: 'blue', difficulty: 'normal' });
  await flush();
  assert.equal(host.client.lobby!.players.length, 4);
  await startMatch(env);
  const result = await playToEnd(env, 8000);
  assert.ok(['red', 'blue', 'draw'].includes(result.winner));
  assert.equal(result.players.length, 4);
  assert.ok(result.players.filter((p) => p.bot).every((p) => p.shots > 0), 'every bot took shots');
  assert.equal(env.peers.reduce((n, p) => n + p.desyncs, 0), 0);
  // Play again: bots stay seated and ready.
  await step(env.clock, 500);
  const lobby = host.client.lobby!;
  assert.equal(lobby.phase, 'open');
  assert.ok(lobby.players.filter((p) => p.bot).every((p) => p.ready && p.connected));
  env.session.close();
});

test('host refresh mid-match: bots come back with the host and finish the match', async () => {
  const store = memoryStore();
  const env = setup(1, { store });
  await flush();
  const [host] = env.peers;
  host.client.send({ t: 'addBot', team: 'blue', difficulty: 'normal' });
  await startMatch(env);
  // A few turns, then the host's tab reloads.
  for (let i = 0; i < 40 && (env.session.match!.view().turnNumber < 3); i++) {
    const m = env.session.match!;
    if (m.turn?.playerId === 'h' && m.phase === 'acting') { host.client.send({ t: 'skipTurn' }); await flush(); }
    await step(env.clock, 500);
  }
  assert.ok(env.session.match!.view().turnNumber >= 3);
  // "F5" on the host: the page, its timers and its bots die instantly; only localStorage survives.
  const saved = memoryStore(store.dump());
  const old = env.session as unknown as { opts: object; bots: { disposeAll(): void } };
  Object.assign(old, { opts: { ...old.opts, store: undefined } });
  old.bots.disposeAll();
  env.session.match!.dispose();
  host.link.drop();
  const restored = HostSession.restore({ code: 'LOB-TEST', roomName: '', host: env.host, clock: env.clock, store: saved });
  assert.ok(restored, 'snapshot restored');
  Object.assign(env, { session: restored });
  const hostAgain = env.reattach(host);
  await flush();
  const bot = restored.lobby.players.find((p) => p.bot)!;
  assert.ok(restored.connectedPlayers().includes(bot.id), 'bot re-attached');
  const result = await playToEnd(env, 8000, async () => { if (env.session.match!.turn?.playerId === 'h') hostAgain.client.send({ t: 'skipTurn' }); await step(env.clock, 250); });
  assert.equal(result.winner, 'blue');
  restored.close();
});

test('a bot seat can only be bound by the host tab (PeerClient for a non-bot id is refused)', async () => {
  const env = setup(1);
  const c = new PeerClient({ code: 'LOB-TEST', profile: prof('x'), clock: env.clock });
  const sent: HostMessage[] = [];
  env.session.connectBot({ send: (m) => sent.push(m), close: () => sent.push({ t: 'closed', reason: 'bad hello' }) }, 'p-not-a-bot');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].t, 'closed');
  void c;
  env.session.close();
});
