// Right panel (Main.dc.html aside): profile card, Recent Activity, Friends Online.
// Guests have no stored profile, friends or currency until accounts land (Phase 4), so the card shows a
// fresh guest's real values and Friends shows an empty state; activity is this browser's matches.
import { MAPS, REWARDS } from '@lobbers/shared';
import { MachineArt } from '../../components';
import { useSession } from '../../state/session';
import { ago, readHistory } from '../../state/history';

const ICON = { win: 'M7 3h10v5a5 5 0 0 1-10 0zM10 15h4v3h3v3H7v-3h3z', loss: 'M5 5l14 14M19 5 5 19', draw: 'M4 9h16M4 15h16' };
const COL = { win: '#FFD166', loss: '#F45B55', draw: '#A9B3CC' };
const LABEL = { win: 'Victory', loss: 'Defeat', draw: 'Draw' };
const PHASE4 = 'Profiles, currency and friends arrive with accounts (Phase 4)';

export function HomeSidebar(): JSX.Element {
  const user = useSession((v) => v.user);
  const machine = useSession((v) => v.machine);
  const history = readHistory().slice(0, 4);
  const need = REWARDS.xpForLevel(1);
  return (
    <aside className="panel" style={{ position: 'absolute', left: 1060, top: 24, width: 356, height: 856, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="btn" aria-disabled="true" title={PHASE4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 12, padding: 14, background: '#1C2338', textAlign: 'left', color: '#F5F1E8', cursor: 'default' }}>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ position: 'relative', width: 76, height: 76, flex: 'none', background: '#2E3856', border: '3px solid #0B0F1A', clipPath: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MachineArt kind={machine} size={68} tint="#F45B55" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="fd" style={{ fontSize: 24, lineHeight: 1.05 }}>{user?.name ?? '—'}</span>
            <span style={{ fontSize: 14, color: '#FFD166', fontWeight: 600 }}>“Rookie”</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#A9B3CC' }}><span className="fd" style={{ background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 6px', fontSize: 14 }}>LV 1</span>Unranked · Guest</span>
          </span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A9B3CC' }}><span>XP to level 2</span><span className="mono">0 / {need.toLocaleString('en-US')}</span></span>
          <span style={{ height: 14, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 8, overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: '0%', background: '#5ACB91' }} /></span>
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '6px 10px' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#FFD166" stroke="#0B0F1A" strokeWidth="2.5" /><path d="M10 5v10M7 7.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H13" fill="none" stroke="#8A5A00" strokeWidth="1.6" /></svg><span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>0</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '6px 10px' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 18 8 10 18 2 8Z" fill="#B07CF2" stroke="#0B0F1A" strokeWidth="2.5" strokeLinejoin="round" /><path d="M2 8h16M10 2 7 8l3 10 3-10z" fill="none" stroke="#E6D4FF" strokeWidth="1.2" /></svg><span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>0</span></span>
        </span>
      </div>

      <section aria-label="Recent activity" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700 }}>RECENT ACTIVITY</h2>
        {history.length === 0 && <span style={{ fontSize: 14, color: '#A9B3CC', padding: '6px 4px' }}>No matches yet. Hit Quick Match to play your first.</span>}
        {history.map((a) => (
          <div key={a.matchId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 4px' }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 8, border: '3px solid #0B0F1A', background: COL[a.outcome], display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={a.outcome === 'win' ? '#101522' : 'none'} stroke={a.outcome === 'win' ? 'none' : '#101522'} strokeWidth="3"><path d={ICON[a.outcome]} /></svg></span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{LABEL[a.outcome]} on {MAPS[a.mapId].name}</span>
              <span style={{ fontSize: 12, color: '#A9B3CC' }}>+{a.xp} XP · {ago(a.at)}</span>
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Friends online" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700 }}>FRIENDS ONLINE <span className="mono" style={{ color: '#5ACB91' }}>0</span></h2>
          <span aria-disabled="true" title={PHASE4} style={{ fontSize: 14, fontWeight: 600, color: '#5B6378', cursor: 'not-allowed' }}>See all</span>
        </div>
        <span style={{ fontSize: 14, color: '#A9B3CC', padding: '6px 4px' }}>Friends, presence and invites arrive with accounts. Share a room code to play together today.</span>
      </section>
    </aside>
  );
}
