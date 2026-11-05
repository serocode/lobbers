// Finished matches kept in memory for `GET /api/matches/:id` (Results revisits, "Return to results").
// Phase 4 replaces this with the Drizzle `matches` table; until then results survive only while the
// server process runs (logged in docs/DECISIONS.md).
import type { MatchEndedMsg } from '@lobbers/shared';

const MAX = 500;
const store = new Map<string, MatchEndedMsg & { endedAt: number }>();

export function archiveMatch(matchId: string, result: MatchEndedMsg): void {
  store.set(matchId, { ...result, endedAt: Date.now() });
  while (store.size > MAX) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function getArchivedMatch(matchId: string): (MatchEndedMsg & { endedAt: number }) | null { return store.get(matchId) ?? null; }
