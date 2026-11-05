// Match details (Results.dc.html): per-turn team damage bars + weapon usage cards, from server data.
import { WEAPONS, type MatchDetails } from '@lobbers/shared';
import { CloseButton, Modal, WeaponIcon } from '../../components';
import s from './results.module.css';

export function MatchDetailsModal({ details, onClose }: { details: MatchDetails; onClose: () => void }): JSX.Element {
  const turns = details.damageByTurn.slice(-14);
  const max = Math.max(1, ...turns.map((t) => t.red + t.blue));
  const cols = Math.max(turns.length, 1);
  return (
    <Modal label="Match details" onClose={onClose} style={{ width: 980, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 className="fd" style={{ margin: 0, fontSize: 32 }}>Match Details</h2><CloseButton onClick={onClose} /></div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: '#F45B55', border: '2px solid #0B0F1A', borderRadius: 3 }} />Team Red damage</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: '#4C9AFF', border: '2px solid #0B0F1A', borderRadius: 3 }} />Team Blue damage</span>
        {details.damageByTurn.length > 14 && <span style={{ color: '#A9B3CC', fontWeight: 600 }}>Last 14 turns</span>}
      </div>
      <div style={{ height: 220, display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 10, alignItems: 'end', borderBottom: '3px solid #2A3045', padding: '0 4px' }}>
        {turns.length === 0 && <span style={{ color: '#A9B3CC', alignSelf: 'center' }}>No damage was dealt this match.</span>}
        {turns.map((t, i) => {
          const v = t.red + t.blue;
          return (
            <div key={t.turn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
              <span className="mono" style={{ fontSize: 11, color: '#C9D1E0' }}>{v}</span>
              <div className={s.bar} style={{ width: '100%', height: Math.max(4, Math.round((v / max) * 180)), display: 'flex', flexDirection: 'column', border: '2px solid #0B0F1A', borderRadius: '4px 4px 0 0', overflow: 'hidden', animationDelay: `${(i * 0.04).toFixed(2)}s` }}>
                <div style={{ flex: t.blue, background: '#4C9AFF' }} /><div style={{ flex: t.red, background: '#F45B55' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 10, padding: '0 4px', marginTop: -10 }}>{turns.map((t) => <span key={t.turn} className="mono" style={{ fontSize: 11, color: '#A9B3CC', textAlign: 'center' }}>T{t.turn}</span>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        {details.weapons.slice(0, 4).map((u) => {
          const w = WEAPONS[u.weaponId];
          return (
            <div key={u.weaponId} style={{ background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <WeaponIcon icon={w.icon} color={w.color} size={40} />
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 700, fontSize: 14 }}>{w.name}</span><span className="mono" style={{ fontSize: 12, color: '#A9B3CC' }}>{u.shots} {u.shots === 1 ? 'shot' : 'shots'} · {u.damage.toLocaleString('en-US')} dmg</span></span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
