// /hotseat?… — Hot Seat (DESIGN_SPEC §3.9): a HostSession with one loopback PeerClient per seat (HotSeat), behind the
// same MatchTransport online play uses.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HotSeat } from '../../net/local/HotSeat';
import { ClientMatch } from '../../state/ClientMatch';
import { BattleControls } from '../../state/battleControls';
import { installDevHooks } from '../../dev/devHooks';
import { decodeLocalConfig, encodeLocalConfig, hotSeatSeats, settingsFor } from '../../state/localMatchConfig';
import { BattleScreen } from './BattleScreen';

interface Session { match: ClientMatch; controls: BattleControls }

export default function LocalMatchRoute(): JSX.Element {
  const loc = useLocation();
  const nav = useNavigate();
  const cfg = useMemo(() => decodeLocalConfig(new URLSearchParams(loc.search)), [loc.search]);
  const [session, setSession] = useState<Session | null>(null);

  // Created inside the effect so StrictMode's mount → unmount → mount never reuses a disposed authority.
  useEffect(() => {
    const transport = new HotSeat({ settings: settingsFor(cfg), seats: hotSeatSeats(cfg), seed: cfg.seed });
    const match = new ClientMatch(transport);
    const controls = new BattleControls(match);
    match.start();
    const uninstall = installDevHooks(match, controls);
    setSession({ match, controls });
    return () => { uninstall(); controls.dispose(); match.dispose(); setSession(null); };
  }, [cfg]);

  const value = useMemo(() => session && ({
    ...session,
    nav: {
      surrender: () => nav('/'),
      surrenderNote: 'This hot-seat match ends for everyone at this screen.',
      resultsReason: 'Hot Seat matches have no results screen (no rewards)',
      playAgain: () => nav(encodeLocalConfig({ ...cfg, seed: cfg.seed + 1 })),
      playAgainLabel: 'Play again',
      back: () => nav('/'),
      backLabel: 'Back to home',
    },
  }), [session, nav, cfg]);

  if (!value) return <div style={{ position: 'fixed', inset: 0, background: '#101522' }} />;
  return <BattleScreen value={value} />;
}
