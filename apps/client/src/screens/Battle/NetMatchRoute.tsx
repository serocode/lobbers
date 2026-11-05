// /match/:matchId — an online match: NetMatchController (Colyseus MatchRoom) behind the same
// MatchTransport the hot-seat controller implements, so BattleScreen and the HUD are unchanged.
// A reconnect brings a fresh full snapshot (new `generation`) → a fresh ClientMatch.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { installDevHooks } from '../../dev/devHooks';
import { lobbyService, useLobby } from '../../net/online/lobbyService';
import { matchService } from '../../net/online/matchService';
import { useMatchLink, type NetMatchController } from '../../net/online/NetMatchController';
import { BattleControls } from '../../state/battleControls';
import { ClientMatch } from '../../state/ClientMatch';
import { showNotice } from '../../state/notice';
import { useSession } from '../../state/session';
import { BattleScreen } from './BattleScreen';
import { ReconnectScrim } from './ReconnectScrim';

interface Session { match: ClientMatch; controls: BattleControls }

export default function NetMatchRoute(): JSX.Element {
  const { matchId = '' } = useParams();
  const nav = useNavigate();
  const ready = useSession((v) => v.status === 'ready');
  const link = useMatchLink();
  const lobbyCode = useLobby((v) => v.view?.code ?? '');
  const [ctrl, setCtrl] = useState<NetMatchController | null>(() => (matchService.current?.matchId === matchId ? matchService.current : null));
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (ctrl || !ready) return;
    let alive = true;
    void matchService.resume(matchId).then((c) => {
      if (!alive) return;
      if (c) setCtrl(c);
      else { showNotice('That match is over or your seat expired', 'error'); nav('/', { replace: true }); }
    });
    void lobbyService.resume();
    return () => { alive = false; };
  }, [ctrl, ready, matchId, nav]);

  useEffect(() => {
    if (!ctrl) return;
    const match = new ClientMatch(ctrl);
    const controls = new BattleControls(match);
    match.start();
    const uninstall = installDevHooks(match, controls);
    setSession({ match, controls });
    return () => { uninstall(); controls.dispose(); match.dispose(); setSession(null); };
  }, [ctrl, link.generation]);

  const leaveHome = (): void => { void matchService.leave(); void lobbyService.leave(); nav('/'); };
  const value = useMemo(() => session && ({
    ...session,
    nav: {
      surrender: leaveHome,
      surrenderNote: 'Your machine is removed and the match counts as a loss.',
      seeResults: () => nav(`/results/${matchId}`),
      playAgain: lobbyCode ? () => {
        const me = useLobby.getState().view?.players.find((p) => p.id === lobbyService.myId);
        if (me && !me.isHost) lobbyService.send({ t: 'setReady', ready: true });
        void matchService.leave();
        nav(`/lobby/${lobbyCode}`);
      } : undefined,
      playAgainLabel: 'Play again',
      playAgainReason: 'The room has closed',
      back: () => { void matchService.leave(); nav(lobbyCode ? `/lobby/${lobbyCode}` : '/'); },
      backLabel: lobbyCode ? 'Back to lobby' : 'Back to home',
    },
  }), [session, nav, matchId, lobbyCode]);

  return (
    <>
      {value ? <BattleScreen value={value} /> : <div style={{ position: 'fixed', inset: 0, background: '#101522' }} />}
      <ReconnectScrim status={link.status} deadline={link.deadline} onLeave={leaveHome} />
    </>
  );
}
