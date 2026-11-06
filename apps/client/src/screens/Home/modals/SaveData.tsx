// "Save data" (DESIGN_SPEC §3.9): Export save (code + Copy), Import save (paste → importProfile → confirm),
// Reset progress (confirm). Also used by the first-run modal's "I have a save code".
import { useState } from 'react';
import { exportProfile, importProfile, type LocalProfile } from '@lobbers/shared';
import { Button, ErrorRow } from '../../../components';
import { connectionLabel } from '../../../net/p2p/peerjs';
import { useProfile } from '../../../state/profile';

type View = 'menu' | 'export' | 'import' | 'reset';
const area = { width: '100%', height: 96, resize: 'none', border: '3px solid #0B0F1A', borderRadius: 10, background: '#0E1320', color: '#F5F1E8', padding: 10, fontSize: 12, wordBreak: 'break-all' } as const;
const row = { display: 'flex', gap: 10, alignItems: 'center' } as const;

/** Paste a save code → confirm → replace this device's profile. */
export function ImportSave({ onDone, onCancel, confirmReplace }: { onDone: () => void; onCancel: () => void; confirmReplace: boolean }): JSX.Element {
  const replace = useProfile((v) => v.replace);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<LocalProfile | null>(null);
  const check = (): void => {
    const r = importProfile(code);
    if (!r.ok) { setError(`That code didn't work: ${r.reason}`); return; }
    if (confirmReplace) setPending(r.value); else { replace(r.value); onDone(); }
  };
  if (pending) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontWeight: 700 }}>Replace this device's progress with {pending.name} (LV {pending.level})?</span>
        <div style={row}><Button variant="danger" onClick={() => { replace(pending); onDone(); }} style={{ height: 44, padding: '0 16px' }}>Replace</Button><Button onClick={() => setPending(null)} style={{ height: 44, padding: '0 16px' }}>Cancel</Button></div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="import-code" style={{ fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Paste your save code</label>
      <textarea id="import-code" className="mono" style={area} value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} placeholder="LOBBERS1:…" />
      {error && <ErrorRow>{error}</ErrorRow>}
      <div style={row}><Button variant="primary" disabled={!code.trim()} onClick={check} style={{ height: 44, padding: '0 16px' }}>Import save</Button><Button onClick={onCancel} style={{ height: 44, padding: '0 16px' }}>Cancel</Button></div>
    </div>
  );
}

export function SaveData(): JSX.Element {
  const profile = useProfile((v) => v.profile);
  const reset = useProfile((v) => v.reset);
  const [view, setView] = useState<View>('menu');
  const [copied, setCopied] = useState(false);
  const code = profile ? exportProfile(profile) : '';
  const copy = (): void => { navigator.clipboard.writeText(code).then(() => setCopied(true), () => setCopied(false)); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Save data</span>
        <span className="mono" data-testid="connection-mode" style={{ fontSize: 12, color: '#A9B3CC' }}>Connection: {connectionLabel()}</span>
      </div>
      {view === 'menu' && (
        <div style={row}>
          <Button onClick={() => setView('export')} disabled={!profile} style={{ height: 40, padding: '0 14px', fontSize: 14 }}>Export save</Button>
          <Button onClick={() => setView('import')} style={{ height: 40, padding: '0 14px', fontSize: 14 }}>Import save</Button>
          <span style={{ flex: 1 }} />
          <Button variant="danger" onClick={() => setView('reset')} disabled={!profile} style={{ height: 40, padding: '0 14px', fontSize: 14, color: '#F45B55' }}>Reset progress</Button>
        </div>
      )}
      {view === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#A9B3CC' }}>Keep this code somewhere safe, or paste it into Import save on another device.</span>
          <textarea readOnly className="mono" aria-label="Save code" style={area} value={code} onFocus={(e) => e.currentTarget.select()} />
          <div style={row}><Button variant="primary" onClick={copy} style={{ height: 40, padding: '0 14px' }}>{copied ? 'Copied' : 'Copy'}</Button><Button onClick={() => setView('menu')} style={{ height: 40, padding: '0 14px' }}>Done</Button></div>
        </div>
      )}
      {view === 'import' && <ImportSave confirmReplace={!!profile} onDone={() => setView('menu')} onCancel={() => setView('menu')} />}
      {view === 'reset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontWeight: 700 }}>Reset all progress on this device? Level, coins, items and history are deleted.</span>
          <div style={row}><Button variant="danger" onClick={() => { reset(); setView('menu'); }} style={{ height: 40, padding: '0 14px', color: '#F45B55' }}>Reset progress</Button><Button onClick={() => setView('menu')} style={{ height: 40, padding: '0 14px' }}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}
