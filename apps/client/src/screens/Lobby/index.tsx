// Lobby — ported from design/mockup/Lobby.dc.html (screenshots/02-lobby*.png), wired to LobbyRoom.
// /lobby/:code joins (or resumes) the room with that code; every control sends a LobbyIntent.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LobbyPlayer } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { CheckIcon, ErrorIcon } from '../../components';
import { lobbyService, useLobby } from '../../net/p2p/roomService';
import { showNotice } from '../../state/notice';
import { useProfile } from '../../state/profile';
import { FirstRunModal } from '../Home/modals/FirstRunModal';
import { CenterPanel } from './CenterPanel';
import { LobbyFooter, LobbyHeader } from './LobbyChrome';
import { CloseRoomConfirm, Countdown, InviteModal, KickConfirm, inviteLink } from './LobbyOverlays';
import { TeamColumn } from './TeamColumn';
import { derive, useClock } from './useLobbyView';
import s from './lobby.module.css';

/** Joins (or rejoins with the stored token) the room behind /lobby/:code. When it ends, the app-wide ClosedCard explains why. */
export function useLobbyConnection(code: string): void {
  const nav = useNavigate();
  const ready = useProfile((v) => v.status === 'ready');
  const current = useLobby((v) => v.code);
  const name = useLobby((v) => v.view?.name);
  useEffect(() => {
    // A tab that hosts this code is resumed at app start (NetworkWatcher); never join your own room.
    if (!ready || !code || current === code || lobbyService.hostsCode(code)) return;
    lobbyService.join(code).catch((e: unknown) => { showNotice(e instanceof Error ? e.message : String(e), 'error'); nav('/', { replace: true }); });
  }, [code, ready, current, nav]);
  useEffect(() => { if (name && current === code) lobbyService.noteRoomName(name); }, [name, current, code]);
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function LobbyScreen(): JSX.Element {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const needsName = useProfile((v) => v.status === 'needsName');
  const countdownEndsAt = useLobby((v) => v.countdownEndsAt);
  const hosting = useLobby((v) => v.hosting);
  const view = useLobby((v) => v.view);
  const notice = useLobby((v) => v.notice);
  const pending = useLobby((v) => v.pendingMatch);
  const now = useClock();
  const [toast, setToast] = useState<{ id: number; text: string; kind: 'ok' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState(false);
  const [kick, setKick] = useState<LobbyPlayer | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  useLobbyConnection(code.toUpperCase());

  useEffect(() => { if (notice) { setToast(notice); lobbyService.clearNotice(); } }, [notice]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);
  // All players move together: once the seat is joined, show DEPLOYING! briefly, then go.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => { lobbyService.consumePendingMatch(); nav(`/match/${pending}`); }, 1400);
    return () => clearTimeout(t);
  }, [pending, nav]);

  if (!view || view.code !== code.toUpperCase()) {
    return (
      <Stage width={1440} height={900} label="Lobby">
        <div className={s.bg} style={{ width: 1440, height: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A9B3CC', fontSize: 20, fontWeight: 600 }}>
          {needsName ? <FirstRunModal /> : `Joining ${code.toUpperCase()}…`}
        </div>
      </Stage>
    );
  }

  const d = derive(view);
  const say = (text: string, kind: 'ok' | 'error' = 'ok'): void => setToast({ id: Date.now(), text, kind });
  const copyCode = (): void => { void copy(view.code).then((ok) => { setCopied(ok); say(ok ? 'Room code copied' : 'Copy failed — code is ' + view.code, ok ? 'ok' : 'error'); }); };
  // Invite: the share sheet when the browser has one (phones), else copy the link.
  const shareLink = (): void => { if (navigator.share) { navigator.share({ title: 'Join my Lobbers room', text: `Room ${view.code}`, url: inviteLink(view.code) }).catch(() => undefined); } else copyLink(); };
  const copyLink = (): void => { void copy(inviteLink(view.code)).then((ok) => say(ok ? 'Invite link copied' : 'Copy failed — code is ' + view.code, ok ? 'ok' : 'error')); };
  const leaveNow = (): void => { void lobbyService.leave(); nav('/'); };
  // Host: leaving closes the room for everyone (no host transfer in P2P) — confirm first.
  const leave = (): void => { if (hosting) setConfirmClose(true); else leaveNow(); };

  return (
    <Stage width={1440} height={900} label={`Lobby ${view.name}`}>
      <div className={s.bg} style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <LobbyHeader d={d} copied={copied} onCopy={copyCode} onLeave={leave} />
        <TeamColumn team="red" slots={d.team('red')} myId={d.me?.id ?? ''} isHost={d.isHost} onInvite={() => setInvite(true)} onKick={setKick} />
        <TeamColumn team="blue" slots={d.team('blue')} myId={d.me?.id ?? ''} isHost={d.isHost} onInvite={() => setInvite(true)} onKick={setKick} />
        <CenterPanel view={view} isHost={d.isHost} myId={d.me?.id ?? ''} />
        <LobbyFooter d={d} onInvite={() => setInvite(true)} onCopyLink={copyLink} />
        {invite && <InviteModal view={view} onClose={() => setInvite(false)} onCopyLink={shareLink} />}
        {confirmClose && <CloseRoomConfirm onCancel={() => setConfirmClose(false)} onConfirm={leaveNow} />}
        {kick && <KickConfirm p={kick} onCancel={() => setKick(null)} onConfirm={() => { lobbyService.send({ t: 'kick', playerId: kick.id }); setKick(null); }} />}
        <Countdown view={view} now={now} endsAt={countdownEndsAt} deploying={!!pending} onEnter={() => { if (pending) { lobbyService.consumePendingMatch(); nav(`/match/${pending}`); } }} />
        {toast && (
          <div key={toast.id} className={`panel ${s.toast}`} role={toast.kind === 'error' ? 'alert' : 'status'} style={toast.kind === 'error' ? { width: 'auto', minWidth: 240, left: 720, transform: 'translateX(-50%)' } : undefined}>
            {toast.kind === 'error' ? <ErrorIcon size={18} /> : <CheckIcon size={18} />}{toast.text}
          </div>
        )}
      </div>
    </Stage>
  );
}
