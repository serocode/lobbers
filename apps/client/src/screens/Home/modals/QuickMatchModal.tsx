// Quick Match / Play Now (Main.dc.html "Quick match" dialog): really joins the matchmaker — fills an
// open public room or creates one — and shows that room filling up. Cancel leaves the room.
import { useEffect, useRef, useState } from 'react';
import { MAPS } from '@lobbers/shared';
import { Button, ErrorRow, Modal } from '../../../components';
import { lobbyService, useLobby } from '../../../net/online/lobbyService';
import s from '../home.module.css';

const MODE_NAME = { 'team-deathmatch': 'Team Deathmatch', 'capture-the-hill': 'Capture the Hill' } as const;

export function QuickMatchModal({ ranked, onClose, onEnter }: { ranked: boolean; onClose: () => void; onEnter: (code: string) => void }): JSX.Element {
  const view = useLobby((v) => v.view);
  const status = useLobby((v) => v.status);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const entered = useRef(false);

  useEffect(() => {
    let alive = true;
    lobbyService.quick(ranked).then((c) => { if (alive) setCode(c); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => { alive = false; clearInterval(t); };
  }, [ranked]);

  const cancel = (): void => { if (!entered.current) void lobbyService.leave(); onClose(); };
  const found = !!code && status === 'open' && !!view;
  const n = view?.players.length ?? 0;
  const sec = Math.floor((now - t0) / 1000);
  const me = view?.players.find((p) => p.id === lobbyService.myId);
  const info = found && view
    ? `${MODE_NAME[view.settings.mode]} · ${MAPS[view.settings.mapId].name} · ${n} / 8 players${me?.ping ? ` · ping ${me.ping} ms` : ''}`
    : `${n} / 8 players · elapsed ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const slots = Array.from({ length: 8 }, (_, i) => (i < n ? (i % 2 ? '#4C9AFF' : '#F45B55') : '#232B42'));

  return (
    <Modal label={ranked ? 'Play now' : 'Quick match'} onClose={cancel} closeOnScrim={false} style={{ width: 520, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 180, height: 180, borderRadius: '50%', border: '4px solid #0B0F1A', background: '#0E1320', overflow: 'hidden' }}>
        <div className={s.radar} style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 0deg,rgba(76,154,255,.55),rgba(76,154,255,0) 25%)' }} />
        <svg aria-hidden="true" width="172" height="172" viewBox="0 0 172 172" style={{ position: 'absolute', inset: 0 }}><circle cx="86" cy="86" r="30" fill="none" stroke="#2A3045" strokeWidth="2" /><circle cx="86" cy="86" r="60" fill="none" stroke="#2A3045" strokeWidth="2" /><circle cx="86" cy="86" r="8" fill="#FFD166" /></svg>
      </div>
      {found
        ? <h2 className={`fd ${s.enter}`} style={{ margin: 0, fontSize: 40, color: '#5ACB91' }}>MATCH FOUND!</h2>
        : <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Finding lobbers<span className={s.dotp}>…</span></h2>}
      <div style={{ display: 'flex', gap: 8 }}>
        {slots.map((bg, i) => <span key={i} style={{ width: 40, height: 40, borderRadius: 8, border: '3px solid #0B0F1A', background: bg, transition: 'background .3s' }} />)}
      </div>
      <div className="mono" style={{ fontSize: 15, color: '#A9B3CC' }}>{ranked ? `Ranked 4v4 · ${info}` : info}</div>
      {error && <div style={{ width: '100%', textAlign: 'left' }}><ErrorRow>{error}</ErrorRow></div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button onClick={cancel} style={{ height: 52, padding: '0 22px', fontSize: 16 }}>Cancel</Button>
        {found && <Button variant="primary" onClick={() => { entered.current = true; onEnter(code); }} style={{ height: 52, padding: '0 26px', fontSize: 18 }}>Enter Lobby</Button>}
      </div>
    </Modal>
  );
}
