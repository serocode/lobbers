// Profile.dc.html "Career stats", "Match history" and "Achievements" panels.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MACHINES, MAPS, achievementStatus, type AchievementGlyph, type LocalProfile } from '@lobbers/shared';
import { ChevronLeft, ChevronRight, MachineArt } from '../../components';
import { ago } from '../../state/format';
import { MACHINE_BG } from '../Inventory/model';
import { careerStats, historyPage, mostPlayed, type HistoryTab } from './model';
import s from './profile.module.css';

export function CareerStats({ p }: { p: LocalProfile }): JSX.Element {
  const { winRate, cards } = careerStats(p);
  const fav = mostPlayed(p);
  return (
    <section aria-label="Career stats" className="panel" style={{ position: 'absolute', left: 468, top: 100, width: 948, height: 156, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 22 }}>
      <div style={{ position: 'relative', width: 110, height: 110, flex: 'none' }}>
        <svg aria-hidden="true" width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="44" fill="none" stroke="#2A3045" strokeWidth="14" /><circle cx="55" cy="55" r="44" fill="none" stroke="#F45B55" strokeWidth="14" opacity=".35" /><circle className={s.ring} cx="55" cy="55" r="44" fill="none" stroke="#5ACB91" strokeWidth="14" strokeDasharray="276.5" strokeDashoffset={276.5 * (1 - winRate / 100)} transform="rotate(-90 55 55)" strokeLinecap="round" /></svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span className="mono" data-testid="win-rate" style={{ fontSize: 24, fontWeight: 700 }}>{winRate}%</span><span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC' }}>WIN RATE</span></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, flex: 1 }}>
        {cards.map((c) => (
          <div key={c.k} style={{ background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#A9B3CC' }}>{c.k}</span>
            <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.v}</span>
            <span style={{ fontSize: 11, color: '#A9B3CC' }}>{c.sub}</span>
          </div>
        ))}
      </div>
      <div style={{ width: 220, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '8px 12px' }}>
        <span className={s.stripes} style={{ width: 76, height: 70, flex: 'none', borderRadius: 8, backgroundColor: MACHINE_BG[fav.id], display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><MachineArt kind={fav.id} tint="#F45B55" size={72} /></span>
        <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#A9B3CC' }}>FAVORITE</span><span className="fd" style={{ fontSize: 22 }}>{MACHINES[fav.id].name}</span><span className="mono" style={{ fontSize: 11, color: '#C9D1E0' }}>{fav.matches} matches · {fav.winPct}% W</span></span>
      </div>
    </section>
  );
}

export function MatchHistory({ p }: { p: LocalProfile }): JSX.Element {
  const nav = useNavigate();
  const [tab, setTab] = useState<HistoryTab>('All');
  const [page, setPage] = useState(0);
  const h = historyPage(p, (e) => MAPS[e.mapId].name, tab, page);
  return (
    <section aria-label="Match history" className="panel" style={{ position: 'absolute', left: 468, top: 272, width: 560, height: 608, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 24 }}>Match History</h2>
        <div style={{ flex: 1 }} />
        {h.pages > 1 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" className="btn" aria-label="Newer matches" disabled={h.page === 0} onClick={() => setPage(h.page - 1)} style={{ width: 30, height: 30, padding: 0 }}><ChevronLeft size={11} /></button>
            <span className="mono" data-testid="history-page" style={{ fontSize: 12, color: '#A9B3CC', minWidth: 34, textAlign: 'center' }}>{h.page + 1} / {h.pages}</span>
            <button type="button" className="btn" aria-label="Older matches" disabled={h.page >= h.pages - 1} onClick={() => setPage(h.page + 1)} style={{ width: 30, height: 30, padding: 0 }}><ChevronRight size={11} /></button>
          </span>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['All', 'Wins', 'Losses'] as const).map((t) => <button key={t} type="button" className={`btn ${s.tab} ${tab === t ? s.on : ''}`} aria-pressed={tab === t} onClick={() => { setTab(t); setPage(0); }}>{t}</button>)}
        </div>
      </div>
      {h.rows.length === 0 && <span style={{ color: '#A9B3CC', fontSize: 15, padding: '20px 4px' }}>{p.history.length ? 'Nothing here yet.' : 'Your finished matches show up here. Host a room or play Hot Seat with friends.'}</span>}
      {h.rows.map((r, i) => (
        <button key={r.matchId} type="button" className={s.row} aria-label={`${r.won ? 'Win' : r.draw ? 'Draw' : 'Loss'} on ${r.map}, ${ago(r.endedAt)}. Open results`} onClick={() => nav(`/results/${encodeURIComponent(r.matchId)}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1C2338', border: '2px solid #0B0F1A', borderRadius: 10, padding: '6px 10px', height: 58, animationDelay: `${(i * 0.04).toFixed(2)}s` }}>
          <span className="fd" style={{ width: 40, height: 40, flex: 'none', borderRadius: 8, border: '2px solid #0B0F1A', background: r.won ? '#5ACB91' : r.draw ? '#A9B3CC' : '#F45B55', color: '#101522', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{r.won ? 'W' : r.draw ? 'D' : 'L'}</span>
          <span style={{ width: 44, height: 38, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={r.machine} tint="#F45B55" size={42} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 700 }}>{r.map}</span><span style={{ fontSize: 12, color: '#A9B3CC' }}>{r.mode} · {ago(r.endedAt)}</span></span>
          <span className="mono" style={{ fontSize: 13, width: 60, textAlign: 'right' }}>{r.ka}</span>
          <span className="mono" style={{ fontSize: 13, width: 66, textAlign: 'right' }}>{r.dmg}</span>
          <span className="mono" style={{ fontSize: 13, width: 60, textAlign: 'right', color: '#5ACB91' }}>+{r.xp}</span>
        </button>
      ))}
    </section>
  );
}

const GLYPH: Record<AchievementGlyph, string> = {
  aim: 'M23 23a9 9 0 1 0 .01 0zm0 4a5 5 0 1 1-.01 0zm0 3a2 2 0 1 0 .01 0z',
  star: 'M23 22l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.5-4 6-.6z',
  bolt: 'M25 21l-7 12h5l-2 9 8-13h-5z',
  flame: 'M23 21c3 4 7 7 7 12a7 7 0 0 1-14 0c0-3 2-5 3-6 0 3 2 4 3 4-1-4 0-7 1-10z',
  drop: 'M23 21l6 10a6.5 6.5 0 1 1-12 0z',
};

export function Achievements({ p }: { p: LocalProfile }): JSX.Element {
  const list = achievementStatus(p);
  const [sel, setSel] = useState(() => Math.max(0, list.findIndex((a) => a.done)));
  const a = list[sel];
  return (
    <section aria-label="Achievements" className="panel" style={{ position: 'absolute', left: 1044, top: 272, width: 372, height: 608, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><h2 className="fd" style={{ margin: 0, fontSize: 24 }}>Achievements</h2><span className="mono" data-testid="ach-done" style={{ fontSize: 13, color: '#A9B3CC' }}>{list.filter((x) => x.done).length} / {list.length}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {list.map((x, i) => (
          <button key={x.def.id} type="button" className={`btn ${s.ach} ${sel === i ? s.on : ''}`} aria-pressed={sel === i} title={x.def.description} onClick={() => setSel(i)}>
            <svg aria-hidden="true" width="46" height="50" viewBox="0 0 46 50" style={{ filter: x.done ? 'none' : 'grayscale(1) brightness(.6)' }}><path d="M13 2 H21 L23 18 L25 2 H33 L29 22 H17 Z" fill={x.done ? '#F45B55' : '#5B6378'} stroke="#0B0F1A" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="23" cy="32" r="15" fill={x.def.color} stroke="#0B0F1A" strokeWidth="3" /><path d={GLYPH[x.def.glyph]} fill="#101522" /></svg>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, color: x.done ? '#F5F1E8' : '#A9B3CC' }}>{x.def.name}</span>
            {!x.done && <span style={{ width: '80%', height: 5, background: '#0E1320', borderRadius: 3, overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((Math.min(x.value, x.def.goal) / x.def.goal) * 100)}%`, background: '#4C9AFF' }} /></span>}
          </button>
        ))}
      </div>
      <div data-testid="ach-detail" style={{ flex: 1, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: a.done ? '#5ACB91' : '#4C9AFF' }}>{a.done ? 'UNLOCKED' : 'IN PROGRESS'}</span>
        <span className="fd" style={{ fontSize: 22 }}>{a.def.name}</span>
        <span style={{ fontSize: 14, color: '#C9D1E0', lineHeight: 1.4 }}>{a.def.description}</span>
        <span className="mono" style={{ fontSize: 12, color: '#A9B3CC', marginTop: 'auto' }}>{Math.min(a.value, a.def.goal).toLocaleString('en-US')} / {a.def.goal.toLocaleString('en-US')}</span>
      </div>
    </section>
  );
}
