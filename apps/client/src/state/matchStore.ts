// What the battle HUD and scene display. Fed by ClientMatch from protocol messages (never by the HUD).
import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  BurnZone, MachineId, MapId, MatchEndedMsg, MatchSettings, PropState, UnitState, WeaponId,
} from '@lobbers/shared';
import type { MatchStateView } from '../net/MatchTransport';

export interface LogLine { id: number; text: string; color: string }
export interface FeedItem { id: number; killer: string; killerColor: string; victim: string; victimColor: string }
export interface Banner { id: number; title: string; sub: string; color: string }
export interface ElimInfo { id: number; name: string; machine: MachineId; how: string }
export interface Toast { id: number; text: string; kind: 'ok' | 'error' }
export interface Aim { angle: number; power: number; weaponId: WeaponId }

export interface MatchView {
  ready: boolean;
  mapId: MapId;
  settings: MatchSettings | null;
  /** Units as currently displayed (HP drops when the hit animates, then snaps to the authoritative snapshot). */
  units: UnitState[];
  props: PropState[];
  burnZones: BurnZone[];
  /** Turn as displayed (from the replayed `turnStarted`). */
  turnNumber: number;
  activeUnitId: string | null;
  wind: number;
  endsAt: number;
  /** Authority state as synced (immediate). Controls require sync + display to agree. */
  sync: MatchStateView;
  replaying: boolean;
  localPlayerIds: string[];
  /** Local aim memory per unit (hot-seat: every machine keeps its own aim). */
  aim: Record<string, Aim>;
  /** Other players' live aim (aimUpdate relay). */
  remoteAim: Record<string, Aim>;
  lastPower: Record<string, number>;
  /** Active unit's ability modifiers waiting for the next shot. */
  armed: { special: boolean; ultimate: boolean };
  log: LogLine[];
  feed: FeedItem[];
  banner: Banner | null;
  elim: ElimInfo | null;
  hurtAt: number;
  toast: Toast | null;
  result: MatchEndedMsg | null;
  hash: { checks: number; mismatches: number; client: number; server: number };
}

export const initialMatchView = (): MatchView => ({
  ready: false, mapId: 'cobalt', settings: null, units: [], props: [], burnZones: [], turnNumber: 0, activeUnitId: null, wind: 0, endsAt: 0,
  sync: { phase: 'waiting', turnNumber: 0, activeUnitId: null, endsAt: 0, wind: 0, shotsLeft: 0 },
  replaying: false, localPlayerIds: [], aim: {}, remoteAim: {}, lastPower: {}, armed: { special: false, ultimate: false },
  log: [], feed: [], banner: null, elim: null, hurtAt: 0, toast: null, result: null, hash: { checks: 0, mismatches: 0, client: 0, server: 0 },
});

export type MatchStore = StoreApi<MatchView>;
export const createMatchStore = (): MatchStore => createStore<MatchView>(() => initialMatchView());

// ---------- derived helpers (pure) ----------
export const unitOf = (v: MatchView, id: string | null): UnitState | undefined => (id ? v.units.find((u) => u.id === id) : undefined);
export const isLocal = (v: MatchView, u: UnitState | undefined): boolean => !!u && v.localPlayerIds.includes(u.playerId);

/** The active unit can be controlled from this browser right now. */
export function canControl(v: MatchView): boolean {
  if (!v.ready || v.result || v.replaying) return false;
  if (v.sync.phase !== 'acting' || !v.sync.activeUnitId || v.sync.activeUnitId !== v.activeUnitId) return false;
  const u = unitOf(v, v.activeUnitId);
  return !!u && u.alive && isLocal(v, u);
}

export const TEAM_COLOR = { red: '#F45B55', blue: '#4C9AFF' } as const;
export const TEAM_DARK = { red: '#3A2230', blue: '#1E2D4E' } as const;
