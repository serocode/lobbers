// App-wide network glue: restores the guest session on launch, resumes the lobby seat after a reload,
// and moves the player into a match the moment the server hands out seats (from any screen other than
// the Lobby, which plays its DEPLOYING! beat first).
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { lobbyService, useLobby } from '../net/online/lobbyService';
import { useSession } from '../state/session';

export function NetworkWatcher(): null {
  const nav = useNavigate();
  const loc = useLocation();
  const status = useSession((v) => v.status);
  const pending = useLobby((v) => v.pendingMatch);

  useEffect(() => { void useSession.getState().restore(); }, []);
  useEffect(() => { if (status === 'ready') void lobbyService.resume(); }, [status]);
  useEffect(() => {
    if (!pending || /^\/lobby\/[^/]+$/.test(loc.pathname)) return;
    lobbyService.consumePendingMatch();
    nav(`/match/${pending}`);
  }, [pending, loc.pathname, nav]);
  return null;
}
