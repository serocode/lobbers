// Emote wheel (Phase 3 addition, mockup speech-bubble style from Inventory.dc.html): your 4 equipped
// emotes around the field centre. T toggles, 1–4 or click sends, Esc closes. Shows as a bubble over
// your machine for everyone; the server rate-limits.
import { COSMETIC_BY_ID, DEFAULT_LOADOUT } from '@lobbers/shared';
import { EmoteIcon } from '../components';
import { LAYOUTS, type LayoutId } from '../game/layouts';
import { useBattleUi } from '../state/uiStores';
import { useBattle, useDeckUnit, useMatch } from './BattleContext';

const POS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];

/** The bubble button that opens the wheel (sits with Focus / Overview). */
export function EmoteButton({ size = 46, style }: { size?: number; style?: React.CSSProperties }): JSX.Element {
  const open = useBattleUi((u) => u.emoteOpen);
  return (
    <button type="button" className="btn" onClick={() => useBattleUi.getState().set({ emoteOpen: !open })} aria-pressed={open} aria-label="Emotes (T)" title="Emotes (T)"
      style={{ width: size, height: size, padding: 0, ...(open ? { background: '#FFD166', color: '#101522' } : {}), ...style }}><EmoteIcon size={Math.round(size * 0.5)} /></button>
  );
}

export function useEmotes(): string[] {
  const u = useDeckUnit();
  return useMatch((v) => (u ? v.cosmetics[u.id]?.emotes.join(',') : '') ?? '').split(',').filter(Boolean);
}

export function EmoteWheel({ layout }: { layout: LayoutId }): JSX.Element | null {
  const { controls } = useBattle();
  const open = useBattleUi((u) => u.emoteOpen);
  const emotes = useEmotes();
  if (!open) return null;
  const list = emotes.length ? emotes : DEFAULT_LOADOUT.emotes;
  const f = LAYOUTS[layout].field;
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  const R = layout === 'phone' ? 92 : 128;
  const close = (): void => useBattleUi.getState().set({ emoteOpen: false });
  return (
    <div role="dialog" aria-label="Emotes" style={{ position: 'absolute', inset: 0, zIndex: 30 }} onClick={close}>
      {list.slice(0, 4).map((id, i) => {
        const item = COSMETIC_BY_ID[id];
        const text = item?.slot === 'emote' ? item.text : id;
        return (
          <button key={id} type="button" className="fd" onClick={(e) => { e.stopPropagation(); controls.emote(i); close(); }}
            style={{ position: 'absolute', left: cx + POS[i].dx * R, top: cy + POS[i].dy * R * 0.62, transform: 'translate(-50%,-50%)', background: '#F5F1E8', color: '#101522', border: '3px solid #0B0F1A', borderRadius: '14px 14px 14px 2px', boxShadow: '0 5px 0 #0B0F1A', padding: '6px 12px', fontSize: layout === 'phone' ? 15 : 18, maxWidth: 160, lineHeight: 1.1, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11, color: '#5B6378' }}>{i + 1}</span>{text}
          </button>
        );
      })}
    </div>
  );
}
