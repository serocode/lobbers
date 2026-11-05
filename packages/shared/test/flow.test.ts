// Run: pnpm test:core — MatchFlow (shared authoritative state machine) with a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECTION_RULES, DEFAULT_SETTINGS, MatchFlow, predictTrajectory, unitById,
  type FlowClock, type MatchStateView, type SeatInput, type ServerMessage, type MatchSettings,
} from '../src/index.ts';

class FakeClock implements FlowClock {
  t = 1_000_000;
  private seq = 0;
  private q = new Map<number, { at: number; fn: () => void }>();
  now(): number { return this.t; }
  setTimeout(fn: () => void, ms: number): unknown { const id = ++this.seq; this.q.set(id, { at: this.t + Math.max(0, ms), fn }); return id; }
  clearTimeout(h: unknown): void { this.q.delete(h as number); }
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.q) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.q.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
}

const SETTINGS: MatchSettings = { ...DEFAULT_SETTINGS, wind: 'off', turnSeconds: 20 };

function setup(seats: SeatInput[], settings = SETTINGS) {
  const clock = new FakeClock();
  const msgs: ServerMessage[] = [];
  let state: MatchStateView | null = null;
  const flow = new MatchFlow({ settings, seats, seed: 3, clock, introDelayMs: 0, sink: { message: (m) => msgs.push(m), state: (s) => { state = s; } } });
  flow.start();
  clock.advance(1);
  return { clock, msgs, flow, state: (): MatchStateView => { assert.ok(state); return state; } };
}

const oneVsOne: SeatInput[] = [
  { playerId: 'alice', name: 'Alice', team: 'red', machine: 'thumper', slot: 0 },
  { playerId: 'bob', name: 'Bob', team: 'blue', machine: 'mollusk', slot: 0 },
];
const twoVsTwo: SeatInput[] = [
  ...oneVsOne,
  { playerId: 'cara', name: 'Cara', team: 'red', machine: 'voltaic', slot: 1 },
  { playerId: 'dan', name: 'Dan', team: 'blue', machine: 'cinder', slot: 1 },
];
const last = <T extends ServerMessage['t']>(msgs: ServerMessage[], t: T): Extract<ServerMessage, { t: T }> | undefined =>
  [...msgs].reverse().find((m): m is Extract<ServerMessage, { t: T }> => m.t === t);

test('flow: red starts, out-of-turn intents are rejected, a shot resolves and the turn passes', () => {
  const { clock, msgs, flow, state } = setup(oneVsOne);
  assert.equal(msgs[0]?.t, 'matchStarted');
  assert.equal(state().activeUnitId, 'red-0');
  assert.equal(state().phase, 'acting');
  flow.handle('bob', { t: 'fire', aim: { angle: 120, power: 60, weaponId: 'standard-rocket' } });
  assert.deepEqual(last(msgs, 'rejected'), { t: 'rejected', intent: 'fire', reason: 'not your turn' });
  flow.handle('alice', { t: 'fire', aim: { angle: 50, power: 70, weaponId: 'standard-rocket' } });
  assert.equal(last(msgs, 'actionResolved')?.data.kind, 'shot');
  assert.equal(state().phase, 'resolving');
  flow.handle('alice', { t: 'move', dir: 1, ticks: 5 });
  assert.equal(last(msgs, 'rejected')?.reason, 'not accepting actions');
  clock.advance(20_000);
  assert.equal(state().activeUnitId, 'blue-0');
  flow.dispose();
});

test('flow: clients cannot forge another unit — forfeit only removes the sender', () => {
  const { msgs, flow } = setup(twoVsTwo);
  flow.handle('dan', { t: 'forfeit' });
  const a = last(msgs, 'actionResolved');
  assert.equal(a?.data.kind, 'forfeit');
  assert.equal(a?.data.unitId, 'blue-1');
  assert.equal(unitById(flow.world, 'blue-0').alive, true);
  assert.equal(unitById(flow.world, 'red-0').alive, true);
  flow.dispose();
});

test('flow: surrender in 1v1 ends the match for the other team', () => {
  const { msgs, flow, state } = setup(oneVsOne);
  flow.handle('alice', { t: 'forfeit' });
  const end = last(msgs, 'matchEnded');
  assert.equal(end?.data.winner, 'blue');
  assert.equal(end?.data.players.find((p) => p.playerId === 'alice')?.survived, false);
  assert.equal(state().phase, 'ended');
  flow.dispose();
});

test('flow: active player disconnecting ends their turn now; their turns are skipped; reconnect resumes', () => {
  const { clock, msgs, flow, state } = setup(twoVsTwo);
  assert.equal(state().activeUnitId, 'red-0');
  flow.disconnected('alice');
  assert.equal(state().activeUnitId, 'blue-0');
  assert.ok(state().offline.alice > clock.now());
  flow.handle('bob', { t: 'skipTurn' });
  assert.equal(state().activeUnitId, 'red-1', 'red rotates to Cara');
  flow.handle('cara', { t: 'skipTurn' });
  flow.handle('dan', { t: 'skipTurn' });
  const turn = last(msgs, 'turnStarted');
  assert.equal(turn?.data.activeUnitId, 'red-1', 'Alice skipped again');
  assert.deepEqual(turn?.data.skipped, ['red-0']);
  flow.reconnected('alice');
  assert.deepEqual(state().offline, {});
  flow.handle('cara', { t: 'skipTurn' });
  flow.handle('bob', { t: 'skipTurn' });
  assert.equal(state().activeUnitId, 'red-0', 'Alice plays again after reconnecting');
  flow.dispose();
});

test(`flow: ${CONNECTION_RULES.maxSkippedTurnsWhileDisconnected} skipped turns while disconnected → forfeit`, () => {
  const { msgs, flow } = setup(twoVsTwo);
  flow.handle('alice', { t: 'skipTurn' });
  flow.disconnected('cara');
  for (let i = 0; i < 6 && unitById(flow.world, 'red-1').alive; i++) {
    const active = flow.activePlayerId;
    assert.ok(active);
    flow.handle(active, { t: 'skipTurn' });
  }
  assert.equal(unitById(flow.world, 'red-1').alive, false);
  assert.ok(msgs.some((m) => m.t === 'actionResolved' && m.data.kind === 'forfeit' && m.data.unitId === 'red-1'));
  flow.dispose();
});

test('flow: reconnect window expiry forfeits; everyone offline waits instead of ending', () => {
  const { clock, msgs, flow, state } = setup(oneVsOne);
  flow.disconnected('alice');
  flow.disconnected('bob');
  assert.equal(state().phase, 'waiting');
  assert.equal(flow.isEnded, false);
  flow.reconnected('bob');
  assert.equal(state().activeUnitId, 'blue-0');
  clock.advance(CONNECTION_RULES.reconnectWindowSec * 1000 + 10);
  assert.equal(last(msgs, 'matchEnded')?.data.winner, 'blue');
  flow.dispose();
});

test(`flow: ${CONNECTION_RULES.maxConsecutiveTimeouts} idle timeouts in a row → AFK forfeit`, () => {
  const { clock, msgs, flow } = setup(oneVsOne);
  for (let i = 0; i < CONNECTION_RULES.maxConsecutiveTimeouts * 2 && !flow.isEnded; i++) {
    if (flow.activePlayerId === 'bob') flow.handle('bob', { t: 'skipTurn' });
    else clock.advance(SETTINGS.turnSeconds * 1000 + 100);
  }
  assert.equal(last(msgs, 'matchEnded')?.data.winner, 'blue');
  flow.dispose();
});

test('flow: reconnect snapshot carries current terrain/units and the current turn', () => {
  const { clock, flow } = setup(oneVsOne);
  const red = unitById(flow.world, 'red-0'), blue = unitById(flow.world, 'blue-0');
  let best = { angle: 50, power: 60 }, bd = Infinity;
  for (let p = 20; p <= 100; p++) {
    const r = predictTrajectory(flow.world, red.id, { angle: 50, power: p, weaponId: 'heavy-bomb' });
    if (r.hit && r.hit.kind !== 'out') { const d = Math.abs(r.hit.x - blue.x); if (d < bd) { bd = d; best = { angle: 50, power: p }; } }
  }
  const before = flow.startSnapshot().terrainHash;
  flow.handle('alice', { t: 'fire', aim: { ...best, weaponId: 'heavy-bomb' } });
  clock.advance(10_000);
  const snap = flow.startSnapshot();
  assert.notEqual(snap.terrainHash, before, 'crater is in the snapshot');
  assert.deepEqual(snap.units.map((u) => [u.id, u.hp, u.x, u.y]), flow.world.units.map((u) => [u.id, u.hp, u.x, u.y]));
  assert.equal(flow.currentTurn()?.activeUnitId, 'blue-0');
  assert.deepEqual(flow.currentTurn()?.events, []);
  flow.dispose();
});

test('cosmetics: loadouts are sanitised against owned items; snapshot carries resolved cosmetics', async () => {
  const { DEFAULT_ITEMS, DEFAULT_LOADOUT, sanitizeLoadout } = await import('../src/index.ts');
  const owned = new Set([...DEFAULT_ITEMS, 's-coral', 't-ember', 'b-plasma']);
  const l = sanitizeLoadout({ skins: { mollusk: 's-coral', thumper: 's-coral', cinder: 's-ash' }, trail: 't-ember', explosion: 'b-confetti', title: 'e-gg', emotes: ['e-oops', 'e-oops', 'e-boom', 42] }, owned);
  assert.deepEqual(l.skins, { mollusk: 's-coral' }, 'wrong machine and unowned skins dropped');
  assert.equal(l.trail, 't-ember');
  assert.equal(l.explosion, DEFAULT_LOADOUT.explosion, 'unowned → default');
  assert.equal(l.title, DEFAULT_LOADOUT.title, 'wrong slot → default');
  assert.deepEqual(l.emotes, ['e-oops', 'e-gg', 'e-nice', 'e-wind'], 'deduped, unowned dropped, topped up to 4');
  assert.deepEqual(sanitizeLoadout('garbage', owned), DEFAULT_LOADOUT);

  const clock = new FakeClock();
  const msgs: ServerMessage[] = [];
  const flow = new MatchFlow({ settings: SETTINGS, seats: oneVsOne, seed: 1, clock, introDelayMs: 0, cosmetics: { bob: l }, sink: { message: (m) => msgs.push(m), state: () => undefined } });
  flow.start();
  const start = msgs.find((m): m is Extract<ServerMessage, { t: 'matchStarted' }> => m.t === 'matchStarted')!.data;
  assert.equal(start.cosmetics['blue-0'].paint, '#FF8A7A');
  assert.equal(start.cosmetics['blue-0'].trail.style, 'sparks');
  assert.equal(start.cosmetics['red-0'].paint, null);
  flow.handle('alice', { t: 'emote', slot: 1 });
  assert.deepEqual(last(msgs, 'emote'), { t: 'emote', unitId: 'red-0', emoteId: 'e-oops' });
  flow.handle('alice', { t: 'emote', slot: 0 });
  assert.equal(last(msgs, 'rejected')?.reason, 'slow down');
  clock.advance(3000);
  flow.handle('alice', { t: 'emote', slot: 7 });
  assert.equal(last(msgs, 'rejected')?.reason, 'no emote in that slot');
  flow.handle('bob', { t: 'emote', slot: 0 });
  assert.deepEqual(last(msgs, 'emote'), { t: 'emote', unitId: 'blue-0', emoteId: 'e-oops' }, 'not their turn is fine for emotes');
  flow.dispose();
});
