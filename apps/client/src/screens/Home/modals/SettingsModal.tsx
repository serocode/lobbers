// Settings (Main.dc.html): volumes, shake, trajectory preview, damage numbers, graphics quality.
// Saved in the local profile; the battlefield and sound read the same store. Plus Save data (§3.9).
import { CloseButton, Modal } from '../../../components';
import { useSettings, type GraphicsQuality } from '../../../state/uiStores';
import s from '../home.module.css';
import { SaveData } from './SaveData';

const GFX: Array<{ id: GraphicsQuality; label: string }> = [{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }];
const row = { display: 'grid', gridTemplateColumns: '140px 1fr 44px', alignItems: 'center', gap: 12, fontWeight: 600 } as const;
const sw = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 } as const;
const key = { color: '#F5F1E8' } as const;

export function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const st = useSettings();
  const slider = (label: string, k: 'masterVolume' | 'musicVolume' | 'sfxVolume'): JSX.Element => (
    <label style={row}>{label}<input className={s.range} type="range" min={0} max={100} value={st[k]} onChange={(e) => st.set({ [k]: Number(e.target.value) })} /><span className="mono">{st[k]}</span></label>
  );
  const toggle = (label: string, k: 'screenShake' | 'trajectoryPreview' | 'damageNumbers'): JSX.Element => (
    <label style={sw}>{label}<span className="sw"><input type="checkbox" checked={st[k]} onChange={() => st.set({ [k]: !st[k] })} /><span /></span></label>
  );
  return (
    <Modal label="Settings" onClose={onClose} style={{ width: 600, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Settings</h2>
        <CloseButton onClick={onClose} />
      </div>
      {slider('Master volume', 'masterVolume')}
      {slider('Music', 'musicVolume')}
      {slider('Effects', 'sfxVolume')}
      {toggle('Screen shake on impacts', 'screenShake')}
      {toggle('Trajectory preview line', 'trajectoryPreview')}
      {toggle('Floating damage numbers', 'damageNumbers')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Graphics quality</span>
        <div style={{ display: 'flex', gap: 10 }}>{GFX.map((g) => <button key={g.id} type="button" className={`btn seg ${st.graphics === g.id ? 'on' : ''}`} aria-pressed={st.graphics === g.id} onClick={() => st.set({ graphics: g.id })}>{g.label}</button>)}</div>
      </div>
      <SaveData />
      <div style={{ fontSize: 13, color: '#A9B3CC', background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
        <span className="mono" style={key}>↑ ↓</span> angle · <span className="mono" style={key}>← →</span> move · <span className="mono" style={key}>Q / E</span> power · <span className="mono" style={key}>Space</span> fire · <span className="mono" style={key}>W</span> armory
      </div>
    </Modal>
  );
}
