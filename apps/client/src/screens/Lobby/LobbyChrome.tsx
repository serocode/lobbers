// Lobby header and footer (Lobby.dc.html <header> / <footer>).
import { Link } from 'react-router-dom';
import type { LobbyView } from '@lobbers/shared';
import { Button } from '../../components';
import { lobbyService, useLobby } from '../../net/p2p/roomService';
import type { LobbyDerived } from './useLobbyView';

const Copy = ({ size }: { size: number }): JSX.Element => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V4H3v13h5" /></svg>;
const MODE = { 'team-deathmatch': 'Team Deathmatch', 'capture-the-hill': 'Capture the Hill' } as const;

export function LobbyHeader({ d, copied, onCopy, onLeave }: { d: LobbyDerived; copied: boolean; onCopy: () => void; onLeave: () => void }): JSX.Element {
  const v: LobbyView = d.view;
  const host = v.players.find((p) => p.id === v.hostId);
  const hosting = useLobby((x) => x.hosting);
  const rtt = useLobby((x) => x.rtt);
  return (
    <header style={{ position: 'absolute', left: 24, top: 20, width: 1392, height: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
      <button type="button" className="btn" onClick={onLeave} style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Leave</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h1 className="fd" style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>{v.name}</h1>
        <span style={{ fontSize: 13, color: '#A9B3CC', fontWeight: 600 }}>
          {MODE[v.settings.mode]} · Private room · Host: {host?.name ?? '—'}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div className="panel" style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 0 16px' }}>
        <span style={{ fontSize: 12, color: '#A9B3CC', fontWeight: 700, letterSpacing: 1.5 }}>ROOM CODE</span>
        <span className="mono" data-testid="room-code" style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#FFD166' }}>{v.code}</span>
        <button type="button" className="btn" onClick={onCopy} aria-label="Copy room code" style={{ height: 40, padding: '0 12px', fontSize: 14 }}><Copy size={16} />{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="panel" style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5F1E8" strokeWidth="2.6" strokeLinecap="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M19 15c2 1 3 3 3 6" /></svg>
        <span className="fd" data-testid="player-count" style={{ fontSize: 28 }}>{v.players.length}/8</span>
      </div>
      <div className="panel" style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }} aria-hidden="true"><span style={{ width: 4, height: 6, background: '#5ACB91' }} /><span style={{ width: 4, height: 11, background: hosting || rtt < 100 ? '#5ACB91' : '#3B4257' }} /><span style={{ width: 4, height: 16, background: hosting || rtt < 60 ? '#5ACB91' : '#3B4257' }} /></span>
        <span className="mono" data-testid="link-status" style={{ fontSize: 14 }}>{hosting ? 'You are hosting' : `P2P · ${rtt} ms`}</span>
      </div>
    </header>
  );
}

export function LobbyFooter({ d, onInvite, onCopyLink }: { d: LobbyDerived; onInvite: () => void; onCopyLink: () => void }): JSX.Element {
  const { view, me, isHost, startCheck } = d;
  const other = me?.team === 'red' ? 'blue' : 'red';
  const ready = !!me?.ready;
  const info = d.notReady ? `${d.notReady} not ready` : isHost && !startCheck.ok ? capital(startCheck.reason) : 'Everyone is ready';
  const enc = encodeURIComponent(view.code);
  return (
    <footer className="panel" style={{ position: 'absolute', left: 24, top: 796, width: 1392, height: 84, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
      <Link to={`/lobby/${enc}/machine`} className="btn" style={{ height: 56, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"><rect x="2" y="14" width="20" height="6" rx="3" /><path d="M5 14l2-5h9l2 5M12 9V6h8" /></svg>Change Machine</Link>
      <button type="button" className="btn" disabled title="Inventory arrives with accounts (Phase 4)" style={{ height: 56, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 20l6-6M14 4l6 6-8 8H6v-6z" /></svg>Customize</button>
      <button type="button" className="btn" onClick={onInvite} style={{ height: 56, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" /></svg>Invite Friends</button>
      <button type="button" className="btn" onClick={onCopyLink} style={{ height: 56, padding: '0 16px', fontSize: 16 }}><Copy size={20} />Copy Room Code</button>
      <button type="button" className="btn" onClick={() => lobbyService.send({ t: 'setTeam', team: other })} style={{ height: 56, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h14l-4-4M20 16H6l4 4" /></svg>Switch to {other === 'red' ? 'Red' : 'Blue'}</button>
      <div style={{ flex: 1 }} />
      <span data-testid="ready-info" style={{ fontSize: 14, color: '#A9B3CC', fontWeight: 600 }}>{info}</span>
      <Button className="dark" aria-pressed={ready} onClick={() => lobbyService.send({ t: 'setReady', ready: !ready })} style={{ height: 60, width: 170, fontSize: 24, background: ready ? '#5ACB91' : '#F5F1E8' }}><span className="fd">{ready ? 'READY!' : 'READY UP'}</span></Button>
      <Button className="dark" onClick={() => lobbyService.send({ t: 'startMatch' })} disabled={!isHost || !startCheck.ok} title={!isHost ? 'Only the host can start' : startCheck.ok ? undefined : capital(startCheck.reason)} style={{ height: 60, width: 200, fontSize: 24, background: '#FFD166' }}><span className="fd">START MATCH</span></Button>
    </footer>
  );
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
