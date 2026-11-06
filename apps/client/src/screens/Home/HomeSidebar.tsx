// Right panel (Main.dc.html aside): profile card, Recent Activity, Your Crew — all from the local
// profile (level, XP, coins, gems, rating, equipped title, match history). The Profile screen is Phase 4.
import { useState } from 'react';
import { COSMETIC_BY_ID, MAPS, REWARDS, starPlayer, type MachineId } from '@lobbers/shared';
import { useLobby } from '../../net/p2p/roomService';
import { inviteLink } from '../Lobby/LobbyOverlays';
import { MachineArt } from '../../components';
import { useProfile } from '../../state/profile';
import { ago } from '../../state/format';
import s from './home.module.css';

const ICON = { win: 'M7 3h10v5a5 5 0 0 1-10 0zM10 15h4v3h3v3H7v-3h3z', loss: 'M5 5l14 14M19 5 5 19', draw: 'M4 9h16M4 15h16' };
const COL = { win: '#FFD166', loss: '#F45B55', draw: '#A9B3CC' };
const LABEL = { win: 'Victory', loss: 'Defeat', draw: 'Draw' };
const PHASE4 = 'The Profile screen arrives in Phase 4';
const fmt = (n: number): string => n.toLocaleString('en-US');

export function HomeSidebar(): JSX.Element {
  const user = useProfile((v) => v.profile);
  const machine = useProfile((v) => v.profile?.favoriteMachine ?? 'thumper');
  const history = (user?.history ?? []).slice(0, 4).map((h) => ({ matchId: h.matchId, outcome: h.draw ? 'draw' as const : h.won ? 'win' as const : 'loss' as const, mapId: h.mapId, xp: h.xp, at: h.endedAt }));
  const level = user?.level ?? 1;
  const need = REWARDS.xpForLevel(level);
  const xp = user?.xp ?? 0;
  const title = COSMETIC_BY_ID[user?.equipped.title ?? '']?.name ?? 'Rookie';
  return (
    <aside className="panel" style={{ position: 'absolute', left: 1060, top: 24, width: 356, height: 856, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="btn" aria-disabled="true" title={PHASE4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 12, padding: 14, background: '#1C2338', textAlign: 'left', color: '#F5F1E8', cursor: 'default' }}>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ position: 'relative', width: 76, height: 76, flex: 'none', background: '#2E3856', border: '3px solid #0B0F1A', clipPath: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MachineArt kind={machine} size={68} tint="#F45B55" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="fd" style={{ fontSize: 24, lineHeight: 1.05 }}>{user?.name ?? '—'}</span>
            <span style={{ fontSize: 14, color: '#FFD166', fontWeight: 600 }}>“{title}”</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#A9B3CC' }}><span className="fd" style={{ background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 6px', fontSize: 14 }} data-testid="profile-level">LV {level}</span>Rating {fmt(user?.rating ?? 1000)}</span>
          </span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A9B3CC' }}><span>XP to level {level + 1}</span><span className="mono">{fmt(xp)} / {fmt(need)}</span></span>
          <span style={{ height: 14, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 8, overflow: 'hidden', display: 'block' }}><span className={s.xp} style={{ display: 'block', height: '100%', width: `${Math.min(100, (xp / need) * 100).toFixed(1)}%`, background: '#5ACB91' }} /></span>
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '6px 10px' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#FFD166" stroke="#0B0F1A" strokeWidth="2.5" /><path d="M10 5v10M7 7.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H13" fill="none" stroke="#8A5A00" strokeWidth="1.6" /></svg><span className="mono" data-testid="profile-coins" style={{ fontSize: 15, fontWeight: 700 }}>{fmt(user?.coins ?? 0)}</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '6px 10px' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 18 8 10 18 2 8Z" fill="#B07CF2" stroke="#0B0F1A" strokeWidth="2.5" strokeLinejoin="round" /><path d="M2 8h16M10 2 7 8l3 10 3-10z" fill="none" stroke="#E6D4FF" strokeWidth="1.2" /></svg><span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmt(user?.gems ?? 0)}</span></span>
        </span>
      </div>

      <section aria-label="Recent activity" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700 }}>RECENT ACTIVITY</h2>
        {history.length === 0 && <span style={{ fontSize: 14, color: '#A9B3CC', padding: '6px 4px' }}>No matches yet. Host a room or join a friend's to play your first.</span>}
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

      <YourCrew />
    </aside>
  );
}

/** "Your Crew" (DESIGN_SPEC §3.9): starred first, then recent players — max 5. No presence without a server. */
function YourCrew(): JSX.Element {
  const profile = useProfile((v) => v.profile);
  const room = useLobby((v) => (v.view && v.view.phase === 'open' ? v.view.code : ''));
  const [copied, setCopied] = useState('');
  const crew = (profile?.recentPlayers ?? []).slice(0, 5);
  const machineOf = (id: string): MachineId => profile?.history.flatMap((h) => h.players).find((p) => p.id === id)?.machine ?? 'thumper';
  const invite = async (id: string): Promise<void> => {
    const url = inviteLink(room);
    try { if (navigator.share) await navigator.share({ title: 'Join my Lobbers room', text: `Room ${room}`, url }); else await navigator.clipboard.writeText(url); setCopied(id); } catch { /* share dismissed */ }
  };
  return (
    <section aria-label="Your crew" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700 }}>YOUR CREW <span className="mono" style={{ color: '#5ACB91' }}>{profile?.recentPlayers.length ?? 0}</span></h2>
        <span aria-disabled="true" title="The Friends screen arrives in Phase 4" style={{ fontSize: 14, fontWeight: 600, color: '#5B6378', cursor: 'not-allowed' }}>See all</span>
      </div>
      {crew.length === 0 && <span style={{ fontSize: 14, color: '#A9B3CC', padding: '6px 4px' }}>Everyone you finish a match with shows up here. Star the ones you play with most.</span>}
      {crew.map((f) => (
        <div key={f.id} className={s.row} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 6, borderRadius: 8 }}>
          <span style={{ position: 'relative', width: 46, height: 46, flex: 'none', background: '#232B42', border: '3px solid #0B0F1A', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MachineArt kind={machineOf(f.id)} size={40} tint="#4C9AFF" />
            <span className="fd" style={{ position: 'absolute', right: -8, bottom: -7, background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 4px', fontSize: 11 }}>{f.level}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.starred ? '★ ' : ''}{f.name}</span>
            <span style={{ fontSize: 12, color: '#A9B3CC' }}>played {f.matchesTogether}× · last {ago(f.lastPlayedAt)}</span>
          </span>
          {room
            ? <button type="button" className="btn" onClick={() => void invite(f.id)} style={{ height: 36, padding: '0 12px', fontSize: 13, background: '#4C9AFF', color: '#101522' }}>{copied === f.id ? 'Copied' : 'Invite'}</button>
            : <button type="button" className="btn" aria-pressed={f.starred} onClick={() => useProfile.getState().update((p) => starPlayer(p, f.id, !f.starred))} style={{ height: 36, padding: '0 12px', fontSize: 13, ...(f.starred ? { background: '#FFD166', color: '#101522' } : {}) }}>{f.starred ? 'Starred' : 'Star'}</button>}
        </div>
      ))}
    </section>
  );
}
