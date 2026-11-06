// Derived lobby state for the screen: me, teams, start gating (shared validateStart), clock.
import { useEffect, useState } from 'react';
import { validateStart, type LobbyPlayer, type LobbyView, type TeamId } from '@lobbers/shared';
import { lobbyService } from '../../net/p2p/roomService';

export interface LobbyDerived {
  view: LobbyView;
  me: LobbyPlayer | undefined;
  isHost: boolean;
  team: (t: TeamId) => Array<LobbyPlayer | null>;
  notReady: number;
  startCheck: { ok: true } | { ok: false; reason: string };
}

export function derive(view: LobbyView): LobbyDerived {
  const myId = lobbyService.myId;
  const me = view.players.find((p) => p.id === myId);
  return {
    view, me, isHost: !!me?.isHost,
    team: (t) => Array.from({ length: 4 }, (_, i) => view.players.find((p) => p.team === t && p.slot === i) ?? null),
    notReady: view.players.filter((p) => !p.ready && !p.isHost).length,
    startCheck: validateStart(view.players, view.hostId),
  };
}

/** Local clock ticking every 250 ms (the countdown end is stored in local time). */
export function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  return now;
}

export { mmss } from '../../state/format';
