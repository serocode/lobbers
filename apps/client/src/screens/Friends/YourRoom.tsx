// Friends.dc.html "Your room" aside. P2P (§3.9): "Invite all online" → "Share invite link"; there are no pending
// invites to track without a server, so that block explains how links work. Not in a room → Create Room.
import { useNavigate } from 'react-router-dom';
import { MAPS, ROOM_LIMITS, type LobbyPlayer, type LobbyView } from '@lobbers/shared';
import { MachineArt, SceneBackdrop } from '../../components';
import { TEAM_COLOR, TEAM_DARK } from '../../state/matchStore';
import { inviteLink } from '../Lobby/LobbyOverlays';
import { MODES } from '../Home/modals/modes';

export function YourRoom({ view, myId, onToast }: { view: LobbyView | null; myId: string; onToast: (t: string) => void }): JSX.Element {
  const nav = useNavigate();
  if (!view) {
    return (
      <aside aria-label="Your room" className="panel" style={{ position: 'absolute', left: 908, top: 100, width: 508, height: 780, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>YOUR ROOM</span>
        <span className="fd" style={{ fontSize: 28 }}>Create a room to invite friends</span>
        <span style={{ fontSize: 15, color: '#C9D1E0', maxWidth: 360 }}>You host it in this tab. Friends join with the room code or the invite link.</span>
        <button type="button" className="btn dark" onClick={() => nav('/', { state: { modal: 'create' } })} style={{ height: 62, padding: '0 28px', fontSize: 22, background: '#FFD166' }}><span className="fd">CREATE ROOM</span></button>
      </aside>
    );
  }
  const link = inviteLink(view.code);
  const copy = (): void => { navigator.clipboard.writeText(link).then(() => onToast('Invite link copied'), () => onToast(link)); };
  const share = (): void => {
    if (typeof navigator.share === 'function') navigator.share({ title: view.name, text: `Join my Lobbers room ${view.code}`, url: link }).catch(() => undefined);
    else copy();
  };
  const red = view.players.filter((p) => p.team === 'red'), blue = view.players.filter((p) => p.team === 'blue');
  const open = (n: number): null[] => Array.from({ length: Math.max(0, n) }, () => null);
  const slots: Array<LobbyPlayer | null> = [...red, ...open(ROOM_LIMITS.maxPerTeam - red.length), ...blue, ...open(ROOM_LIMITS.maxPerTeam - blue.length)].slice(0, ROOM_LIMITS.maxPlayers);
  return (
    <aside aria-label="Your room" className="panel" style={{ position: 'absolute', left: 908, top: 100, width: 508, height: 780, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>YOUR ROOM</span>
          <span className="fd" style={{ fontSize: 28, lineHeight: 1 }}>{view.name}</span>
          <span style={{ fontSize: 13, color: '#C9D1E0' }}>{MODES.find((m) => m.id === view.settings.mode)?.label ?? view.settings.mode} · {MAPS[view.settings.mapId].name}</span>
        </div>
        <span className="fd" style={{ fontSize: 30 }}>{view.players.length}/{ROOM_LIMITS.maxPlayers}</span>
      </div>
      <div style={{ height: 176, border: '3px solid #0B0F1A', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
        <SceneBackdrop map={view.settings.mapId} w={470} h={170} />
        <span className="fd" style={{ position: 'absolute', left: 10, bottom: 10, background: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 8px', fontSize: 14, color: '#FFD166' }}>{view.code}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        {slots.map((p, i) => (p ? (
          <div key={p.id} style={{ height: 74, borderRadius: 10, border: '3px solid #0B0F1A', background: TEAM_DARK[p.team], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2 }}>
            <MachineArt kind={p.machine} tint={TEAM_COLOR[p.team]} size={48} flip={p.team === 'blue'} />
            <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p.id === myId ? 'You' : p.name}</span>
          </div>
        ) : (
          <div key={`open-${i}`} style={{ height: 74, borderRadius: 10, border: '3px dashed #3B4257', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, fontWeight: 600, color: '#A9B3CC' }}>Open slot</span></div>
        )))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>INVITES</span>
        <span style={{ fontSize: 14, color: '#A9B3CC' }}>Anyone with the link or the code <span className="mono" style={{ color: '#FFD166' }}>{view.code}</span> can join while the room is open.</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn" onClick={share} style={{ height: 56, flex: 1, fontSize: 16 }}>Share invite link</button>
        <button type="button" className="btn" onClick={copy} style={{ height: 56, flex: 1, fontSize: 16 }}>Copy invite link</button>
      </div>
      <button type="button" className="btn dark" onClick={() => nav(`/lobby/${view.code}`)} style={{ height: 62, fontSize: 22, background: '#FFD166' }}><span className="fd">OPEN LOBBY</span></button>
    </aside>
  );
}
