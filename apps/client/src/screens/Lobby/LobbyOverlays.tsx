// Countdown 3-2-1 + DEPLOYING! (driven by the server's countdownEndsAt / match seat), Invite Friends
// (friends arrive in Phase 4 — the modal offers the room link instead) and the host's kick confirm.
import { MAPS, type LobbyPlayerView, type LobbyView } from '@lobbers/shared';
import { Button, CloseButton, Modal } from '../../components';
import s from './lobby.module.css';

const big = { fontSize: 200, lineHeight: 1, WebkitTextStroke: '10px #0B0F1A', paintOrder: 'stroke fill', textShadow: '0 10px 0 #0B0F1A' } as const;

export function Countdown({ view, now, deploying, onEnter }: { view: LobbyView; now: number; deploying: boolean; onEnter: () => void }): JSX.Element | null {
  if (view.phase === 'open') return null;
  const left = Math.ceil((view.countdownEndsAt - now) / 1000);
  const counting = view.phase === 'starting' && left > 0;
  return (
    <div className="scrim" style={{ flexDirection: 'column', gap: 20, background: 'rgba(8,11,20,.9)' }} role="dialog" aria-label="Match starting">
      <span style={{ fontSize: 15, letterSpacing: 3, fontWeight: 700, color: '#A9B3CC' }}>MATCH STARTING · {MAPS[view.settings.mapId].name.toUpperCase()}</span>
      {counting && <span key={left} className={`fd ${s.count}`} style={{ ...big, color: left === 1 ? '#F45B55' : '#FFD166' }}>{Math.min(3, left)}</span>}
      {!counting && (
        <div className={s.join} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <span className="fd" style={{ fontSize: 72, lineHeight: 1, color: '#F5F1E8', WebkitTextStroke: '6px #0B0F1A', paintOrder: 'stroke fill' }}>DEPLOYING!</span>
          <div style={{ width: 520, height: 22, border: '3px solid #0B0F1A', borderRadius: 12, background: '#0E1320', overflow: 'hidden' }}><div className={s.load} style={{ height: '100%', background: '#5ACB91' }} /></div>
          <span style={{ fontSize: 14, color: '#A9B3CC' }}>Tip: wind pushes harder on lighter shells — the Ice Bomb barely drifts.</span>
          <Button className="dark" disabled={!deploying} onClick={onEnter} style={{ height: 64, padding: '0 34px', background: '#FFD166', fontSize: 26 }}><span className="fd">ENTER BATTLEFIELD</span></Button>
        </div>
      )}
    </div>
  );
}

export function InviteModal({ view, onClose, onCopyLink }: { view: LobbyView; onClose: () => void; onCopyLink: () => void }): JSX.Element {
  const open = 8 - view.players.length;
  return (
    <Modal label="Invite friends" onClose={onClose} style={{ width: 520, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 32 }}>Invite Friends</h2>
        <CloseButton onClick={onClose} />
      </div>
      <span style={{ fontSize: 14, color: '#A9B3CC' }}>{open} open {open === 1 ? 'slot' : 'slots'} · friends lists and in-game invites arrive with accounts</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '10px 12px' }}>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>Share the room code</span><span className="mono" style={{ fontSize: 18, color: '#FFD166', letterSpacing: 2 }}>{view.code}</span></span>
        <Button variant="info" onClick={onCopyLink} style={{ height: 40, padding: '0 14px', fontSize: 14 }}>Copy invite link</Button>
      </div>
      <span style={{ fontSize: 13, color: '#A9B3CC' }}>Friends open the link or enter the code under Join Room.</span>
    </Modal>
  );
}

export function KickConfirm({ p, onCancel, onConfirm }: { p: LobbyPlayerView; onCancel: () => void; onConfirm: () => void }): JSX.Element {
  return (
    <Modal label={`Remove ${p.name}?`} onClose={onCancel} style={{ width: 440, padding: 26, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
      <h2 className="fd" style={{ margin: '0 0 6px', fontSize: 34 }}>REMOVE {p.name.toUpperCase()}?</h2>
      <p style={{ margin: 0, color: '#C9D1E0' }}>They leave the room and can rejoin with the code.</p>
      <Button variant="danger" onClick={onConfirm} style={{ height: 54, fontSize: 18 }}><span className="fd">REMOVE PLAYER</span></Button>
      <Button onClick={onCancel} style={{ height: 48, fontSize: 16 }}>Cancel</Button>
    </Modal>
  );
}
