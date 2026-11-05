// LobbyRoom + MatchRoom in-process (@colyseus/testing): codes, limits, host-only actions, ready gating,
// start → reserved match seats, out-of-turn rejection, identical outcomes for every client,
// disconnect → skipped/ended turn, reconnect with snapshot, forfeit after the window, host transfer.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { Client, type Room } from 'colyseus.js';
import { predictTrajectory, Terrain, type LobbyServerMessage, type ServerMessage, type LobbyView, type MatchStartedMsg } from '@lobbers/shared';
import { createGameServer } from '../src/server.ts';
import { signSession } from '../src/auth/jwt.ts';
import { loadConfig } from '../src/config.ts';

const SECRET = 'test-secret-at-least-16-chars';
const cfg = loadConfig({ ...process.env, JWT_SECRET: SECRET, NODE_ENV: 'test', PORT: '2568' });
const TEST = { countdownMs: 50, introDelayMs: 0, waitForPlayersMs: 2000, reconnectWindowSec: 1 };

let server: ColyseusTestServer;
beforeAll(async () => { server = await boot(createGameServer(cfg), 2568); });
afterAll(async () => { await server.shutdown(); });

interface Player { id: string; name: string; client: Client; lobby?: Room; match?: Room; lobbyMsgs: LobbyServerMessage[]; matchMsgs: ServerMessage[] }
let seq = 0;

async function player(name: string): Promise<Player> {
  const id = `user-${++seq}-${name}`;
  const client = new Client('ws://localhost:2568');
  client.auth.token = await signSession({ sub: id, name, guest: true }, SECRET);
  return { id, name, client, lobbyMsgs: [], matchMsgs: [] };
}

function watchLobby(p: Player, room: Room): Room {
  p.lobby = room;
  room.onMessage('lobby', (m: LobbyServerMessage) => p.lobbyMsgs.push(m));
  room.onMessage('ping', () => undefined);
  return room;
}

const view = (r: Room): LobbyView => {
  const s = r.state as { toJSON(): Omit<LobbyView, 'players'> & { players?: Record<string, LobbyView['players'][number]> } };
  const j = s.toJSON();
  return { ...j, players: Object.values(j.players ?? {}) };
};

async function until(cond: () => boolean, ms = 4000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 15));
  }
}

async function roomWith(n: number, opts: Record<string, unknown> = {}): Promise<Player[]> {
  const ps: Player[] = [];
  for (let i = 0; i < n; i++) ps.push(await player(`P${i}`));
  watchLobby(ps[0], await ps[0].client.create('lobby', { name: 'Test room', isPrivate: true, test: TEST, ...opts }));
  await until(() => !!view(ps[0].lobby!).code);
  const code = view(ps[0].lobby!).code;
  const res = await server.http.get(`/api/rooms/code/${code}`);
  const roomId = (res.data as { roomId: string }).roomId;
  for (const p of ps.slice(1)) watchLobby(p, await p.client.joinById(roomId));
  await until(() => ps.every((p) => view(p.lobby!).players.length === n));
  return ps;
}

const intent = (r: Room, body: object): void => r.send('intent', body);

async function startMatch(ps: Player[]): Promise<void> {
  for (const p of ps.slice(1)) intent(p.lobby!, { t: 'setReady', ready: true });
  await until(() => view(ps[0].lobby!).players.every((p) => p.ready || p.isHost));
  intent(ps[0].lobby!, { t: 'startMatch' });
  await until(() => ps.every((p) => p.lobbyMsgs.some((m) => m.t === 'matchReady')));
  for (const p of ps) {
    const ready = p.lobbyMsgs.find((m): m is Extract<LobbyServerMessage, { t: 'matchReady' }> => m.t === 'matchReady');
    const room = await p.client.consumeSeatReservation(ready!.reservation as Parameters<Client['consumeSeatReservation']>[0]);
    p.match = room;
    room.onMessage('s', (m: ServerMessage) => p.matchMsgs.push(m));
  }
  await until(() => ps.every((p) => p.matchMsgs.some((m) => m.t === 'turnStarted')));
}

const lastTurn = (p: Player) => [...p.matchMsgs].reverse().find((m): m is Extract<ServerMessage, { t: 'turnStarted' }> => m.t === 'turnStarted')?.data;
const actions = (p: Player) => p.matchMsgs.filter((m): m is Extract<ServerMessage, { t: 'actionResolved' }> => m.t === 'actionResolved').map((m) => m.data);
const started = (p: Player): MatchStartedMsg => p.matchMsgs.find((m): m is Extract<ServerMessage, { t: 'matchStarted' }> => m.t === 'matchStarted')!.data;

describe('LobbyRoom', () => {
  it('creates a LOB-XXXX room, auto-balances teams and crowns the creator', async () => {
    const ps = await roomWith(3);
    const v = view(ps[1].lobby!);
    expect(v.code).toMatch(/^LOB-[A-Z2-9]{4}$/);
    expect(v.players.filter((p) => p.team === 'red')).toHaveLength(2);
    expect(v.players.filter((p) => p.team === 'blue')).toHaveLength(1);
    expect(v.players.find((p) => p.id === ps[0].id)?.isHost).toBe(true);
    expect(v.hostId).toBe(ps[0].id);
    for (const p of ps) await p.lobby!.leave();
  });

  it('enforces host-only start, ready gating, team limits, and refuses a 9th player', async () => {
    const ps = await roomWith(8);
    const host = ps[0], guest = ps[1];
    intent(guest.lobby!, { t: 'startMatch' });
    await until(() => guest.lobbyMsgs.some((m) => m.t === 'rejected'));
    expect(guest.lobbyMsgs.find((m) => m.t === 'rejected')).toMatchObject({ intent: 'startMatch', reason: 'only the host can do that' });
    intent(host.lobby!, { t: 'startMatch' });
    await until(() => host.lobbyMsgs.some((m) => m.t === 'rejected'));
    expect(host.lobbyMsgs.find((m) => m.t === 'rejected')).toMatchObject({ reason: '7 player(s) not ready' });
    const blue = view(guest.lobby!).players.find((p) => p.team === 'blue')!;
    const bluePlayer = ps.find((p) => p.id === blue.id)!;
    intent(bluePlayer.lobby!, { t: 'setTeam', team: 'red' });
    await until(() => bluePlayer.lobbyMsgs.some((m) => m.t === 'rejected' && m.intent === 'setTeam'));
    expect(bluePlayer.lobbyMsgs.find((m) => m.t === 'rejected' && m.intent === 'setTeam')).toMatchObject({ reason: 'team full' });
    intent(guest.lobby!, { t: 'updateSettings', patch: { mapId: 'dunes' } });
    await until(() => guest.lobbyMsgs.filter((m) => m.t === 'rejected').length >= 2);
    expect(view(host.lobby!).settings.mapId).toBe('cobalt');
    const ninth = await player('Nine');
    await expect(ninth.client.joinById(host.lobby!.roomId)).rejects.toThrow();
    for (const p of ps) await p.lobby!.leave();
  });

  it('rejects malformed intents and keeps chat clean and rate-limited', async () => {
    const ps = await roomWith(2);
    intent(ps[1].lobby!, { t: 'setMachine', machine: 'death-star' });
    await until(() => ps[1].lobbyMsgs.some((m) => m.t === 'rejected'));
    expect(ps[1].lobbyMsgs[0]).toMatchObject({ intent: 'setMachine', reason: 'bad message' });
    for (let i = 0; i < 5; i++) intent(ps[1].lobby!, { t: 'chat', text: `  gl   hf ${i}  ` });
    await until(() => ps[1].lobbyMsgs.some((m) => m.t === 'rejected' && m.intent === 'chat'));
    await until(() => view(ps[0].lobby!).chat.some((c) => c.playerId === ps[1].id));
    await new Promise((r) => setTimeout(r, 100));
    const lines = view(ps[0].lobby!).chat.filter((c) => c.playerId === ps[1].id);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[0]?.text).toBe('gl hf 0');
    for (const p of ps) await p.lobby!.leave();
  });

  it('host leaving hands the crown to the longest-connected player and keeps settings', async () => {
    const ps = await roomWith(3);
    intent(ps[0].lobby!, { t: 'updateSettings', patch: { mapId: 'skyreach', turnSeconds: 45 } });
    await until(() => view(ps[1].lobby!).settings.mapId === 'skyreach');
    await ps[0].lobby!.leave();
    await until(() => view(ps[1].lobby!).hostId === ps[1].id);
    const v = view(ps[2].lobby!);
    expect(v.players.find((p) => p.id === ps[1].id)?.isHost).toBe(true);
    expect(v.settings).toMatchObject({ mapId: 'skyreach', turnSeconds: 45 });
    for (const p of ps.slice(1)) await p.lobby!.leave();
  });

  it('kick removes the player (host only)', async () => {
    const ps = await roomWith(3);
    intent(ps[0].lobby!, { t: 'kick', playerId: ps[2].id });
    await until(() => view(ps[1].lobby!).players.length === 2);
    expect(ps[2].lobbyMsgs.some((m) => m.t === 'kicked')).toBe(true);
    for (const p of ps.slice(0, 2)) await p.lobby!.leave();
  });
});

describe('MatchRoom', () => {
  it('start → reserved seats; out-of-turn fire rejected; every client sees identical outcomes', async () => {
    const ps = await roomWith(4);
    await startMatch(ps);
    const first = lastTurn(ps[0])!;
    const active = ps.find((p) => started(p).units.find((u) => u.id === first.activeUnitId)?.playerId === p.id)!;
    const idle = ps.find((p) => p !== active)!;
    intent(idle.match!, { t: 'fire', aim: { angle: 45, power: 50, weaponId: 'standard-rocket' } });
    await until(() => idle.matchMsgs.some((m) => m.t === 'rejected'));
    expect(idle.matchMsgs.find((m) => m.t === 'rejected')).toMatchObject({ intent: 'fire', reason: 'not your turn' });
    expect(active.matchMsgs.some((m) => m.t === 'rejected')).toBe(false);
    // Forged / out-of-range payloads never reach the simulation.
    intent(active.match!, { t: 'move', dir: 1, ticks: 9999 });
    await until(() => active.matchMsgs.some((m) => m.t === 'rejected'));
    // Aim at the nearest enemy using the shared preview on the start snapshot.
    const snap = started(active);
    const terrain = Terrain.decodeRLE(snap.width, snap.height, snap.terrainRLE);
    const me = snap.units.find((u) => u.id === first.activeUnitId)!;
    const foe = snap.units.filter((u) => u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
    const world = { map: (await import('@lobbers/shared')).MAPS[snap.mapId], terrain, units: snap.units, wind: first.wind, burnZones: [], props: snap.props, settings: snap.settings, nextId: 1, turnNumber: 1, recentDamage: {} };
    let best = { angle: 50, power: 60 }, bd = Infinity;
    const angle = foe.x > me.x ? 55 : 125;
    for (let p = 20; p <= 100; p++) {
      const r = predictTrajectory(world, me.id, { angle, power: p, weaponId: 'standard-rocket' });
      if (r.hit && r.hit.kind !== 'out') { const d = Math.abs(r.hit.x - foe.x); if (d < bd) { bd = d; best = { angle, power: p }; } }
    }
    intent(active.match!, { t: 'fire', aim: { ...best, weaponId: 'standard-rocket' } });
    await until(() => ps.every((p) => actions(p).some((a) => a.kind === 'shot')));
    const shots = ps.map((p) => actions(p).find((a) => a.kind === 'shot')!);
    for (const s of shots) {
      expect(s.result.terrainHash).toBe(shots[0].result.terrainHash);
      expect(s.units.map((u) => [u.id, u.hp, Math.round(u.x), Math.round(u.y)])).toEqual(shots[0].units.map((u) => [u.id, u.hp, Math.round(u.x), Math.round(u.y)]));
    }
    expect(shots[0].units.some((u) => u.hp < u.maxHp)).toBe(true);
    for (const p of ps) { await p.match!.leave(); await p.lobby!.leave(); }
  });

  it('active player dropping ends their turn; reconnecting resumes the seat with a full snapshot', async () => {
    const ps = await roomWith(2, { test: { ...TEST, reconnectWindowSec: 20 } });
    await startMatch(ps);
    const first = lastTurn(ps[0])!;
    const active = ps.find((p) => started(p).units.find((u) => u.id === first.activeUnitId)?.playerId === p.id)!;
    const other = ps.find((p) => p !== active)!;
    const token = active.match!.reconnectionToken;
    active.match!.connection.close();
    await until(() => (lastTurn(other)?.turnNumber ?? 0) > first.turnNumber);
    const offline = (other.match!.state as { offline: Map<string, number> }).offline;
    await until(() => offline.has(active.id));
    const back = await active.client.reconnect(token);
    const got: ServerMessage[] = [];
    back.onMessage('s', (m: ServerMessage) => got.push(m));
    await until(() => got.some((m) => m.t === 'matchStarted') && got.some((m) => m.t === 'turnStarted'));
    await until(() => !offline.has(active.id));
    const snap = got.find((m): m is Extract<ServerMessage, { t: 'matchStarted' }> => m.t === 'matchStarted')!.data;
    expect(Terrain.decodeRLE(snap.width, snap.height, snap.terrainRLE).hash()).toBe(snap.terrainHash);
    await back.leave();
    await other.match!.leave();
    for (const p of ps) await p.lobby!.leave();
  });

  it('staying away past the reconnect window forfeits; the lobby reopens after the match', async () => {
    const ps = await roomWith(2);
    await startMatch(ps);
    ps[1].match!.connection.close();
    await until(() => ps[0].matchMsgs.some((m) => m.t === 'matchEnded'), 5000);
    const end = ps[0].matchMsgs.find((m): m is Extract<ServerMessage, { t: 'matchEnded' }> => m.t === 'matchEnded')!.data;
    const winnerTeam = started(ps[0]).units.find((u) => u.playerId === ps[0].id)!.team;
    expect(end.winner).toBe(winnerTeam);
    expect(end.players.find((p) => p.playerId === ps[1].id)?.survived).toBe(false);
    await until(() => view(ps[0].lobby!).phase === 'open');
    const res = await server.http.get(`/api/matches/${ps[0].match!.roomId}`);
    expect((res.data as { match: { winner: string } }).match.winner).toBe(winnerTeam);
    await ps[0].match!.leave();
    for (const p of ps) await p.lobby!.leave().catch(() => undefined);
  });

  it('clients cannot create match rooms directly', async () => {
    const p = await player('Sneaky');
    await expect(p.client.create('match', { seats: [], settings: {}, seed: 1, lobbyRoomId: '' })).rejects.toThrow();
  });
});
