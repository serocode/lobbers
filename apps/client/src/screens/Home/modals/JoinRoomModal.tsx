// Join Room (Main.dc.html): LOB-XXXX code (uppercase, validated) + real public rooms list.
import { useEffect, useState } from 'react';
import { MAPS, ROOM_LIMITS, type PublicRoomInfo } from '@lobbers/shared';
import { Button, CloseButton, ErrorRow, Modal } from '../../../components';
import { api } from '../../../net/api';
import { lobbyService } from '../../../net/online/lobbyService';
import s from '../home.module.css';
import { MODES } from './modes';

const CODE_RE = new RegExp(`^${ROOM_LIMITS.codePrefix}[${ROOM_LIMITS.codeAlphabet}]{${ROOM_LIMITS.codeLength}}$`);
const CODE_LEN = ROOM_LIMITS.codePrefix.length + ROOM_LIMITS.codeLength;

export function JoinRoomModal({ onClose, onJoined }: { onClose: () => void; onJoined: (code: string) => void }): JSX.Element {
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<PublicRoomInfo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = code.toUpperCase();

  useEffect(() => {
    let alive = true;
    const load = (): void => { api<{ rooms: PublicRoomInfo[] }>('/api/rooms').then((r) => { if (alive) setRooms(r.rooms); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); }); };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const go = async (join: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setError('');
    try { onJoined(await join()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <Modal label="Join room" onClose={onClose} style={{ width: 560, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Join Room</h2>
        <CloseButton onClick={onClose} />
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Room code
        <input className={`${s.inp} mono`} value={up} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && CODE_RE.test(up)) void go(() => lobbyService.joinByCode(up)); }} placeholder="LOB-XXXX" maxLength={CODE_LEN} style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', height: 60 }} aria-describedby="join-hint" />
      </label>
      {CODE_RE.test(up)
        ? <Button variant="primary" disabled={busy} onClick={() => void go(() => lobbyService.joinByCode(up))} style={{ height: 56, fontSize: 20 }}>{busy ? 'Joining…' : `Join ${up}`}</Button>
        : <Button disabled id="join-hint" style={{ height: 56, fontSize: 18 }}>Enter an {CODE_LEN}-character code</Button>}
      {error && <ErrorRow>{error}</ErrorRow>}
      <span style={{ fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700, marginTop: 6 }}>OPEN ROOMS NEAR YOU</span>
      {rooms === null && !error && <span style={{ fontSize: 14, color: '#A9B3CC' }}>Looking for rooms…</span>}
      {rooms?.length === 0 && <span style={{ fontSize: 14, color: '#A9B3CC' }}>No public rooms right now. Create one and share the code.</span>}
      {rooms?.slice(0, 4).map((r) => (
        <div key={r.roomId} className={s.row} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8 }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{r.name}</span><span style={{ fontSize: 12, color: '#A9B3CC' }}>{MODES.find((m) => m.id === r.mode)?.label ?? r.mode} · {MAPS[r.mapId].name}{r.ranked ? ' · Ranked' : ''}</span></span>
          <span className="mono" style={{ fontSize: 14, color: '#5ACB91' }}>{r.players}/{r.maxPlayers}</span>
          <Button disabled={busy} onClick={() => void go(() => lobbyService.joinById(r.roomId))} style={{ height: 38, padding: '0 14px', fontSize: 14 }}>Join</Button>
        </div>
      ))}
    </Modal>
  );
}
