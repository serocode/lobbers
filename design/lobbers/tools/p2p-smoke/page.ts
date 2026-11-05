// Smoke-test "app": real HostSession / PeerClient / WorldMirror / localStorage in a real browser, bots play.
import {
  HostSession, PeerClient, WorldMirror, connectLoopback, createProfile, loadProfile, saveProfile, toPeerProfile, creditMatch, safeStore, realClock,
  predictTrajectory, unitById, WEAPONS, type AimInput, type WeaponId, type HostMessage,
} from '../../packages/shared/src/index.ts';
import { hostRTC, joinRTC } from './rtc.ts';

const q = new URLSearchParams(location.search);
const role = q.get('role') ?? 'guest';
const code = q.get('code') ?? 'LOB-E2E';
const players = Number(q.get('players') ?? 2);
const signalUrl = `ws://${location.host}/signal`;
const store = safeStore(localStorage);

let profile = loadProfile(store);
if (!profile) { profile = createProfile(q.get('name') ?? `Bot ${Math.floor(Math.random() * 900 + 100)}`, crypto.randomUUID(), Date.now()); profile.favoriteMachine = (q.get('machine') as typeof profile.favoriteMachine) ?? 'thumper'; saveProfile(store, profile); }
const me = toPeerProfile(profile);

const client = new PeerClient({ code, profile: me, clock: realClock, tokenStore: store });
let mirror: WorldMirror | null = null;
let firedTurn = -1;
const rtts: number[] = [];
let credited: unknown = null;

function aimFor(unitId: string): AimInput {
  const w = mirror!.world;
  const u = unitById(w, unitId);
  const foe = w.units.filter((x) => x.alive && x.team !== u.team).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  const weaponId: WeaponId = (Object.keys(u.ammo) as WeaponId[]).find((id) => (u.ammo[id] ?? 0) !== 0 && !u.weaponCooldowns[id] && WEAPONS[id].damage >= 140) ?? 'standard-rocket';
  const angle = foe.x > u.x ? 52 : 128;
  let best: AimInput = { angle, power: 60, weaponId }, bd = Infinity;
  for (let p = 20; p <= 100; p++) {
    const r = predictTrajectory(w, unitId, { angle, power: p, weaponId });
    if (r.hit && r.hit.kind !== 'out' && Math.abs(r.hit.x - foe.x) < bd) { bd = Math.abs(r.hit.x - foe.x); best = { angle, power: p, weaponId }; }
  }
  return best;
}

client.on('*', (m: HostMessage) => {
  if (m.t === 'pong') rtts.push(Date.now() - m.clientTime);
  if (m.t === 'lobbyState') {
    const lv = m.data;
    if (role !== 'host' && lv.phase === 'open' && !lv.players.find((p) => p.id === me.id)?.ready && !client.ended) client.send({ t: 'setReady', ready: true });
    if (role === 'host' && lv.phase === 'open' && !client.ended && lv.players.length >= players && lv.players.every((p) => p.isHost || p.ready)) client.send({ t: 'startMatch' });
  }
  if (m.t === 'matchStarted') { mirror = new WorldMirror(m.data); client.send({ t: 'loaded' }); }
  if (m.t === 'actionResolved') mirror?.applyAction(m.data);
  if (m.t === 'matchState') {
    mirror?.applyView(m.data);
    const v = m.data;
    const mine = v.units.find((u) => u.playerId === me.id);
    if (mirror && mine && v.phase === 'acting' && !v.paused && v.activeUnitId === mine.id && firedTurn !== v.turnNumber) {
      firedTurn = v.turnNumber;
      setTimeout(() => client.send({ t: 'fire', aim: aimFor(mine.id) }), 300);
    }
  }
  if (m.t === 'matchEnded') {
    const p = loadProfile(store)!;
    const c = creditMatch(p, m.data);
    saveProfile(store, c.profile);
    credited = { credited: c.credited, xp: c.xpGained, level: c.profile.level, matches: c.profile.stats.matches };
  }
});

(async () => {
  if (role === 'host') {
    const session = HostSession.restore({ code, roomName: 'Smoke', host: me, clock: realClock, store })
      ?? new HostSession({ code, roomName: 'Smoke', host: me, clock: realClock, store, settings: { mode: 'team-deathmatch', mapId: (q.get('map') as 'cobalt') ?? 'cobalt', turnSeconds: 20, wind: 'calm', friendlyFire: 0.5, itemsEnabled: true, bestOf: 1, isPrivate: true } });
    await hostRTC(session, signalUrl, code);
    connectLoopback(session, client, { local: true });
    (window as unknown as { __session: HostSession }).__session = session;
  } else {
    await joinRTC(client, signalUrl, code);
  }
})();

(window as unknown as { __state: () => unknown }).__state = () => ({
  role, id: me.id, status: client.status, players: client.lobby?.players.length ?? 0, phase: client.match?.phase ?? null, turn: client.match?.turnNumber ?? 0,
  paused: client.match?.paused ?? false, actions: client.actions.length, desyncs: mirror?.desyncs ?? 0, hash: mirror?.world.terrain.hash() ?? 0,
  ended: client.ended, rtt: rtts.slice(-20), credited, connected: client.match?.connected ?? null,
});
