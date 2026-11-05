// A team column (Lobby.dc.html): chamfered team band + 4 slots (filled / open / reconnecting).
import { MACHINES, type LobbyPlayerView, type TeamId } from '@lobbers/shared';
import { CloseIcon, MachineArt } from '../../components';
import { TEAM_COLOR, TEAM_DARK } from '../../state/matchStore';
import { mmss } from './useLobbyView';
import s from './lobby.module.css';

const BAND = {
  red: { name: 'TEAM RED', x: 24, flip: false, clip: 'polygon(0 0,100% 0,94% 100%,0 100%)' },
  blue: { name: 'TEAM BLUE', x: 1016, flip: true, clip: 'polygon(6% 0,100% 0,100% 100%,0 100%)' },
} as const;

function bars(ping: number): [string, string, string] {
  const n = ping < 60 ? 3 : ping < 100 ? 2 : 1;
  const c = n === 3 ? '#5ACB91' : n === 2 ? '#FFD166' : '#F45B55';
  return [c, n >= 2 ? c : '#3B4257', n >= 3 ? c : '#3B4257'];
}

interface Props { team: TeamId; slots: Array<LobbyPlayerView | null>; myId: string; isHost: boolean; now: number; onInvite: () => void; onKick: (p: LobbyPlayerView) => void }

export function TeamColumn({ team, slots, myId, isHost, now, onInvite, onKick }: Props): JSX.Element {
  const b = BAND[team], col = TEAM_COLOR[team], dark = TEAM_DARK[team];
  const ps = slots.filter((p): p is LobbyPlayerView => !!p);
  const avg = ps.length ? Math.round(ps.reduce((a, p) => a + p.level, 0) / ps.length) : 0;
  return (
    <section aria-label={`Team ${team === 'red' ? 'Red' : 'Blue'}`} style={{ position: 'absolute', left: b.x, top: 104, width: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.stripes} style={{ height: 60, backgroundColor: col, border: '3px solid #0B0F1A', boxShadow: '0 5px 0 #0B0F1A', clipPath: b.clip, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', color: '#101522' }}>
        <span className="fd" style={{ fontSize: 32 }}>{b.name}</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontWeight: 700 }}><span className="mono" style={{ fontSize: 20 }}>{ps.length}/4</span><span style={{ fontSize: 12 }}>avg Lv {avg}</span></span>
      </div>
      {slots.map((p, i) => (
        <div key={p?.id ?? `empty-${i}`} style={{ height: 136 }}>
          {p ? <Slot p={p} you={p.id === myId} col={col} dark={dark} flip={b.flip} canKick={isHost && p.id !== myId} now={now} onKick={() => onKick(p)} /> : (
            <button type="button" className={s.dash} onClick={onInvite} style={{ width: '100%', height: 136, borderRadius: 12, cursor: 'pointer', color: '#A9B3CC', fontFamily: 'Fredoka,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', border: '3px dashed #5B6378', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFD166" strokeWidth="3.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}><span className="fd" style={{ fontSize: 20, color: '#F5F1E8' }}>Open slot</span><span style={{ fontSize: 14 }}>Click to invite a friend</span></span>
              </span>
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function Slot({ p, you, col, dark, flip, canKick, now, onKick }: { p: LobbyPlayerView; you: boolean; col: string; dark: string; flip: boolean; canKick: boolean; now: number; onKick: () => void }): JSX.Element {
  const m = MACHINES[p.machine];
  const [b1, b2, b3] = bars(p.ping);
  const off = !p.connected;
  return (
    <div className={`panel ${s.slot} ${s.join}`} style={{ height: 136, display: 'flex', gap: 14, padding: 10, alignItems: 'center', borderColor: you ? '#FFD166' : '#0B0F1A' }}>
      {canKick && <button type="button" className={`btn ${s.kick}`} aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`} onClick={onKick}><CloseIcon size={12} /></button>}
      <div className={s.stripes} style={{ width: 112, height: 110, flex: 'none', borderRadius: 8, border: '3px solid #0B0F1A', backgroundColor: dark, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative', overflow: 'hidden', filter: off ? 'grayscale(.7)' : undefined }}>
        <div className={s.bob} style={{ marginBottom: 4 }}><MachineArt kind={p.machine} tint={col} size={100} flip={flip} /></div>
        {p.isHost && <span title="Host" style={{ position: 'absolute', left: 4, top: 4, width: 30, height: 24, background: '#FFD166', border: '2px solid #0B0F1A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-label="Host" role="img" width="18" height="14" viewBox="0 0 18 14"><path d="M1 12 L2 3 L6 7 L9 1 L12 7 L16 3 L17 12 Z" fill="#101522" /></svg></span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="fd" style={{ fontSize: 23, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          {you && <span className="fd" style={{ fontSize: 13, background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 6px' }}>YOU</span>}
        </div>
        <span style={{ fontSize: 13, color: '#FFD166', fontWeight: 600 }}>“{p.title}”</span>
        <span style={{ fontSize: 13, color: '#A9B3CC' }}>{m.name} · {m.role}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {p.ready
            ? <span className={`${s.readyOn} fd`} style={{ fontSize: 14, background: '#5ACB91', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>READY</span>
            : <span className={`${s.wait} fd`} style={{ fontSize: 14, background: '#2A3045', color: '#C9D1E0', border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 8px' }}>NOT READY</span>}
          <span className="fd" style={{ fontSize: 13, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 6px' }}>LV {p.level}</span>
          {off ? (
            <span className={`${s.wait} mono`} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#2A3045', color: '#C9D1E0', border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 6px' }}>RECONNECTING {mmss(p.reconnectUntil - now)}</span>
          ) : (
            <>
              <span className={s.ping} title={`${p.ping} ms`} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14, marginLeft: 'auto' }}><span style={{ width: 4, height: 5, background: b1 }} /><span style={{ width: 4, height: 9, background: b2 }} /><span style={{ width: 4, height: 14, background: b3 }} /></span>
              <span className="mono" style={{ fontSize: 12, color: '#A9B3CC' }}>{p.ping}ms</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
