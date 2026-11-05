// The seam between the battle (scene + HUD) and whoever runs the authoritative simulation.
// Phase 1: LocalMatchController (hot-seat, in-browser). Phase 2: NetMatchController (Colyseus MatchRoom).
// The battle only ever sees protocol messages + a small synced state — never the authoritative World.
import type { MatchIntent, ServerMessage, TurnPhase } from '@lobbers/shared';

/** Mirrors the Colyseus MatchState schema fields the client needs (docs/NETWORK.md § Match state). */
export interface MatchStateView {
  phase: TurnPhase;
  turnNumber: number;
  activeUnitId: string | null;
  /** Server epoch ms when the current turn ends. */
  endsAt: number;
  wind: number;
  /** Shots the active unit may still fire this turn. */
  shotsLeft: number;
}

export interface MatchTransportListener {
  message(msg: ServerMessage): void;
  state(state: MatchStateView): void;
}

export interface MatchTransport {
  /** Player ids controlled from this browser (hot-seat: every player; online: just you). */
  readonly localPlayerIds: ReadonlySet<string>;
  /** 'local' for hot-seat, 'online' for a server room. */
  readonly kind: 'local' | 'online';
  subscribe(listener: MatchTransportListener): () => void;
  send(intent: MatchIntent): void;
  /** Starts (or resumes) message delivery. */
  start(): void;
  dispose(): void;
  /** Current time on the authority's clock (ms). */
  serverNow(): number;
}
