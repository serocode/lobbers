// Player Profile — ported from design/mockup/Profile.dc.html (screenshots/06-profile.png). Only your own profile
// exists (no server); other players get the popover card on Friends (DESIGN_SPEC §2.6, §3.9).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankFor } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { useProfile } from '../../state/profile';
import { FirstRunModal } from '../Home/modals/FirstRunModal';
import { Achievements, CareerStats, MatchHistory } from './CareerPanels';
import { IdentityCard } from './IdentityCard';
import { shareText } from './model';
import s from './profile.module.css';

export default function ProfileScreen(): JSX.Element {
  const p = useProfile((v) => v.profile);
  const needsName = useProfile((v) => v.status === 'needsName');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);
  if (!p) return <Stage width={1440} height={900} label="Player profile"><div className={s.bg} style={{ width: 1440, height: 900 }}>{needsName && <FirstRunModal />}</div></Stage>;
  const share = (): void => {
    const text = shareText(p, rankFor(p.rating).label, location.origin);
    navigator.clipboard.writeText(text).then(() => setToast('Profile summary copied'), () => setToast(text));
  };
  return (
    <Stage width={1440} height={900} label="Player profile">
      <div className={s.bg} style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <header style={{ position: 'absolute', left: 24, top: 20, width: 1392, height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn" style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Home</Link>
          <h1 className="fd" style={{ margin: 0, fontSize: 40 }}>PLAYER PROFILE</h1>
          <div style={{ flex: 1 }} />
          {toast && <span className={s.toast} role="status" style={{ fontWeight: 600, color: '#5ACB91', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast}</span>}
          <Link to="/friends" className="btn" style={{ height: 52, padding: '0 16px', fontSize: 16 }}>Friends</Link>
          <button type="button" className="btn" onClick={share} style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5" /></svg>Share profile</button>
        </header>
        <IdentityCard p={p} />
        <CareerStats p={p} />
        <MatchHistory p={p} />
        <Achievements p={p} />
      </div>
    </Stage>
  );
}
