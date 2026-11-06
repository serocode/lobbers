// Inventory — ported from design/mockup/Inventory.dc.html (screenshots/07-*.png). Reads and writes the local
// profile (owned / equipped / coins / gems); equipped items travel in your `hello` profile to every match.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stage } from '../../app/Stage';
import { useLobby } from '../../net/p2p/roomService';
import { useProfile } from '../../state/profile';
import { FirstRunModal } from '../Home/modals/FirstRunModal';
import { ItemArt } from './ItemArt';
import { actOn, inventory, RARITY_COLOR } from './model';
import { PreviewPane } from './PreviewPane';
import s from './inventory.module.css';

const FILTERS = ['All', 'Owned', 'Locked'] as const;
type Filter = (typeof FILTERS)[number];

const Coin = (): JSX.Element => <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#FFD166" stroke="#0B0F1A" strokeWidth="2.5" /></svg>;
const Gem = (): JSX.Element => <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20"><path d="M10 2 18 8 10 18 2 8Z" fill="#B07CF2" stroke="#0B0F1A" strokeWidth="2.5" strokeLinejoin="round" /></svg>;

export default function InventoryScreen(): JSX.Element {
  const profile = useProfile((v) => v.profile);
  const room = useLobby((v) => (v.view?.phase === 'open' ? v.view.code : null));
  const needsName = useProfile((v) => v.status === 'needsName');
  const [cat, setCat] = useState(() => { const q = new URLSearchParams(location.search).get('cat'); return q ? Math.max(0, Math.min(7, Number(q) || 0)) : 1; });
  const [filter, setFilter] = useState<Filter>('All');
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2200); return () => clearTimeout(t); }, [msg]);
  const cats = useMemo(() => (profile ? inventory(profile) : []), [profile]);

  if (!profile) return <Stage width={1440} height={900} label="Inventory"><div className={s.bg} style={{ width: 1440, height: 900 }}>{needsName && <FirstRunModal />}</div></Stage>;

  const C = cats[cat];
  const list = C.items.filter((it) => filter === 'All' || (filter === 'Owned' ? it.owned : !it.owned));
  const item = C.items.find((it) => it.id === sel) ?? list[0] ?? C.items[0];
  const all = cats.flatMap((c) => c.items);
  const totOwned = all.filter((x) => x.owned).length, catOwned = C.items.filter((x) => x.owned).length;
  const apply = (cmd: Parameters<typeof actOn>[2]): void => {
    const r = actOn(profile, item, cmd);
    if (!r.ok) { setMsg({ text: r.reason, ok: false }); return; }
    useProfile.getState().update(() => r.value.profile);
    setMsg({ text: r.value.message, ok: true });
  };

  return (
    <Stage width={1440} height={900} label="Inventory">
      <div className={s.bg} style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <header style={{ position: 'absolute', left: 24, top: 20, width: 1392, height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to={room ? `/lobby/${room}` : '/'} className="btn" style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>{room ? 'Lobby' : 'Home'}</Link>
          <h1 className="fd" style={{ margin: 0, fontSize: 40 }}>INVENTORY</h1>
          <div style={{ flex: 1 }} />
          <span className="mono" role="status" style={{ fontSize: 14, color: msg?.ok === false ? '#F45B55' : '#5ACB91', fontWeight: 700 }}>{msg?.text ?? ''}</span>
          <div className="panel" style={{ height: 52, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Coin /><span className="mono" data-testid="inv-coins" style={{ fontSize: 17, fontWeight: 700 }}>{profile.coins.toLocaleString('en-US')}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gem /><span className="mono" data-testid="inv-gems" style={{ fontSize: 17, fontWeight: 700 }}>{profile.gems.toLocaleString('en-US')}</span></span>
          </div>
        </header>

        <nav aria-label="Categories" className="panel" style={{ position: 'absolute', left: 24, top: 100, width: 252, height: 780, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cats.map((c, i) => (
            <button key={c.name} type="button" className={`btn ${s.cat} ${cat === i ? s.on : ''}`} aria-pressed={cat === i} onClick={() => { setCat(i); setFilter('All'); setSel(null); }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
              <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
              <span className="mono" style={{ fontSize: 12, opacity: 0.8 }}>{c.items.filter((x) => x.owned).length}/{c.items.length}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#A9B3CC' }}><span>TOTAL COLLECTION</span><span className="mono" data-testid="inv-total">{totOwned} / {all.length}</span></span>
            <span style={{ height: 12, borderRadius: 6, background: '#1C2338', overflow: 'hidden', display: 'block' }}><span className={s.prog} style={{ display: 'block', height: '100%', width: `${Math.round((totOwned / all.length) * 100)}%`, background: '#FFD166' }} /></span>
          </div>
        </nav>

        <section aria-label="Items" style={{ position: 'absolute', left: 296, top: 100, width: 716, height: 780, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 className="fd" style={{ margin: 0, fontSize: 34, lineHeight: 1 }}>{C.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, height: 12, border: '2px solid #0B0F1A', borderRadius: 6, background: '#0E1320', overflow: 'hidden', display: 'block' }}><span className={s.prog} style={{ display: 'block', height: '100%', width: `${Math.round((catOwned / C.items.length) * 100)}%`, background: '#5ACB91' }} /></span>
                <span className="mono" style={{ fontSize: 13, color: '#C9D1E0' }}>{catOwned} / {C.items.length} collected</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map((f) => <button key={f} type="button" className={`btn ${s.chip} ${filter === f ? s.on : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
          </div>
          <div className={s.grid}>
            {list.map((it) => {
              const rc = RARITY_COLOR[it.rarity];
              const state = it.equipped ? 'Equipped' : it.owned ? 'Owned' : 'Locked';
              return (
                <button key={it.id} type="button" className={`btn ${s.item} ${item.id === it.id ? s.on : ''}`} aria-pressed={item.id === it.id} aria-label={`${it.name}, ${it.rarity}${it.owned ? '' : ', locked'}`} onClick={() => setSel(it.id)}>
                  <div className={s.stripes} style={{ height: 118, backgroundColor: it.bg, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '3px solid #0B0F1A', filter: it.owned ? 'none' : 'grayscale(.8) brightness(.6)' }}>
                    <ItemArt preview={it.preview} name={it.name} />
                    {it.equipped && <span className="fd" style={{ position: 'absolute', left: 6, top: 6, background: '#5ACB91', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 5, padding: '0 6px', fontSize: 12 }}>EQUIPPED</span>}
                  </div>
                  {!it.owned && (
                    <span style={{ position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 8, background: '#101522', border: '2px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg aria-label="Locked" role="img" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F1E8" strokeWidth="3" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" fill="#F5F1E8" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    </span>
                  )}
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: rc, border: '2px solid #0B0F1A' }} /><span style={{ color: rc }}>{it.rarity}</span>
                      <span style={{ color: '#A9B3CC', marginLeft: 'auto', fontWeight: 600 }}>{state}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside aria-label="Item preview" className="panel" style={{ position: 'absolute', left: 1028, top: 100, width: 388, height: 780, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <PreviewPane key={item.id} item={item} category={C.name} profile={profile} onMain={(emoteSlot) => apply({ t: 'main', emoteSlot })} onUnequip={() => apply({ t: 'unequip' })} />
        </aside>
      </div>
    </Stage>
  );
}
