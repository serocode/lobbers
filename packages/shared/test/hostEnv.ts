// Shared test environment for the host engine: a HostSession + loopback PeerClients + ManualClock.
import {
  HostSession, PeerClient, ManualClock, connectLoopback, WorldMirror, memoryStore, Terrain, predictTrajectory, unitById, createRng, WEAPONS,
  type PeerProfile, type AimInput, type WeaponId, type MatchEndedMsg, type MachineId, type KeyValueStore,
} from '../src/index.ts';

export const flush = (): Promise<void> => new Promise((r) => setImmediate(r));
export const prof = (id: string, machine: MachineId = 'thumper'): PeerProfile => ({ id, name: `Player ${id}`, level: 3, rating: 1000, title: null, avatar: null, favoriteMachine: machine, cosmetics: {} });

export interface Peer { id: string; client: PeerClient; link: { drop(): void }; tokens: KeyValueStore; mirror: Terrain | null; desyncs: number; rejected: string[] }

export function setup(n: number, opts: { store?: KeyValueStore; seed?: number } = {}) {
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
export async function step(clock: ManualClock, ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 1000) { clock.advance(Math.min(1000, left)); await flush(); }
}

/** Picks a real aim at the nearest enemy using the shared preview (still sent as an intent through the link). */
export function botAim(s: HostSession, unitId: string): AimInput {
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

export async function playToEnd(env: ReturnType<typeof setup>, maxSteps = 4000, onTurn?: (turn: number) => Promise<void> | void): Promise<MatchEndedMsg> {
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

export async function startMatch(env: ReturnType<typeof setup>, patch: Record<string, unknown> = {}): Promise<void> {
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

