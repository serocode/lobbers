// /match/local?… — hot-seat match: LocalMatchController (the in-browser authority) behind the same
// MatchTransport the network controller implements in Phase 2.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocalMatchController } from '../../net/local/LocalMatchController';
import { ClientMatch } from '../../state/ClientMatch';
import { BattleControls } from '../../state/battleControls';
import { installDevHooks } from '../../dev/devHooks';
import { decodeLocalConfig, encodeLocalConfig, seatsFor, settingsFor } from '../../state/localMatchConfig';
import { BattleScreen } from './BattleScreen';

interface Session { match: ClientMatch; controls: BattleControls }

export default function LocalMatchRoute(): JSX.Element {
  const loc = useLocation();
  const nav = useNavigate();
  const cfg = useMemo(() => decodeLocalConfig(new URLSearchParams(loc.search)), [loc.search]);
  const [session, setSession] = useState<Session | null>(null);

  // Created inside the effect so StrictMode's mount → unmount → mount never reuses a disposed authority.
  useEffect(() => {
    const transport = new LocalMatchController({ settings: settingsFor(cfg), seats: seatsFor(cfg), seed: cfg.seed });
    const match = new ClientMatch(transport);
    const controls = new BattleControls(match);
    match.start();
    const uninstall = installDevHooks(match, controls);
    setSession({ match, controls });
    return () => { uninstall(); controls.dispose(); match.dispose(); setSession(null); };
  }, [cfg]);

  const value = useMemo(() => session && ({
    ...session,
    onLeave: () => nav('/dev/kit#hotseat'),
    onPlayAgain: () => nav(encodeLocalConfig({ ...cfg, seed: cfg.seed + 1 })),
  }), [session, nav, cfg]);

  if (!value) return <div style={{ position: 'fixed', inset: 0, background: '#101522' }} />;
  return <BattleScreen value={value} />;
}
