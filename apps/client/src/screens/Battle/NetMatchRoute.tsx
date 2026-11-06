// /match/:matchId — an online match over the room's PeerClient (MatchFeed), behind the same MatchTransport
// hot seat uses, so BattleScreen and the HUD are unchanged. After a reload a guest rejoins with its stored
// token (the host re-sends a full snapshot); a fresh snapshot (new `generation`) rebuilds the ClientMatch.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CONNECTION_RULES } from '@lobbers/shared';
import { installDevHooks } from '../../dev/devHooks';
import { useFeed } from '../../net/p2p/MatchFeed';
import { codeOfMatch, lobbyService, useLobby } from '../../net/p2p/roomService';
import { BattleControls } from '../../state/battleControls';
import { ClientMatch } from '../../state/ClientMatch';
import { showNotice } from '../../state/notice';
import { useProfile } from '../../state/profile';
import { BattleScreen } from './BattleScreen';
import { ReconnectScrim, type LinkStatus } from './ReconnectScrim';

interface Session { match: ClientMatch; controls: BattleControls }

export default function NetMatchRoute(): JSX.Element {
  const { matchId = '' } = useParams();
  const code = codeOfMatch(matchId);
  const nav = useNavigate();
  const ready = useProfile((v) => v.status === 'ready');
  const room = { code: useLobby((v) => v.code), status: useLobby((v) => v.status), hosting: useLobby((v) => v.hosting) };
  const generation = useFeed((v) => v.generation);
  const feedMatch = useFeed((v) => v.matchId);
  const [session, setSession] = useState<Session | null>(null);
  const lostAt = useRef(0);

  // Not in this room yet (reload / opened the link): guests rejoin with their token; a host is resumed at app start.
  useEffect(() => {
    if (!ready || room.code === code || lobbyService.hostsCode(code)) return;
    lobbyService.join(code).catch((e: unknown) => { showNotice(e instanceof Error ? e.message : String(e), 'error'); nav('/', { replace: true }); });
  }, [ready, room.code, code, nav]);

  const feed = room.code === code ? lobbyService.feed : null;
  const live = !!feed && feedMatch === matchId;
  useEffect(() => {
    if (!feed || !live) return;
    const match = new ClientMatch(feed);
    const controls = new BattleControls(match);
    match.start();
    const uninstall = installDevHooks(match, controls);
    setSession({ match, controls });
    return () => { uninstall(); controls.dispose(); match.dispose(); setSession(null); };
  }, [feed, live, generation]);

  // Closed / not found / window expired → the app-wide ClosedCard; here only the live reconnect scrim.
  const link: LinkStatus = room.status === 'reconnecting' ? 'reconnecting' : 'connected';
  if (link === 'reconnecting' && !lostAt.current) lostAt.current = Date.now();
  if (link !== 'reconnecting') lostAt.current = 0;

  const home = (): void => { void lobbyService.leave(); nav('/'); };
  const value = useMemo(() => session && ({
    ...session,
    nav: {
      // Host: the room keeps running the match in this tab until it ends. Guest: forfeit and leave.
      surrender: () => { session.match.send({ t: 'forfeit' }); if (room.hosting) nav('/'); else setTimeout(home, 150); },
      surrenderNote: room.hosting
        ? 'Your machine is removed and the match counts as a loss. You host this room, so it stays open until the match ends.'
        : 'Your machine is removed and the match counts as a loss.',
      seeResults: () => nav(`/results/${matchId}`),
      playAgain: () => {
        const me = useLobby.getState().view?.players.find((p) => p.id === lobbyService.myId);
        if (me && !me.isHost) lobbyService.send({ t: 'setReady', ready: true });
        nav(`/lobby/${code}`);
      },
      playAgainLabel: 'Play again',
      back: () => nav(`/lobby/${code}`),
      backLabel: 'Back to lobby',
    },
  }), [session, nav, matchId, code, room.hosting]);

  return (
    <>
      {value ? <BattleScreen value={value} /> : <div style={{ position: 'fixed', inset: 0, background: '#101522' }} />}
      <ReconnectScrim status={link} deadline={lostAt.current + CONNECTION_RULES.reconnectWindowSec * 1000} onLeave={home} />
    </>
  );
}
