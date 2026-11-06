// Hot Seat (DESIGN_SPEC §3.9), in the Create Room style: battlefield, mode, 2–8 seats (name + machine each; any seat
// can be a bot — §3.11). Starts a HostSession with no network on /hotseat; the HUD controls whichever human seat is active.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOT_DIFFICULTIES, BOT_LABEL, MACHINE_LIST, MACHINES, MAP_LIST, ROOM_LIMITS, type BotDifficulty, type MachineId, type MapId, type TeamId } from '@lobbers/shared';
import { Button, ChevronLeft, ChevronRight, CloseButton, MachineArt, Modal, SceneBackdrop } from '../../../components';
import { DEFAULT_LOCAL, encodeLocalConfig } from '../../../state/localMatchConfig';
import { TEAM_COLOR, TEAM_DARK } from '../../../state/matchStore';
import s from '../home.module.css';
import { MODES } from './modes';

interface Seat { name: string; machine: MachineId; bot: BotDifficulty | null }
/** Seat kinds the toggle cycles through: a person, then each bot difficulty. */
const KINDS: Array<BotDifficulty | null> = [null, ...BOT_DIFFICULTIES];
const nextKind = (k: BotDifficulty | null): BotDifficulty | null => KINDS[(KINDS.indexOf(k) + 1) % KINDS.length];
const ids = MACHINE_LIST.map((m) => m.id);
const cycle = (id: MachineId, d: 1 | -1): MachineId => ids[(ids.indexOf(id) + d + ids.length) % ids.length];
const NAME_OK = (n: string): boolean => n.trim() === '' || (n.trim().length >= 3 && n.trim().length <= 16);

/** Two overlapping controllers in the mockup's stroke icon style. */
export const HotSeatIcon = (): JSX.Element => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9h9a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="#101522" fillOpacity=".25" />
    <path d="M10 6h9a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2" />
    <path d="M5 13h3M6.5 11.5v3" />
  </svg>
);

function TeamSeats({ team, seats, onChange }: { team: TeamId; seats: Seat[]; onChange: (s: Seat[]) => void }): JSX.Element {
  const set = (i: number, p: Partial<Seat>): void => onChange(seats.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const label = team === 'red' ? 'Red' : 'Blue';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="fd" style={{ background: TEAM_COLOR[team], color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '1px 10px', fontSize: 16 }}>TEAM {label.toUpperCase()}</span>
        <span className="mono" style={{ fontSize: 13, color: '#A9B3CC' }}>{seats.length}/{ROOM_LIMITS.maxPerTeam}</span>
        <span style={{ flex: 1 }} />
        <Button aria-label={`Remove a ${label} player`} disabled={seats.length <= 1} onClick={() => onChange(seats.slice(0, -1))} style={{ width: 34, height: 30 }}>−</Button>
        <Button aria-label={`Add a ${label} player`} disabled={seats.length >= ROOM_LIMITS.maxPerTeam} onClick={() => onChange([...seats, { name: '', machine: ids[(seats.length * 3 + (team === 'red' ? 0 : 4)) % ids.length], bot: null }])} style={{ width: 34, height: 30 }}>+</Button>
      </div>
      {seats.map((seat, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1C2338', border: '2px solid #0B0F1A', borderRadius: 8, padding: '4px 6px' }}>
          <span style={{ width: 44, height: 36, flex: 'none', borderRadius: 6, background: TEAM_DARK[team], display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={seat.machine} tint={TEAM_COLOR[team]} size={40} flip={team === 'blue'} /></span>
          <Button aria-label={`${label} ${i + 1}: ${seat.bot ? `${BOT_LABEL[seat.bot]} bot` : 'player'} — change`} data-testid={`seat-kind-${team}-${i}`} onClick={() => set(i, { bot: nextKind(seat.bot) })}
            style={{ width: 62, height: 36, padding: 0, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.05, background: seat.bot ? '#A9B3CC' : undefined, color: seat.bot ? '#101522' : undefined }}>
            <span className="fd" style={{ fontSize: 13 }}>{seat.bot ? 'BOT' : 'PLAYER'}</span>{seat.bot && <span style={{ fontSize: 10, fontWeight: 700 }}>{BOT_LABEL[seat.bot].toUpperCase()}</span>}
          </Button>
          <input className={s.inp} aria-label={`${label} player ${i + 1} name`} value={seat.bot ? '' : seat.name} maxLength={16} disabled={!!seat.bot} placeholder={seat.bot ? 'Bot' : `${label} ${i + 1}`} onChange={(e) => set(i, { name: e.target.value })}
            style={{ height: 36, fontSize: 14, flex: 1, minWidth: 0, opacity: seat.bot ? 0.55 : undefined, outline: seat.bot || NAME_OK(seat.name) ? undefined : '3px solid #F45B55' }} />
          <Button aria-label={`Previous machine for ${label} ${i + 1}`} onClick={() => set(i, { machine: cycle(seat.machine, -1) })} style={{ width: 28, height: 28, padding: 0 }}><ChevronLeft size={11} /></Button>
          <span style={{ fontSize: 12, fontWeight: 700, width: 66, textAlign: 'center' }}>{MACHINES[seat.machine].name}</span>
          <Button aria-label={`Next machine for ${label} ${i + 1}`} onClick={() => set(i, { machine: cycle(seat.machine, 1) })} style={{ width: 28, height: 28, padding: 0 }}><ChevronRight size={11} /></Button>
        </div>
      ))}
    </div>
  );
}

export function HotSeatModal({ onClose }: { onClose: () => void }): JSX.Element {
  const nav = useNavigate();
  const [mapId, setMapId] = useState<MapId>('cobalt');
  const [red, setRed] = useState<Seat[]>(DEFAULT_LOCAL.red.map((machine) => ({ name: '', machine, bot: null })));
  const [blue, setBlue] = useState<Seat[]>(DEFAULT_LOCAL.blue.map((machine) => ({ name: '', machine, bot: null })));
  const namesOk = [...red, ...blue].every((x) => x.bot || NAME_OK(x.name));
  const someone = [...red, ...blue].some((x) => !x.bot);
  const valid = namesOk && someone;
  const start = (): void => {
    nav(encodeLocalConfig({
      ...DEFAULT_LOCAL, mapId, red: red.map((x) => x.machine), blue: blue.map((x) => x.machine),
      names: { red: red.map((x) => (x.bot ? '' : x.name.trim())), blue: blue.map((x) => (x.bot ? '' : x.name.trim())) },
      bots: { red: red.map((x) => x.bot), blue: blue.map((x) => x.bot) }, seed: Math.floor(Math.random() * 1e9) + 1,
    }));
  };
  return (
    <Modal label="Hot seat" onClose={onClose} style={{ width: 860, padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Hot Seat</h2><span style={{ fontSize: 14, color: '#A9B3CC', fontWeight: 600 }}>Pass &amp; play on one screen, or practise against bots — no rewards</span></div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 10 }}>
        {MAP_LIST.map((m) => (
          <button key={m.id} type="button" className={`btn ${s.mapc} ${mapId === m.id ? s.on : ''}`} onClick={() => setMapId(m.id)} aria-pressed={mapId === m.id}>
            <span style={{ display: 'block', width: '100%', height: 56, overflow: 'hidden' }}><SceneBackdrop map={m.id} w={130} h={56} /></span>
            <span style={{ padding: '4px 8px', fontSize: 13 }}>{m.name}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {MODES.map((m) => <button key={m.label} type="button" className={`btn seg ${m.id === 'team-deathmatch' ? 'on' : ''}`} disabled={!m.enabled} title={m.reason} aria-pressed={m.id === 'team-deathmatch'}>{m.label}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <TeamSeats team="red" seats={red} onChange={setRed} />
        <TeamSeats team="blue" seats={blue} onChange={setBlue} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: valid ? '#A9B3CC' : '#F45B55', fontWeight: 600 }}>{!someone ? 'At least one seat has to be a player' : !namesOk ? 'Names are 3–16 characters' : 'Names are optional · tap PLAYER to make a seat a bot'}</span>
        <Button variant="primary" data-testid="start-hotseat" disabled={!valid} onClick={start} style={{ height: 56, padding: '0 30px', fontSize: 20 }}><span className="fd">START HOT SEAT</span></Button>
      </div>
    </Modal>
  );
}
