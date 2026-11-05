// Selected machine detail (Machines.dc.html section): stage, stats, first 3 weapons, Special + Ultimate.
import { MACHINES, WEAPONS, type MachineId } from '@lobbers/shared';
import { CrownIcon, MachineArt, WeaponIcon } from '../../components';
import s from './machines.module.css';

export function damageText(id: keyof typeof WEAPONS): string {
  const b = WEAPONS[id].behavior;
  return b.kind === 'cluster' ? `${b.count}×${b.childDamage}` : b.kind === 'airstrike' ? `${b.bombs}×${b.bombDamage}` : String(WEAPONS[id].damage);
}

export function DetailPanel({ id, locked }: { id: MachineId; locked: boolean }): JSX.Element {
  const m = MACHINES[id];
  const stats = [
    { k: 'HEALTH', v: m.maxHp, p: m.stats.health * 10, c: '#5ACB91' }, { k: 'ATTACK', v: m.stats.attack, p: m.stats.attack * 10, c: '#F45B55' },
    { k: 'DEFENSE', v: m.stats.defense, p: m.stats.defense * 10, c: '#4C9AFF' }, { k: 'MOBILITY', v: m.stats.mobility, p: m.stats.mobility * 10, c: '#FFD166' },
  ];
  const cd = m.special.cooldownTurns ?? 0;
  return (
    <section aria-label="Selected machine" className="panel" style={{ position: 'absolute', left: 872, top: 108, width: 544, height: 668, overflow: 'hidden', padding: 0 }}>
      <div key={id} style={{ position: 'absolute', inset: 0 }}>
        <div className={s.stripes} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 318, backgroundColor: m.cardBg }} />
        <svg aria-hidden="true" width="538" height="318" viewBox="0 0 538 318" style={{ position: 'absolute', left: 0, top: 0 }}>
          <path d="M210 0 L328 0 L470 318 L68 318 Z" fill="#fff" opacity=".08" />
          <g className={s.spinr} style={{ transformBox: 'fill-box' }}><circle cx="269" cy="160" r="130" fill="none" stroke={m.color} strokeWidth="5" strokeDasharray="4 18" opacity=".7" /></g>
          <ellipse cx="269" cy="292" rx="190" ry="24" fill="#0B0F1A" opacity=".55" />
          <ellipse cx="269" cy="282" rx="176" ry="22" fill="#2E3856" stroke="#0B0F1A" strokeWidth="4" />
          <ellipse cx="269" cy="280" rx="130" ry="13" fill="none" stroke={m.color} strokeWidth="4" />
        </svg>
        <div className={s.drop} style={{ position: 'absolute', left: 89, top: -4 }}><div className={s.bob}><MachineArt kind={id} tint="#F45B55" size={360} aim={34} /></div></div>
        <div className={s.flash} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 318, background: '#fff' }} />
        {locked && <span className={`fd ${s.stamp}`} style={{ position: 'absolute', right: 18, top: 18, fontSize: 30, color: '#5ACB91', border: '5px solid #5ACB91', borderRadius: 10, padding: '2px 14px', background: 'rgba(16,21,34,.85)' }}>LOCKED IN</span>}
        <div className={s.enter} style={{ position: 'absolute', left: 0, top: 318, width: '100%', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '4px solid #0B0F1A' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: m.color }}>{m.role.toUpperCase()}</span>
              <h2 className="fd" style={{ margin: 0, fontSize: 52, lineHeight: 0.95 }}>{m.name}</h2>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: '#C9D1E0', maxWidth: 270 }}>{m.description}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px 20px' }}>
            {stats.map((st) => (
              <div key={st.k} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 30px', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1 }}>{st.k}</span>
                <span style={{ height: 14, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 7, overflow: 'hidden', display: 'block' }}><span className={s.grow} style={{ display: 'block', height: '100%', width: `${st.p}%`, background: st.c }} /></span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{st.v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {m.loadout.slice(0, 3).map((w) => (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '6px 8px' }}>
                <WeaponIcon icon={WEAPONS[w].icon} color={WEAPONS[w].color} size={36} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{WEAPONS[w].name}</span><span className="mono" style={{ fontSize: 11, color: '#A9B3CC' }}>{damageText(w)} dmg</span></span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', background: '#241F14', border: '3px solid #FFD166', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 12px' }}>
              <span style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: '#FFD166', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#101522"><path d="M12 2l2.8 6.6L22 9.3l-5.4 4.8L18 21l-6-3.6L6 21l1.4-6.9L2 9.3l7.2-.7z" /></svg></span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#FFD166' }}>SPECIAL · {cd} TURN COOLDOWN</span><span style={{ fontSize: 13, color: '#C9D1E0' }}><b style={{ color: '#F5F1E8', fontSize: 15 }}>{m.special.name}</b> — {m.special.description}</span></span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 12px', background: '#241A33', borderTop: '3px solid #B07CF2' }}>
              <span style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: '#B07CF2', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CrownIcon size={20} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#B07CF2' }}>ULTIMATE · {m.ultimate.chargeCost ?? 100}% CHARGE</span><span style={{ fontSize: 13, color: '#C9D1E0' }}><b style={{ color: '#F5F1E8', fontSize: 15 }}>{m.ultimate.name}</b> — {m.ultimate.description}</span></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
