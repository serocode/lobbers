// Lost connection → full-screen scrim card (DESIGN_SPEC §3.8): radar sweep from Quick Match,
// countdown to the end of the reconnect window, "Leave match".
import { useEffect, useState } from 'react';
import { Button, Panel } from '../../components';
import { mmss } from '../../state/format';
import type { LinkStatus } from '../../net/online/NetMatchController';

export function ReconnectScrim({ status, deadline, onLeave }: { status: LinkStatus; deadline: number; onLeave: () => void }): JSX.Element | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  if (status === 'connected') return null;
  const lost = status === 'lost';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,20,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} role="alertdialog" aria-label={lost ? 'Connection lost' : 'Reconnecting'}>
      <Panel style={{ width: 420, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 140, height: 140, borderRadius: '50%', border: '4px solid #0B0F1A', background: '#0E1320', overflow: 'hidden' }}>
          {!lost && <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 0deg,rgba(76,154,255,.55),rgba(76,154,255,0) 25%)', animation: 'spin 1.6s linear infinite' }} />}
          <svg aria-hidden="true" width="132" height="132" viewBox="0 0 172 172" style={{ position: 'absolute', inset: 0 }}><circle cx="86" cy="86" r="30" fill="none" stroke="#2A3045" strokeWidth="2" /><circle cx="86" cy="86" r="60" fill="none" stroke="#2A3045" strokeWidth="2" /><circle cx="86" cy="86" r="8" fill={lost ? '#F45B55' : '#FFD166'} /></svg>
        </div>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>{lost ? 'Connection lost' : 'Reconnecting…'}</h2>
        <span style={{ color: '#C9D1E0', fontWeight: 600 }}>{lost ? 'Your seat was released. The match continues without you.' : <>Your seat is held for <span className="mono" style={{ color: '#FFD166' }}>{mmss(deadline - now)}</span></>}</span>
        <Button variant={lost ? 'primary' : 'default'} onClick={onLeave} style={{ height: 52, padding: '0 24px', fontSize: 17 }}>{lost ? 'Return home' : 'Leave match'}</Button>
      </Panel>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
