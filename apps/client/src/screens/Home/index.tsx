// Home / main menu — ported from design/mockup/Main.dc.html (screenshots/01-home*.png).
// PLAY NOW / Create Room host a room in this tab (PeerJS); Join Room joins one by code (DESIGN_SPEC §2.1, §3.9).
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MACHINE_LIST, SEASON } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { MachineArt, PlayButton, SceneBackdrop, Toast } from '../../components';
import { useProfile } from '../../state/profile';
import { clearNotice, useNotice } from '../../state/notice';
import { HomeSidebar } from './HomeSidebar';
import { CreateRoomModal } from './modals/CreateRoomModal';
import { FirstRunModal } from './modals/FirstRunModal';
import { HotSeatIcon, HotSeatModal } from './modals/HotSeatModal';
import { JoinRoomModal } from './modals/JoinRoomModal';
import { SettingsModal } from './modals/SettingsModal';
import { MissionsModal } from './modals/MissionsModal';
import { LeaderboardsModal } from './modals/LeaderboardsModal';
import { HomeNav } from './HomeNav';
import s from './home.module.css';

type ModalId = 'create' | 'join' | 'settings' | 'hotseat' | 'missions' | 'leaders' | null;

function seasonLeft(now: number): string {
  const ms = Math.max(0, Date.parse(SEASON.endsAt) - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
  return `· ${d}d ${String(h).padStart(2, '0')}h left`;
}

const Shell = ({ fill }: { fill: string }): JSX.Element => <svg width="26" height="14" viewBox="0 0 26 14"><path d="M2 2 H16 Q24 7 16 12 H2 Z" fill={fill} stroke="#0B0F1A" strokeWidth="2.5" /></svg>;
const Pop = ({ star, core }: { star: string; core: string }): JSX.Element => <svg width="120" height="120" viewBox="0 0 120 120"><path d="M60 6 L70 40 L104 22 L84 52 L116 64 L82 72 L98 104 L66 84 L56 116 L48 82 L16 100 L34 70 L4 58 L38 48 L22 18 L52 36 Z" fill={star} stroke="#0B0F1A" strokeWidth="4" strokeLinejoin="round" /><circle cx="60" cy="62" r="18" fill={core} /></svg>;

export default function Home(): JSX.Element {
  const nav = useNavigate();
  const status = useProfile((v) => v.status);
  const storageOk = useProfile((v) => v.storageOk);
  const loc = useLocation();
  // Other screens can open a Home modal: nav('/', { state: { modal: 'create' } }) (Friends → Create Room).
  const [modal, setModal] = useState<ModalId>(() => ((loc.state as { modal?: ModalId } | null)?.modal ?? null));
  const [feat, setFeat] = useState(0);
  const notice = useNotice((v) => v.notice);
  const fm = MACHINE_LIST[feat];
  const ready = status === 'ready';

  useEffect(() => { if (!notice) return; const t = setTimeout(clearNotice, 2200); return () => clearTimeout(t); }, [notice]);

  const toLobby = (code: string): void => { setModal(null); if (code) nav(`/lobby/${code}`); };
  const cycle = (d: number): void => setFeat((f) => (f + d + MACHINE_LIST.length) % MACHINE_LIST.length);

  return (
    <Stage width={1440} height={900} label="Lobbers home">
      <div style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', background: '#101522', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1440, height: 900 }}><SceneBackdrop map="cobalt" w={1440} h={900} /></div>
        <div className={`${s.lob} ${s.lob1}`} aria-hidden="true"><Shell fill="#F5F1E8" /></div>
        <div className={`${s.lob} ${s.lob2}`} aria-hidden="true"><Shell fill="#FFD166" /></div>
        <div className={s.pop} style={{ left: 1230, top: 640 }} aria-hidden="true"><Pop star="#FFD166" core="#F5F1E8" /></div>
        <div className={s.pop} style={{ left: 470, top: 720, animationDelay: '2.1s' }} aria-hidden="true"><Pop star="#F45B55" core="#FFD166" /></div>

        <div style={{ position: 'absolute', left: 0, top: 0, width: 740, height: 900, background: 'rgba(16,21,34,.78)', clipPath: 'polygon(0 0,100% 0,80% 100%,0 100%)' }} />

        <div style={{ position: 'absolute', left: 56, top: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="fd" style={{ background: '#F45B55', color: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, padding: '4px 10px', fontSize: 15 }}>SEASON {SEASON.number}</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#F5F1E8' }}>{SEASON.name}</span>
          <span className="mono" style={{ fontSize: 13, color: '#A9B3CC' }}>{seasonLeft(Date.now())}</span>
        </div>

        <div style={{ position: 'absolute', left: 48, top: 118, width: 640 }}>
          <svg aria-hidden="true" width="600" height="90" viewBox="0 0 600 90" style={{ position: 'absolute', left: 30, top: -62, overflow: 'visible' }}>
            <path d="M0 86 Q 280 -50 560 70" fill="none" stroke="#F5F1E8" strokeWidth="5" strokeDasharray="1 14" strokeLinecap="round" opacity=".85" />
            <g transform="translate(560 70) rotate(36)"><path d="M-18 -8 H6 Q18 0 6 8 H-18 Z" fill="#F5F1E8" stroke="#0B0F1A" strokeWidth="3.5" /><rect x="-14" y="-8" width="5" height="16" fill="#F45B55" stroke="#0B0F1A" strokeWidth="2" /></g>
          </svg>
          <h1 className={s.logo}><span style={{ color: '#FFD166' }}>LOB</span><span style={{ color: '#F5F1E8' }}>BERS</span></h1>
          <div style={{ display: 'flex', marginTop: 22, marginLeft: 14, transform: 'rotate(-3deg)' }}>
            <div className="fd" style={{ background: '#F45B55', color: '#101522', border: '3px solid #0B0F1A', boxShadow: '0 5px 0 #0B0F1A', padding: '6px 18px', fontSize: 24, clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)' }}>4 v 4 ARTILLERY MAYHEM</div>
          </div>
        </div>

        {!storageOk && (
          <div role="status" data-testid="storage-banner" style={{ position: 'absolute', left: 56, top: 366, width: 470, background: '#FFD166', color: '#101522', border: '3px solid #0B0F1A', borderRadius: 10, boxShadow: '0 4px 0 #0B0F1A', padding: '8px 14px', fontWeight: 700, fontSize: 15 }}>
            Progress can’t be saved in this browser (private mode?)
          </div>
        )}
        <div style={{ position: 'absolute', left: 56, top: 430, width: 470, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PlayButton title="PLAY NOW" subtitle="Host a room for your friends" disabled={!ready} onClick={() => setModal('create')}
            icon={<svg aria-hidden="true" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" fill="#101522" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" /></svg>} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 }}>
            <button type="button" className={`btn ${s.tile}`} disabled={!ready} onClick={() => setModal('hotseat')}>
              <span style={{ width: 38, height: 38, borderRadius: 8, background: '#4C9AFF', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HotSeatIcon /></span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>Hot Seat<span style={{ fontSize: 11, fontWeight: 600, color: '#A9B3CC' }}>Pass &amp; play on one screen</span></span>
            </button>
            <button type="button" className={`btn ${s.tile}`} disabled={!ready} onClick={() => setModal('create')}>
              <span style={{ width: 38, height: 38, borderRadius: 8, background: '#5ACB91', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="3.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
              <span>Create Room</span>
            </button>
            <button type="button" className={`btn ${s.tile}`} disabled={!ready} onClick={() => setModal('join')}>
              <span style={{ width: 38, height: 38, borderRadius: 8, background: '#F45B55', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5v16h-5M10 8l4 4-4 4M3 12h11" /></svg></span>
              <span>Join Room</span>
            </button>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 640, top: 236, width: 420, height: 540 }}>
          <div key={fm.id} className={s.enter} style={{ position: 'absolute', inset: 0 }}>
            <svg aria-hidden="true" width="420" height="130" viewBox="0 0 420 130" style={{ position: 'absolute', left: 0, top: 300 }}>
              <ellipse cx="210" cy="84" rx="190" ry="36" fill="#0B0F1A" opacity=".55" />
              <ellipse cx="210" cy="66" rx="178" ry="32" fill="#1C2338" stroke="#0B0F1A" strokeWidth="4" />
              <ellipse cx="210" cy="58" rx="178" ry="30" fill="#2E3856" stroke="#0B0F1A" strokeWidth="4" />
              <ellipse cx="210" cy="58" rx="136" ry="20" fill="none" stroke={fm.color} strokeWidth="4" strokeDasharray="14 10"><animate attributeName="stroke-dashoffset" values="0;-48" dur="1.6s" repeatCount="indefinite" /></ellipse>
            </svg>
            <div className={s.bob} style={{ position: 'absolute', left: 30, top: 30, width: 360, height: 300 }}><MachineArt kind={fm.id} size={360} tint="#F45B55" aim={28} /></div>
            <div style={{ position: 'absolute', left: 20, top: 412, width: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>FEATURED MACHINE</span>
              <span className="fd" style={{ fontSize: 46, lineHeight: 1, color: '#F5F1E8', WebkitTextStroke: '5px #0B0F1A', paintOrder: 'stroke fill' }}>{fm.name}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#101522', background: fm.color, border: '3px solid #0B0F1A', borderRadius: 6, padding: '2px 10px' }}>{fm.role}</span>
            </div>
          </div>
          <button type="button" className="btn" aria-label="Previous machine" onClick={() => cycle(-1)} style={{ position: 'absolute', left: 0, top: 420, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5F1E8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
          <button type="button" className="btn" aria-label="Next machine" onClick={() => cycle(1)} style={{ position: 'absolute', right: 0, top: 420, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5F1E8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
        </div>

        <HomeNav onSettings={() => setModal('settings')} onMissions={() => setModal('missions')} onLeaders={() => setModal('leaders')} />
        <HomeSidebar />

        {modal === 'hotseat' && <HotSeatModal onClose={() => setModal(null)} />}
        {modal === 'create' && <CreateRoomModal onClose={() => setModal(null)} onCreated={toLobby} />}
        {modal === 'join' && <JoinRoomModal onClose={() => setModal(null)} onJoined={toLobby} />}
        {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
        {modal === 'missions' && <MissionsModal onClose={() => setModal(null)} />}
        {modal === 'leaders' && <LeaderboardsModal onClose={() => setModal(null)} />}
        {status === 'needsName' && <FirstRunModal />}
        {notice && <Toast key={notice.id} message={notice.text} kind={notice.kind} />}
      </div>
    </Stage>
  );
}
