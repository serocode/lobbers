// Inventory.dc.html "Item preview" aside: big art, rarity + category, name, description, source line, action button.
// Additions (DESIGN_SPEC §2.7): "Unequip" secondary button; for emotes, a wheel-slot picker (4 slots).
import { useState } from 'react';
import { COSMETIC_BY_ID, EMOTE_SLOTS, emoteSlot, type LocalProfile } from '@lobbers/shared';
import { ItemArt } from './ItemArt';
import { RARITY_COLOR, defaultEmoteSlot, type InvItem } from './model';
import s from './inventory.module.css';

function actionLabel(it: InvItem): { label: string; bg: string; disabled: boolean } {
  const a = it.action;
  switch (a.kind) {
    case 'equipped': return { label: 'EQUIPPED', bg: '#5ACB91', disabled: true };
    case 'equip': return { label: 'EQUIP', bg: '#FFD166', disabled: false };
    case 'buy': return a.afford
      ? { label: `UNLOCK · ${a.price.toLocaleString('en-US')} ${a.currency.toUpperCase()}`, bg: '#4C9AFF', disabled: false }
      : { label: `NOT ENOUGH ${a.currency.toUpperCase()}`, bg: '#4C9AFF', disabled: true };
    case 'unlock': return { label: 'UNLOCK', bg: '#4C9AFF', disabled: false };
    case 'locked': return { label: 'LOCKED', bg: '#5B6378', disabled: true };
  }
}

export interface PreviewProps {
  item: InvItem; category: string; profile: LocalProfile;
  onMain: (emoteSlot?: string) => void; onUnequip: () => void;
}

export function PreviewPane({ item, category, profile, onMain, onUnequip }: PreviewProps): JSX.Element {
  const [slot, setSlot] = useState<string | null>(null);
  const isEmote = item.preview.type === 'emote';
  const pickedSlot = slot ?? (item.equipped ? item.slot : defaultEmoteSlot(profile));
  const act = actionLabel(item);
  const rc = RARITY_COLOR[item.rarity];
  const emoteAction = isEmote && item.owned && item.slot !== pickedSlot ? { label: `EQUIP · SLOT ${pickedSlot.split(':')[1]}`, bg: '#FFD166', disabled: false } : null;
  const main = emoteAction ?? act;
  return (
    <div key={item.id} className={s.enter} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className={s.stripes} style={{ height: 300, flex: 'none', backgroundColor: item.bg, borderBottom: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg aria-hidden="true" width="382" height="300" viewBox="0 0 382 300" style={{ position: 'absolute', inset: 0 }}><ellipse cx="191" cy="250" rx="140" ry="20" fill="#0B0F1A" opacity=".45" /><circle cx="191" cy="150" r="118" fill="none" stroke={rc} strokeWidth="4" strokeDasharray="3 14" opacity=".7" /></svg>
        <ItemArt preview={item.preview} name={item.name} big playerName={profile.name} />
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="fd" style={{ background: rc, color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '1px 10px', fontSize: 15 }}>{item.rarity.toUpperCase()}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>{category}</span>
        </div>
        <h2 className="fd" style={{ margin: 0, fontSize: 34, lineHeight: 1 }}>{item.name}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: '#C9D1E0' }}>{item.description}</p>
        <div data-testid="item-source" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '8px 10px' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A9B3CC" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></svg>
          <span style={{ color: '#C9D1E0' }}>{item.source}</span>
        </div>
        <div style={{ flex: 1 }} />
        {isEmote && item.owned && (
          <div role="group" aria-label="Emote wheel slot" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A9B3CC' }}>EMOTE WHEEL SLOT</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: EMOTE_SLOTS }, (_, i) => emoteSlot(i)).map((k, i) => {
                const cur = COSMETIC_BY_ID[profile.equipped[k] ?? ''];
                return (
                  <button key={k} type="button" className={`btn ${s.slot} ${pickedSlot === k ? s.on : ''}`} aria-pressed={pickedSlot === k} onClick={() => setSlot(k)} title={cur?.name}>
                    <span className="mono">{i + 1}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur?.slot === 'emote' ? cur.text : '—'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {item.canUnequip && <button type="button" className="btn" onClick={onUnequip} style={{ height: 60, padding: '0 16px', fontSize: 16 }}>Unequip</button>}
          <button type="button" className="btn dark" data-testid="item-action" disabled={main.disabled} onClick={() => onMain(isEmote ? pickedSlot : undefined)} style={{ height: 60, fontSize: 22, background: main.bg, flex: 1 }}><span className="fd">{main.label}</span></button>
        </div>
      </div>
    </div>
  );
}
