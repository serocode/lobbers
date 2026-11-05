// Player Rankings (Results.dc.html): sortable by DMG, RECV, ELIM, AST, ACC, XP, COIN; you highlighted.
import { useState } from 'react';
import type { PlayerResult } from '@lobbers/shared';
import { MachineArt } from '../../components';
import { TEAM_COLOR } from '../../state/matchStore';
import s from './results.module.css';

type Key = 'damageDealt' | 'damageReceived' | 'eliminations' | 'assists' | 'accuracy' | 'xp' | 'coins';
const COLS: Array<[Key, string, string]> = [['damageDealt', 'DMG', 'Damage dealt'], ['damageReceived', 'RECV', 'Damage received'], ['eliminations', 'ELIM', 'Eliminations'], ['assists', 'AST', 'Assists'], ['accuracy', 'ACC', 'Accuracy'], ['xp', 'XP', 'Experience'], ['coins', 'COIN', 'Coins']];
const fmt = (n: number): string => n.toLocaleString('en-US');

export function ResultsTable({ players, myId }: { players: PlayerResult[]; myId: string }): JSX.Element {
  const [sort, setSort] = useState<Key>('damageDealt');
  const [dir, setDir] = useState(-1);
  const rows = [...players].sort((a, b) => (a[sort] - b[sort]) * dir);
  return (
    <section aria-label="Player rankings" className={`panel ${s.rise}`} style={{ position: 'absolute', left: 724, top: 28, width: 692, height: 552, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, animationDelay: '.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><h2 className="fd" style={{ margin: 0, fontSize: 28 }}>Player Rankings</h2><span style={{ fontSize: 12, color: '#A9B3CC' }}>Click a column to sort</span></div>
      <div className={s.tr} style={{ height: 30 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC' }}>#</span><span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1 }}>PLAYER</span>
        {COLS.map(([key, k, label]) => (
          <button key={key} type="button" className={`${s.th} ${sort === key ? s.on : ''}`} aria-label={`Sort by ${label}`} onClick={() => { setDir(sort === key ? -dir : -1); setSort(key); }}>{k}<span>{sort === key ? (dir < 0 ? '▼' : '▲') : ''}</span></button>
        ))}
      </div>
      {rows.map((p, i) => {
        const you = p.playerId === myId, tc = TEAM_COLOR[p.team];
        return (
          <div key={p.unitId} className={s.tr} style={{ background: you ? '#2A2A1E' : i % 2 ? '#171E31' : '#1C2338', border: `2px solid ${you ? '#FFD166' : 'transparent'}` }}>
            <span className="fd" style={{ fontSize: 20, color: i === 0 ? '#FFD166' : i === 1 ? '#D9DEE8' : i === 2 ? '#F28C38' : '#A9B3CC' }}>{i + 1}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 30, borderRadius: 3, background: tc, flex: 'none' }} />
              <span style={{ width: 40, height: 36, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: p.survived ? 'none' : 'grayscale(.7)' }}><MachineArt kind={p.machine} tint={tc} size={40} flip={p.team === 'blue'} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span><span style={{ fontSize: 11, color: '#A9B3CC' }}>{you ? 'You · ' : ''}Team {p.team === 'red' ? 'Red' : 'Blue'}{p.survived ? '' : ' · eliminated'}</span></span>
            </span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{fmt(p.damageDealt)}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, color: '#C9D1E0' }}>{fmt(p.damageReceived)}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{p.eliminations}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, color: '#C9D1E0' }}>{p.assists}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14 }}>{p.accuracy}%</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, color: '#5ACB91' }}>+{p.xp}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 14, color: '#FFD166' }}>+{p.coins}</span>
          </div>
        );
      })}
    </section>
  );
}
