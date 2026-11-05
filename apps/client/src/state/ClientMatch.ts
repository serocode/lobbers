// Client side of a match: consumes a MatchTransport (local or online), keeps a mirror World for
// rendering + the trajectory preview (never for outcomes), replays outcomes in time, feeds the store.
import {
  MAPS, MACHINES, Terrain, type MatchIntent, type MatchStartedMsg, type ServerMessage, type SimEvent, type World,
} from '@lobbers/shared';
import type { MatchTransport } from '../net/MatchTransport';
import { createHudPresenter } from './hudPresenter';
import { createMatchStore, initialMatchView, type MatchStore } from './matchStore';
import { Replay, type ReplayPresenter } from './replay';

export type MatchListener = (msg: MatchStartedMsg) => void;

export class ClientMatch {
  readonly store: MatchStore = createMatchStore();
  readonly replay = new Replay();
  /** Mirror of the battlefield: terrain carved by replayed events, units snapped to snapshots. */
  world: World | null = null;
  private startListeners = new Set<MatchListener>();
  private unsub: () => void;
  private raf = 0;
  private last = 0;
  private toastSeq = 1;

  constructor(readonly transport: MatchTransport) {
    this.store.setState({ ...initialMatchView(), localPlayerIds: [...transport.localPlayerIds] });
    this.replay.add(this.mirrorPresenter());
    this.replay.add(createHudPresenter(this.store, () => this.world?.map ?? null));
    this.unsub = transport.subscribe({
      message: (m) => this.onMessage(m),
      state: (s) => { this.noteConnections(s.offline); this.store.setState({ sync: s }); },
    });
  }

  /** `autoTick: false` lets tests drive `replay.advance()` by hand. */
  start(autoTick = true): void {
    this.transport.start();
    if (!autoTick) return;
    const loop = (t: number): void => {
      const dt = this.last ? t - this.last : 16;
      this.last = t;
      this.replay.advance(dt);
      const blocking = this.replay.blocking;
      if (blocking !== this.store.getState().replaying) this.store.setState({ replaying: blocking });
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.unsub();
    this.replay.clear();
    this.transport.dispose();
    this.startListeners.clear();
  }

  send(intent: MatchIntent): void { this.transport.send(intent); }

  /** Scene hook: called with the start snapshot (immediately if the match already started). */
  onStarted(l: MatchListener): () => void {
    this.startListeners.add(l);
    if (this.started) l(this.started);
    return () => this.startListeners.delete(l);
  }

  addPresenter(p: ReplayPresenter): () => void { return this.replay.add(p); }

  toast(text: string, kind: 'ok' | 'error' = 'ok'): void { this.store.setState({ toast: { id: this.toastSeq++, text, kind } }); }

  private started: MatchStartedMsg | null = null;
  private logSeq = 1_000_000;

  /** Combat log lines for players dropping / coming back (DESIGN_SPEC §3.4). */
  private noteConnections(next: Record<string, number>): void {
    const prev = this.store.getState().sync.offline;
    const v = this.store.getState();
    const line = (playerId: string, verb: string): void => {
      const u = v.units.find((x) => x.playerId === playerId);
      if (!u || !u.alive) return;
      this.store.setState((st) => ({ log: [{ id: this.logSeq++, text: `T${st.turnNumber} · ${u.name} ${verb}`, color: '#A9B3CC' }, ...st.log].slice(0, 7) }));
    };
    for (const id of Object.keys(next)) if (!(id in prev)) line(id, 'disconnected');
    for (const id of Object.keys(prev)) if (!(id in next)) line(id, 'reconnected');
  }

  private onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'matchStarted': return this.onStart(m.data);
      case 'turnStarted': return this.replay.enqueue({ kind: 'turn', msg: m.data });
      case 'actionResolved': return this.replay.enqueue({ kind: 'action', msg: m.data });
      case 'matchEnded': return this.replay.enqueue({ kind: 'end', msg: m.data });
      case 'aimUpdate':
        this.store.setState((s) => ({ remoteAim: { ...s.remoteAim, [m.unitId]: { angle: m.angle, power: m.power, weaponId: m.weaponId } } }));
        return;
      case 'emote':
        this.store.setState((s) => ({ emotes: [...s.emotes, { id: this.logSeq++, unitId: m.unitId, emoteId: m.emoteId }].slice(-8) }));
        return;
      case 'rejected': return this.toast(`Rejected: ${m.reason}`, 'error');
    }
  }

  private onStart(d: MatchStartedMsg): void {
    const terrain = Terrain.decodeRLE(d.width, d.height, d.terrainRLE);
    const ok = terrain.hash() === d.terrainHash;
    this.world = {
      map: MAPS[d.mapId], terrain, units: d.units.map((u) => structuredClone(u)), wind: d.wind, burnZones: d.burnZones.map((z) => ({ ...z })),
      props: d.props.map((p) => ({ ...p })), settings: d.settings, nextId: 1, turnNumber: 0, recentDamage: {},
    };
    const aim = Object.fromEntries(d.units.map((u) => [u.id, { angle: u.facing > 0 ? 45 : 135, power: 60, weaponId: MACHINES[u.machine].loadout[0] }]));
    this.store.setState((s) => ({
      ready: true, mapId: d.mapId, settings: d.settings, cosmetics: d.cosmetics ?? {}, units: d.units.map((u) => structuredClone(u)), props: d.props, burnZones: d.burnZones,
      wind: d.wind, aim, hash: { ...s.hash, checks: s.hash.checks + 1, mismatches: s.hash.mismatches + (ok ? 0 : 1), client: terrain.hash(), server: d.terrainHash },
    }));
    this.started = d;
    for (const l of this.startListeners) l(d);
  }

  /** Keeps the mirror World in step with what has been replayed so far. */
  private mirrorPresenter(): ReplayPresenter {
    const apply = (e: SimEvent): void => {
      const w = this.world;
      if (!w) return;
      if (e.t === 'carve') w.terrain.carveCircle(e.x, e.y, e.r);
      else if (e.t === 'prop') {
        const p = w.props.find((x) => x.id === e.propId);
        if (!p) return;
        if (e.change === 'moved' && e.y !== undefined) p.y = e.y;
        else if (e.change !== 'moved') p.alive = false;
        this.store.setState({ props: w.props.map((x) => ({ ...x })) });
      } else if (e.t === 'burnZone') {
        w.burnZones.push({ ...e.zone });
        this.store.setState({ burnZones: w.burnZones.map((z) => ({ ...z })) });
      }
    };
    return {
      turnStarted: (msg) => {
        if (!this.world) return;
        this.world.wind = msg.wind;
        this.world.burnZones = msg.burnZones.map((z) => ({ ...z }));
        this.world.turnNumber = msg.turnNumber;
      },
      event: (e) => apply(e),
      actionEnd: (a) => {
        const w = this.world;
        if (!w) return;
        w.units = a.units.map((u) => structuredClone(u));
        const client = w.terrain.hash();
        const server = a.result.terrainHash;
        if (client !== server) console.warn(`[lobbers] terrain desync after action ${a.actionId}: client ${client} ≠ server ${server}`);
        this.store.setState((s) => ({ hash: { checks: s.hash.checks + 1, mismatches: s.hash.mismatches + (client === server ? 0 : 1), client, server } }));
      },
    };
  }
}
