// The seam between the battle (scene + HUD) and whoever runs the authoritative simulation: a PeerClient
// talking to a HostSession (online: over PeerJS; hot seat: over loopback). The battle only ever sees protocol
// messages + a small synced state — never the host's World.
import type { MatchIntent, ServerMessage, TurnPhase } from '@lobbers/shared';

/** What the HUD needs from `matchState` (host's MatchView, minus the unit snapshots that arrive with actions). */
export interface MatchStateView {
  phase: TurnPhase;
  turnNumber: number;
  activeUnitId: string | null;
  /** Host epoch ms when the current turn ends. */
  endsAt: number;
  wind: number;
  /** Disconnected players → host epoch ms when their reconnect window closes. */
  offline: Record<string, number>;
  /** The host is restoring after a refresh (timer frozen, controls off). */
  paused: boolean;
}

export const EMPTY_STATE: MatchStateView = { phase: 'waiting', turnNumber: 0, activeUnitId: null, endsAt: 0, wind: 0, offline: {}, paused: false };

export interface MatchTransportListener {
  message(msg: ServerMessage): void;
  state(state: MatchStateView): void;
}

export interface MatchTransport {
  /** Player ids controlled from this browser (hot seat: every seat; online: just you). */
  readonly localPlayerIds: ReadonlySet<string>;
  readonly kind: 'local' | 'online';
  subscribe(listener: MatchTransportListener): () => void;
  send(intent: MatchIntent): void;
  /** Starts message delivery (idempotent). */
  start(): void;
  /** The battle scene finished loading (host waits for every peer's `loaded`). */
  ready(): void;
  dispose(): void;
  /** Current time on the host's clock (ms). */
  serverNow(): number;
}
