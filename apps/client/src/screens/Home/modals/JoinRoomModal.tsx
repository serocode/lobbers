// Join Room (Main.dc.html, DESIGN_SPEC §2.1 / §3.9): LOB-XXXX code (uppercase, validated) + Recent rooms
// (the last 4 codes you hosted or joined, from your local profile). Joining happens on /lobby/:code, which
// connects to the host and shows "Room not found" if the host is gone.
import { useState } from 'react';
import { ROOM_LIMITS } from '@lobbers/shared';
import { Button, CloseButton, Modal } from '../../../components';
import { ago } from '../../../state/format';
import { useProfile } from '../../../state/profile';
import s from '../home.module.css';

const CODE_RE = new RegExp(`^${ROOM_LIMITS.codePrefix}[${ROOM_LIMITS.codeAlphabet}]{${ROOM_LIMITS.codeLength}}$`);
const CODE_LEN = ROOM_LIMITS.codePrefix.length + ROOM_LIMITS.codeLength;

export function JoinRoomModal({ onClose, onJoined }: { onClose: () => void; onJoined: (code: string) => void }): JSX.Element {
  const [code, setCode] = useState('');
  const recent = useProfile((v) => v.profile?.recentRooms ?? []);
  const up = code.toUpperCase();

  return (
    <Modal label="Join room" onClose={onClose} style={{ width: 560, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Join Room</h2>
        <CloseButton onClick={onClose} />
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Room code
        <input className={`${s.inp} mono`} value={up} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && CODE_RE.test(up)) onJoined(up); }} placeholder="LOB-XXXX" maxLength={CODE_LEN} style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', height: 60 }} aria-describedby="join-hint" />
      </label>
      {CODE_RE.test(up)
        ? <Button variant="primary" onClick={() => onJoined(up)} style={{ height: 56, fontSize: 20 }}>{`Join ${up}`}</Button>
        : <Button disabled id="join-hint" style={{ height: 56, fontSize: 18 }}>Enter an {CODE_LEN}-character code</Button>}
      <span style={{ fontSize: 13, letterSpacing: 2, color: '#A9B3CC', fontWeight: 700, marginTop: 6 }}>RECENT ROOMS</span>
      {recent.length === 0 && <span style={{ fontSize: 14, color: '#A9B3CC' }}>Rooms you host or join show up here. Ask a friend for their code or invite link.</span>}
      {recent.map((r) => (
        <div key={r.code} className={s.row} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8 }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{r.name}</span><span style={{ fontSize: 12, color: '#A9B3CC' }}>{r.hosted ? 'You hosted' : 'You joined'} · {ago(r.at)}</span></span>
          <span className="mono" style={{ fontSize: 14, color: '#5ACB91' }}>{r.code}</span>
          <Button onClick={() => onJoined(r.code)} style={{ height: 38, padding: '0 14px', fontSize: 14 }}>Join</Button>
        </div>
      ))}
    </Modal>
  );
}
