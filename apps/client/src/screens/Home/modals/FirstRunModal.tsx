// First-run name & guest account (DESIGN_SPEC §3.7), in the Create Room modal style:
// "Pick your lobber name" (3–16 letters/digits/._), starter machine pick, LET'S LOB.
import { useState } from 'react';
import { MACHINES, STARTER_MACHINES, type MachineId } from '@lobbers/shared';
import { Button, ErrorRow, MachineArt, Modal } from '../../../components';
import { useProfile } from '../../../state/profile';
import s from '../home.module.css';
import { ImportSave } from './SaveData';

const NAME_RE = /^[A-Za-z0-9._]{3,16}$/;

export function FirstRunModal(): JSX.Element {
  const createProfile = useProfile((v) => v.create);
  const [name, setName] = useState('');
  const [machine, setMachine] = useState<MachineId>(STARTER_MACHINES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const ok = NAME_RE.test(name.trim());

  const go = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try { createProfile(name.trim(), machine); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <Modal label="Pick your lobber name" style={{ width: 720, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Pick your lobber name</h2>
      {importing && <ImportSave confirmReplace={false} onDone={() => setImporting(false)} onCancel={() => setImporting(false)} />}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Name
        <input className={s.inp} value={name} maxLength={16} autoComplete="nickname" placeholder="Kaboomerang" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok && !busy) void go(); }} />
        <span style={{ fontWeight: 500, fontSize: 12, color: name && !ok ? '#F45B55' : '#A9B3CC' }}>3–16 letters, digits, dots or underscores</span>
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Starter machine</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 }}>
          {STARTER_MACHINES.map((id) => {
            const m = MACHINES[id];
            return (
              <button key={id} type="button" className={`btn ${s.mapc} ${machine === id ? s.on : ''}`} aria-pressed={machine === id} onClick={() => setMachine(id)}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 92, background: m.cardBg, borderBottom: '3px solid #0B0F1A' }}><MachineArt kind={id} tint="#F45B55" size={100} aim={28} /></span>
                <span style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', gap: 2 }}><span style={{ fontSize: 16 }}>{m.name}</span><span style={{ fontSize: 12, color: '#A9B3CC', fontWeight: 500 }}>{m.role}</span></span>
              </button>
            );
          })}
        </div>
      </div>
      {error && <ErrorRow>{error}</ErrorRow>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: '#A9B3CC', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 4 }}>Your progress is saved in this browser. Export it from Settings to move devices.
          <button type="button" onClick={() => setImporting(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#FFD166', fontWeight: 600, fontSize: 13, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}>I have a save code</button></span>
        <Button variant="primary" onClick={() => void go()} disabled={!ok || busy} style={{ height: 56, padding: '0 30px', fontSize: 20 }}><span className="fd">{busy ? 'ONE SEC…' : "LET'S LOB"}</span></Button>
      </div>
    </Modal>
  );
}
