// Derived lobby state for the screen: me, teams, start gating (shared validateStart), clock.
import { useEffect, useState } from 'react';
import { validateStart, type LobbyPlayer, type LobbyPlayerView, type LobbyView, type TeamId } from '@lobbers/shared';
import { lobbyService, useLobby } from '../../net/online/lobbyService';

export interface LobbyDerived {
  view: LobbyView;
  me: LobbyPlayerView | undefined;
  isHost: boolean;
  team: (t: TeamId) => Array<LobbyPlayerView | null>;
  notReady: number;
  startCheck: { ok: true } | { ok: false; reason: string };
}

export function derive(view: LobbyView): LobbyDerived {
  const myId = lobbyService.myId;
  const me = view.players.find((p) => p.id === myId);
  const asLobby: LobbyPlayer[] = view.players.map((p) => ({ id: p.id, name: p.name, team: p.team, slot: p.slot, machine: p.machine, ready: p.ready, connected: p.connected, isHost: p.isHost, joinedAt: p.joinedAt }));
  return {
    view, me, isHost: !!me?.isHost,
    team: (t) => Array.from({ length: 4 }, (_, i) => view.players.find((p) => p.team === t && p.slot === i) ?? null),
    notReady: view.players.filter((p) => !p.ready && !p.isHost).length,
    startCheck: validateStart(asLobby, view.hostId),
  };
}

/** Server-corrected clock, ticking every 250 ms (countdowns, reconnect timers). */
export function useServerClock(): number {
  const offset = useLobby((v) => v.offset);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 250); return () => clearInterval(t); }, [offset]);
  return now;
}

export { mmss } from '../../state/format';
