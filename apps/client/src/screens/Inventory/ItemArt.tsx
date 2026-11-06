// Item previews by type (Inventory.dc.html): machine/skin/avatar → MachineArt, weapon skin → WeaponIcon, trail →
// animated dashed arc, explosion → pulsing starburst, emote → speech bubble, title → nameplate.
import { MachineArt, WeaponIcon } from '../../components';
import type { Preview } from './model';
import s from './inventory.module.css';

const BURST = 'M60 6 L70 40 L104 22 L84 52 L116 64 L82 72 L98 104 L66 84 L56 116 L48 82 L16 100 L34 70 L4 58 L38 48 L22 18 L52 36 Z';

export function ItemArt({ preview, name, big = false, playerName = '' }: { preview: Preview; name: string; big?: boolean; playerName?: string }): JSX.Element {
  switch (preview.type) {
    case 'machine': {
      const art = <MachineArt kind={preview.kind} paint={preview.paint} tint="#F45B55" size={big ? 280 : 116} />;
      return big ? <div className={s.bob} style={{ position: 'relative' }}>{art}</div> : art;
    }
    case 'weapon': {
      const art = <WeaponIcon icon={preview.icon} color={preview.color} size={big ? 180 : 72} />;
      return big ? <div className={s.bob} style={{ position: 'relative' }}>{art}</div> : art;
    }
    case 'trail':
      return (
        <svg aria-hidden="true" width={big ? 320 : 140} height={big ? 200 : 80} viewBox="0 0 140 80" style={{ position: 'relative' }}>
          <path className={s.trail} d="M8 70 Q60 -10 132 40" fill="none" stroke={preview.color} strokeWidth={big ? 7 : 9} strokeLinecap="round" />
          <circle cx="132" cy="40" r={big ? 7 : 8} fill="#F5F1E8" stroke="#0B0F1A" strokeWidth={big ? 2.5 : 3} />
        </svg>
      );
    case 'explosion':
      return (
        <svg aria-hidden="true" width={big ? 220 : 96} height={big ? 220 : 96} viewBox="0 0 120 120" style={{ position: 'relative' }}>
          <path className={s.burst} d={BURST} fill={preview.color} stroke="#0B0F1A" strokeWidth={big ? 4 : 5} strokeLinejoin="round" />
          <circle cx="60" cy="62" r="16" fill="#F5F1E8" stroke="#0B0F1A" strokeWidth="3" />
        </svg>
      );
    case 'emote':
      return big
        ? <span className={`fd ${s.bob}`} style={{ position: 'relative', background: '#F5F1E8', color: '#101522', border: '4px solid #0B0F1A', borderRadius: '22px 22px 22px 4px', padding: '14px 22px', fontSize: 34, maxWidth: 300, textAlign: 'center', lineHeight: 1.1, boxShadow: '0 6px 0 #0B0F1A' }}>{preview.text}</span>
        : <span className="fd" style={{ background: '#F5F1E8', color: '#101522', border: '3px solid #0B0F1A', borderRadius: '14px 14px 14px 2px', padding: '6px 12px', fontSize: 18, maxWidth: 140, textAlign: 'center', lineHeight: 1.1 }}>{preview.text}</span>;
    case 'title':
      return big
        ? (
          <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="fd" style={{ fontSize: 30 }}>{playerName}</span>
            <span className="fd" style={{ background: '#101522', color: '#FFD166', border: '3px solid #FFD166', borderRadius: 8, padding: '6px 16px', fontSize: 24 }}>“{name}”</span>
          </span>
        )
        : <span className="fd" style={{ background: '#101522', color: '#FFD166', border: '3px solid #FFD166', borderRadius: 6, padding: '6px 10px', fontSize: 16, textAlign: 'center', lineHeight: 1.1, maxWidth: 150 }}>“{name}”</span>;
  }
}
