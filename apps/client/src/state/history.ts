// This browser's recent matches (Home "Recent activity"). Server-side history replaces it in Phase 4.
import type { MapId } from '@lobbers/shared';

export interface HistoryItem { matchId: string; outcome: 'win' | 'loss' | 'draw'; mapId: MapId; xp: number; coins: number; at: number }
const KEY = 'lobbers.history.v1';

export function readHistory(): HistoryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as HistoryItem[]).filter((x) => typeof x?.matchId === 'string').slice(0, 20) : [];
  } catch { return []; }
}

export function recordMatch(item: HistoryItem): void {
  const list = [item, ...readHistory().filter((x) => x.matchId !== item.matchId)].slice(0, 20);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

export function ago(at: number, now = Date.now()): string {
  const m = Math.round((now - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return h < 48 ? 'yesterday' : `${Math.round(h / 24)}d ago`;
}
