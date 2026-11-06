// Friends & Social — ported from design/mockup/Friends.dc.html (screenshots/08-*.png) with the P2P adaptations of
// DESIGN_SPEC §3.9: tabs Starred / Recent players, ☆ Star, Invite (copy the room link while you're in a room),
// "Join by code" in place of add-friend, profile popover with what you know.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { starPlayer } from '@lobbers/shared';
import { CloseButton, MachineArt, Modal } from '../../components';
import { Stage } from '../../app/Stage';
import { lobbyService, useLobby } from '../../net/p2p/roomService';
import { useProfile } from '../../state/profile';
import { FirstRunModal } from '../Home/modals/FirstRunModal';
import { MACHINE_BG } from '../Inventory/model';
import { inviteLink } from '../Lobby/LobbyOverlays';
import { counts, friendRows, normaliseCode, type FriendRow, type FriendsTab } from './model';
import { YourRoom } from './YourRoom';
import s from './friends.module.css';

const TABS: Array<{ id: FriendsTab; badge: string }> = [{ id: 'Starred', badge: '#FFD166' }, { id: 'Recent players', badge: '#4C9AFF' }];

function Popover({ f, inRoom, onInvite, onStar, onClose }: { f: FriendRow; inRoom: boolean; onInvite: () => void; onStar: () => void; onClose: () => void }): JSX.Element {
  return (
    <Modal label="Player profile" onClose={onClose} style={{ width: 520, padding: 0, overflow: 'hidden' }}>
      <div className={s.stripes} style={{ height: 150, backgroundColor: MACHINE_BG[f.machine], borderBottom: '3px solid #0B0F1A', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><MachineArt kind={f.machine} tint="#4C9AFF" size={160} /></div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}><span className="fd" style={{ fontSize: 32, lineHeight: 1 }}>{f.name}</span><span style={{ fontSize: 14, color: '#FFD166', fontWeight: 600 }}>“{f.title ?? 'Rookie'}” · Level {f.level}</span></div>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          <div style={{ background: '#1C2338', border: '2px solid #0B0F1A', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC' }}>RANK</span><span className="fd" style={{ fontSize: 18 }}>{f.rank}</span></div>
          <div style={{ background: '#1C2338', border: '2px solid #0B0F1A', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC' }}>RATING</span><span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{f.rating.toLocaleString('en-US')}</span></div>
          <div style={{ background: '#1C2338', border: '2px solid #0B0F1A', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC' }}>TOGETHER</span><span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{f.matchesTogether}</span></div>
        </div>
        <span style={{ fontSize: 14, color: '#C9D1E0' }}>As last seen in a lobby · {f.status}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn dark" onClick={onInvite} disabled={!inRoom} title={inRoom ? undefined : 'Create or join a room first'} style={{ height: 52, flex: 1, fontSize: 16, background: '#4C9AFF' }}>Invite to room</button>
          <button type="button" className="btn" onClick={onStar} style={{ height: 52, flex: 1, fontSize: 16 }}>{f.starred ? '★ Starred' : '☆ Star'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function FriendsScreen(): JSX.Element {
  const nav = useNavigate();
  const p = useProfile((v) => v.profile);
  const needsName = useProfile((v) => v.status === 'needsName');
  const view = useLobby((v) => v.view);
  const [tab, setTab] = useState<FriendsTab>(() => (p && p.recentPlayers.some((r) => r.starred) ? 'Starred' : 'Recent players'));
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  if (!p) return <Stage width={1440} height={900} label="Friends"><div className={s.bg} style={{ width: 1440, height: 900 }}>{needsName && <FirstRunModal />}</div></Stage>;

  const rows = friendRows(p, tab);
  const n = counts(p);
  const code = normaliseCode(draft);
  const star = (id: string, on: boolean): void => useProfile.getState().update((q) => starPlayer(q, id, on));
  const invite = (name: string): void => {
    if (!view) return;
    navigator.clipboard.writeText(inviteLink(view.code)).then(() => setToast(`Invite link copied — send it to ${name}`), () => setToast(inviteLink(view.code)));
  };
  const join = (): void => { if (code) nav(`/lobby/${code}`); else setToast('Room codes look like LOB-7Q4K'); };
  const sel = rows.find((r) => r.id === open) ?? null;

  return (
    <Stage width={1440} height={900} label="Friends">
      <div className={s.bg} style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <header style={{ position: 'absolute', left: 24, top: 20, width: 1392, height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn" style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Home</Link>
          <h1 className="fd" style={{ margin: 0, fontSize: 40 }}>FRIENDS &amp; SOCIAL</h1>
          <div style={{ flex: 1 }} />
          {toast && <span className={s.toast} role="status" style={{ fontWeight: 600, color: '#5ACB91' }}>{toast}</span>}
          <label htmlFor="joincode" style={{ position: 'absolute', left: -9999 }}>Join a room by code</label>
          <input id="joincode" className={s.inp} placeholder="Join by code (LOB-XXXX)" value={draft} maxLength={8} onChange={(e) => setDraft(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') join(); }} style={{ width: 280, outline: draft && !code ? '3px solid #F45B55' : undefined }} />
          <button type="button" className="btn dark" onClick={join} disabled={!code} style={{ height: 52, padding: '0 18px', fontSize: 16, background: '#5ACB91' }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 16l4-4-4-4M14 12H3" /></svg>Join
          </button>
        </header>

        <section aria-label="Friends list" className="panel" style={{ position: 'absolute', left: 24, top: 100, width: 860, height: 780, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`btn ${s.tab} ${tab === t.id ? s.on : ''}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.id}<span className="mono" style={{ fontSize: 12, background: t.badge, color: '#101522', border: '2px solid #0B0F1A', borderRadius: 8, padding: '0 6px' }}>{n[t.id]}</span>
              </button>
            ))}
          </div>
          {rows.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A9B3CC', fontSize: 16, textAlign: 'center', padding: 40 }}>
              {tab === 'Starred' ? 'Star the players you like from Recent players — they show up here and on Home.' : 'Everyone you finish a match with shows up here.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            {rows.map((f, i) => (
              <div key={f.id} className={s.row} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: '8px 12px', height: 76, animationDelay: `${(i * 0.04).toFixed(2)}s` }}>
                <span style={{ position: 'relative', width: 60, height: 56, flex: 'none', borderRadius: 10, background: MACHINE_BG[f.machine], border: '2px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={f.machine} tint="#4C9AFF" size={54} /></span>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="fd" style={{ fontSize: 21 }}>{f.name}</span><span className="fd" style={{ fontSize: 12, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 5, padding: '0 6px' }}>LV {f.level}</span>{f.title && <span style={{ fontSize: 13, color: '#FFD166', fontWeight: 600 }}>“{f.title}”</span>}</span>
                  <span style={{ fontSize: 14, color: '#A9B3CC', fontWeight: 600 }}>{f.status}</span>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {view && <button type="button" className="btn dark" onClick={() => invite(f.name)} style={{ height: 44, width: 120, fontSize: 14, background: '#4C9AFF' }}>Invite</button>}
                  <button type="button" className="btn" aria-pressed={f.starred} aria-label={f.starred ? `Unstar ${f.name}` : `Star ${f.name}`} onClick={() => star(f.id, !f.starred)} style={{ height: 44, width: 120, fontSize: 14, color: f.starred ? '#FFD166' : undefined }}>{f.starred ? '★ Starred' : '☆ Star'}</button>
                  <button type="button" className="btn" onClick={() => setOpen(f.id)} aria-label={`View profile of ${f.name}`} style={{ height: 44, width: 44 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <YourRoom view={view} myId={lobbyService.myId} onToast={setToast} />
        {sel && <Popover f={sel} inRoom={!!view} onInvite={() => invite(sel.name)} onStar={() => star(sel.id, !sel.starred)} onClose={() => setOpen(null)} />}
      </div>
    </Stage>
  );
}
