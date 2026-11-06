// Create Room (Main.dc.html, DESIGN_SPEC §2.1): name, battlefield (6 maps), mode → this tab hosts the room
// over PeerJS. Every room is private (joined by code or invite link), so the private switch is gone.
import { useState } from 'react';
import { DEFAULT_SETTINGS, MAP_LIST, type MapId } from '@lobbers/shared';
import { Button, CloseButton, ErrorRow, Modal, SceneBackdrop } from '../../../components';
import { lobbyService } from '../../../net/p2p/roomService';
import { useProfile } from '../../../state/profile';
import s from '../home.module.css';
import { MODES } from './modes';

export function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }): JSX.Element {
  const user = useProfile((v) => v.profile);
  const [name, setName] = useState(`${user?.name ?? 'Lobber'}'s Brawl`.slice(0, 24));
  const [mapId, setMapId] = useState<MapId>('cobalt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameOk = name.trim().length >= 3 && name.trim().length <= 24;

  const create = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      onCreated(await lobbyService.host({ roomName: name.trim(), settings: { ...DEFAULT_SETTINGS, mapId, mode: 'team-deathmatch', isPrivate: true } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal label="Create room" onClose={onClose} style={{ width: 720, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Create Room</h2>
        <CloseButton onClick={onClose} />
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Room name
        <input className={s.inp} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Battlefield</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 }}>
          {MAP_LIST.map((m) => (
            <button key={m.id} type="button" className={`btn ${s.mapc} ${mapId === m.id ? s.on : ''}`} onClick={() => setMapId(m.id)} aria-pressed={mapId === m.id}>
              <span style={{ display: 'block', width: '100%', height: 92, overflow: 'hidden' }}><SceneBackdrop map={m.id} w={210} h={92} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', gap: 2 }}><span style={{ fontSize: 16 }}>{m.name}</span><span style={{ fontSize: 12, color: '#A9B3CC', fontWeight: 500 }}>{m.tagline}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Mode</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {MODES.map((m) => <button key={m.label} type="button" className={`btn seg ${m.id === 'team-deathmatch' ? 'on' : ''}`} disabled={!m.enabled} title={m.reason} aria-pressed={m.id === 'team-deathmatch'}>{m.label}</button>)}
        </div>
      </div>
      {error && <ErrorRow>{error}</ErrorRow>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#A9B3CC' }}>Friends join with the room code or your invite link</span>
        <Button variant="primary" onClick={() => void create()} disabled={busy || !nameOk} title={nameOk ? undefined : 'Room names are 3–24 characters'} style={{ height: 56, padding: '0 30px', fontSize: 20 }}>{busy ? 'Opening room…' : 'Create & Open Lobby'}</Button>
      </div>
    </Modal>
  );
}
