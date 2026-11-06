// Profile.dc.html "Identity" + "Equipped cosmetics" panels (left column).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COSMETIC_BY_ID, equip, rankFor, type LocalProfile } from '@lobbers/shared';
import { CloseButton, MachineArt, Modal } from '../../components';
import { useProfile } from '../../state/profile';
import { MACHINE_BG } from '../Inventory/model';
import { avatarKind, equippedRows, ownedTitles, xpBar } from './model';
import s from './profile.module.css';

const HEX = 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)';

function TitlePicker({ p, onClose }: { p: LocalProfile; onClose: () => void }): JSX.Element {
  const pick = (id: string): void => {
    const r = equip(p, 'title', id);
    if (r.ok) useProfile.getState().update(() => r.value);
    onClose();
  };
  return (
    <Modal label="Change title" onClose={onClose} style={{ width: 420, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 className="fd" style={{ margin: 0, fontSize: 28 }}>Change title</h2><CloseButton onClick={onClose} /></div>
      <span style={{ fontSize: 13, color: '#A9B3CC', fontWeight: 600 }}>Titles you own. Unlock more in the Inventory.</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto', padding: 2 }}>
        {ownedTitles(p).map((t) => (
          <button key={t.id} type="button" className={`btn ${s.titleOpt} ${p.equipped.title === t.id ? s.on : ''}`} aria-pressed={p.equipped.title === t.id} onClick={() => pick(t.id)}>“{t.name}”</button>
        ))}
      </div>
    </Modal>
  );
}

export function IdentityCard({ p }: { p: LocalProfile }): JSX.Element {
  const [picking, setPicking] = useState(false);
  const kind = avatarKind(p);
  const paint = p.equipped[`skin:${kind}`] ? COSMETIC_BY_ID[p.equipped[`skin:${kind}`]] : undefined;
  const rank = rankFor(p.rating);
  const xp = xpBar(p);
  const title = COSMETIC_BY_ID[p.equipped.title ?? '']?.name ?? 'Rookie';
  const since = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <>
      <section aria-label="Identity" className="panel" style={{ position: 'absolute', left: 24, top: 100, width: 420, height: 412, overflow: 'hidden', padding: 0 }}>
        <div className={s.stripes} style={{ height: 150, backgroundColor: MACHINE_BG[kind], borderBottom: '3px solid #0B0F1A' }} />
        <div style={{ position: 'absolute', left: 24, top: 46, width: 176, height: 176, background: '#0B0F1A', clipPath: HEX }}>
          <div style={{ position: 'absolute', left: 6, top: 6, width: 164, height: 164, background: '#2E3856', clipPath: HEX, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className={s.bob}><MachineArt kind={kind} paint={paint?.slot === 'skin' ? paint.paint : undefined} tint="#F45B55" size={140} /></div>
          </div>
        </div>
        <span className="fd" data-testid="profile-card-level" style={{ position: 'absolute', left: 84, top: 206, background: '#FFD166', color: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, padding: '0 10px', fontSize: 22, boxShadow: '0 3px 0 #0B0F1A' }}>{p.level}</span>
        <div style={{ position: 'absolute', left: 216, top: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <svg role="img" aria-label={`Rank ${rank.label}`} width="96" height="108" viewBox="0 0 96 108"><path d="M48 4 L88 18 V56 Q88 88 48 104 Q8 88 8 56 V18 Z" fill={rank.tier.color} stroke="#0B0F1A" strokeWidth="5" strokeLinejoin="round" /><path d="M48 16 L78 26 V56 Q78 80 48 92 Q18 80 18 56 V26 Z" fill={rank.tier.inner} /><path d="M30 50 L48 34 L66 50 M30 66 L48 50 L66 66" fill="none" stroke="#F5F1E8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="fd" data-testid="profile-rank" style={{ fontSize: 20, color: rank.tier.color, WebkitTextStroke: '3px #0B0F1A', paintOrder: 'stroke fill' }}>{rank.label}</span>
          <span className="mono" style={{ fontSize: 12, color: '#F5F1E8' }}>{p.rating.toLocaleString('en-US')} SR</span>
        </div>
        <div style={{ position: 'absolute', left: 24, top: 240, width: 372, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="fd" style={{ fontSize: 38, lineHeight: 1 }}>{p.name}</span>
          <span data-testid="profile-title" style={{ fontSize: 15, color: '#FFD166', fontWeight: 600 }}>“{title}” · Member since {since}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A9B3CC', marginTop: 6 }}><span>Level {p.level} → {p.level + 1}</span><span className="mono">{p.xp.toLocaleString('en-US')} / {xp.need.toLocaleString('en-US')} XP</span></div>
          <span style={{ height: 16, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 8, overflow: 'hidden', display: 'block' }}><span className={s.xp} style={{ display: 'block', height: '100%', width: `${xp.pct}%`, background: '#5ACB91' }} /></span>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" className="btn" onClick={() => setPicking(true)} style={{ height: 44, padding: '0 14px', fontSize: 14, flex: 1 }}>Change title</button>
            <Link to="/inventory" className="btn" style={{ height: 44, padding: '0 14px', fontSize: 14, flex: 1 }}>Customize</Link>
          </div>
        </div>
      </section>

      <section aria-label="Equipped cosmetics" className="panel" style={{ position: 'absolute', left: 24, top: 528, width: 420, height: 352, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700 }}>EQUIPPED COSMETICS</h2><Link to="/inventory" style={{ fontSize: 14, fontWeight: 600, color: '#FFD166' }}>Change</Link></div>
        {equippedRows(p).map((e) => (
          <div key={e.slot} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '6px 10px', height: 54 }}>
            <span style={{ width: 44, height: 38, flex: 'none', borderRadius: 8, background: '#0E1320', border: `2px solid ${e.rarityColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg aria-hidden="true" width="28" height="24" viewBox="0 0 28 24"><path d={e.icon} fill="none" stroke={e.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#A9B3CC' }}>{e.slot}</span><span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span></span>
            <span style={{ fontSize: 11, fontWeight: 700, color: e.rarityColor }}>{e.rarity.toUpperCase()}</span>
          </div>
        ))}
      </section>
      {picking && <TitlePicker p={p} onClose={() => setPicking(false)} />}
    </>
  );
}
