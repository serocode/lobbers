// MatchTransport over a PeerClient for online matches. Lives as long as the room:
// it records the match messages since the latest `matchStarted`, so any subscriber (StrictMode remounts,
// a ClientMatch rebuilt after a rejoin) replays the same match. A second `matchStarted` for the same match
// (rejoin / host refresh snapshot) bumps `generation` so the battle route rebuilds from the fresh snapshot.
import { create } from 'zustand';
import type { HostMessage, MatchIntent, MatchView, PeerClient, ServerMessage } from '@lobbers/shared';
import { EMPTY_STATE, type MatchStateView, type MatchTransport, type MatchTransportListener } from '../MatchTransport';

const MATCH_INTENTS = new Set(['aim', 'move', 'jump', 'selectWeapon', 'useAbility', 'fire', 'skipTurn', 'forfeit', 'emote']);
const FORWARD = new Set<HostMessage['t']>(['matchStarted', 'turnStarted', 'actionResolved', 'aimUpdate', 'emote', 'matchEnded', 'rejected']);

export const useFeed = create<{ generation: number; matchId: string }>(() => ({ generation: 0, matchId: '' }));

export function stateFromView(v: MatchView): MatchStateView {
  const offline: Record<string, number> = {};
  for (const [id, on] of Object.entries(v.connected)) if (!on) offline[id] = v.reconnectUntil[id] ?? 0;
  return { phase: v.phase, turnNumber: v.turnNumber, activeUnitId: v.activeUnitId, endsAt: v.endsAt, wind: v.wind, offline, paused: v.paused };
}

export class MatchFeed implements MatchTransport {
  readonly kind = 'online' as const;
  private history: ServerMessage[] = [];
  private state: MatchStateView = EMPTY_STATE;
  private listeners = new Set<MatchTransportListener>();
  private off: Array<() => void> = [];

  constructor(readonly client: PeerClient) {
    this.off.push(client.on('*', (m) => this.onMessage(m)));
    // The transport may have delivered messages before we subscribed (a resumed host's own loopback client
    // gets its match snapshot immediately) — start from what the PeerClient already holds.
    if (client.started) {
      this.history = [{ t: 'matchStarted', data: client.started }, ...client.actions.map((data) => ({ t: 'actionResolved' as const, data }))];
      if (client.turn) this.history.push({ t: 'turnStarted', data: client.turn });
      if (client.ended) this.history.push({ t: 'matchEnded', data: client.ended });
      useFeed.setState({ matchId: client.started.matchId });
    }
    if (client.match) this.state = stateFromView(client.match);
  }

  get localPlayerIds(): ReadonlySet<string> { return new Set(this.client.playerId ? [this.client.playerId] : []); }
  get matchId(): string { return this.client.started?.matchId ?? ''; }
  get result(): Extract<ServerMessage, { t: 'matchEnded' }>['data'] | null { return this.client.ended; }

  subscribe(l: MatchTransportListener): () => void {
    this.listeners.add(l);
    for (const m of this.history) l.message(m);
    l.state(this.state);
    return () => this.listeners.delete(l);
  }

  start(): void { /* delivery is live from construction */ }
  ready(): void { this.client.send({ t: 'loaded' }); }
  send(intent: MatchIntent): void { this.client.send(intent); }
  serverNow(): number { return this.client.hostNow(); }
  /** A ClientMatch is done with the feed; the feed itself lives as long as the room. */
  dispose(): void { /* listeners unsubscribe themselves */ }
  close(): void { for (const f of this.off) f(); this.off = []; this.listeners.clear(); }

  private onMessage(m: HostMessage): void {
    if (m.t === 'matchState') {
      this.state = stateFromView(m.data);
      for (const l of this.listeners) l.state(this.state);
      return;
    }
    if (!FORWARD.has(m.t)) return;
    const msg = m as ServerMessage;
    if (msg.t === 'rejected' && !MATCH_INTENTS.has(msg.intent)) return;   // lobby rejections go to the lobby screen
    if (msg.t === 'matchStarted') {
      const resync = this.history.length > 0 && useFeed.getState().matchId === msg.data.matchId;
      this.history = [msg];
      useFeed.setState((s) => ({ matchId: msg.data.matchId, generation: resync ? s.generation + 1 : s.generation }));
      if (resync) return;   // the battle route rebuilds its ClientMatch from the fresh history
    } else {
      this.history.push(msg);
    }
    for (const l of this.listeners) l.message(msg);
  }
}
