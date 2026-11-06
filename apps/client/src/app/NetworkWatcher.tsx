// App-wide glue: loads the local profile, resumes a room this tab was hosting (host refresh), follows invite
// links (`/?join=LOB-XXXX`), and moves everyone into the match when the host's `matchStarted` arrives (from any
// screen other than the Lobby, which plays its DEPLOYING! beat first).
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROOM_LIMITS } from '@lobbers/shared';
import { lobbyService, useLobby } from '../net/p2p/roomService';
import { useProfile } from '../state/profile';

const CODE_RE = new RegExp(`^${ROOM_LIMITS.codePrefix}[${ROOM_LIMITS.codeAlphabet}]{${ROOM_LIMITS.codeLength}}$`);

export function NetworkWatcher(): null {
  const nav = useNavigate();
  const loc = useLocation();
  const status = useProfile((v) => v.status);
  const pending = useLobby((v) => v.pendingMatch);

  useEffect(() => { useProfile.getState().init(); }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    void lobbyService.resumeHosted().then((code) => {
      if (code && location.pathname === '/') nav(`/lobby/${code}`, { replace: true });
    });
  }, [status, nav]);

  // Invite links: /?join=LOB-XXXX → the Lobby route joins (after the first-run name if needed).
  useEffect(() => {
    const join = new URLSearchParams(loc.search).get('join')?.toUpperCase();
    if (join && CODE_RE.test(join)) nav(`/lobby/${join}`, { replace: true });
  }, [loc.search, nav]);

  useEffect(() => {
    if (!pending || /^\/lobby\/[^/]+$/.test(loc.pathname) || loc.pathname === `/match/${pending}`) return;
    lobbyService.consumePendingMatch();
    nav(`/match/${pending}`);
  }, [pending, loc.pathname, nav]);
  return null;
}
