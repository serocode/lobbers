// Machine Select — ported from design/mockup/Machines.dc.html (screenshots/03-*.png).
// In a room (/lobby/:code/machine) LOCK IN sends `setMachine`; outside one (/machines) it saves the
// default machine used for the next room. Teammates' live picks come from the LobbyRoom state.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MACHINES, MACHINE_LIST, type MachineId } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { Button, MachineArt } from '../../components';
import { lobbyService, useLobby } from '../../net/p2p/roomService';
import { useProfile } from '../../state/profile';
import { TEAM_COLOR, TEAM_DARK } from '../../state/matchStore';
import { useLobbyConnection } from '../Lobby';
import { DetailPanel } from './DetailPanel';
import s from './machines.module.css';

export default function MachineSelect(): JSX.Element {
  const { code } = useParams();
  const inRoom = !!code;
  const nav = useNavigate();
  const view = useLobby((v) => v.view);
  const defaultMachine = useProfile((v) => v.profile?.favoriteMachine ?? 'thumper');
  const setDefault = (m: MachineId): void => useProfile.getState().update((p) => ({ ...p, favoriteMachine: m }));
  const myId = lobbyService.myId;
  const me = view?.players.find((p) => p.id === myId);
  const [sel, setSel] = useState<MachineId>(me?.machine ?? defaultMachine);
  const [locked, setLocked] = useState(false);
  useLobbyConnection(inRoom ? (code ?? '').toUpperCase() : '');

  const pick = (id: MachineId): void => { if (!locked) setSel(id); };
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= MACHINE_LIST.length && !(e.target instanceof HTMLInputElement)) pick(MACHINE_LIST[n - 1].id);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const team = me?.team ?? 'red';
  const mates = inRoom && view ? view.players.filter((p) => p.team === team && p.id !== myId) : [];
  const takenBy = (id: MachineId): string | undefined => mates.find((p) => p.machine === id)?.name;
  const roles = new Set([...mates.map((p) => MACHINES[p.machine].role), MACHINES[sel].role]);
  const hint = roles.has('Defender') ? 'Nice — a Defender gives your team a wall to hide behind.' : 'Your team has no Defender yet. Mollusk would round out the squad.';
  const back = inRoom ? `/lobby/${encodeURIComponent(code ?? '')}` : '/';
  const lockIn = (): void => {
    setDefault(sel);
    if (inRoom) lobbyService.send({ t: 'setMachine', machine: sel });
    setLocked(true);
  };

  return (
    <Stage width={1440} height={900} label="Choose your machine">
      <div className={s.bg} style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <header style={{ position: 'absolute', left: 24, top: 20, width: 1392, height: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to={back} className="btn" style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>{inRoom ? 'Lobby' : 'Home'}</Link>
          <h1 className="fd" style={{ margin: 0, fontSize: 42, lineHeight: 1 }}>CHOOSE YOUR MACHINE</h1>
          {inRoom && <span className="fd" style={{ background: TEAM_COLOR[team], color: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, padding: '4px 12px', fontSize: 17 }}>TEAM {team.toUpperCase()}</span>}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={locked} onClick={() => pick(MACHINE_LIST[Math.floor(Math.random() * MACHINE_LIST.length)].id)} style={{ height: 52, padding: '0 16px', fontSize: 16 }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" /></svg>Random</button>
        </header>

        <div style={{ position: 'absolute', left: 24, top: 108, width: 824, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          {MACHINE_LIST.map((m, i) => {
            const on = sel === m.id, by = !on ? takenBy(m.id) : undefined;
            const bar = (k: string, v: number, c: string): JSX.Element[] => [<span key={`${k}l`}>{k}</span>, <span key={k} style={{ height: 6, background: '#0E1320', borderRadius: 3, overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${v * 10}%`, background: c }} /></span>];
            return (
              <button key={m.id} type="button" className={`${s.card} ${on ? s.on : ''}`} onClick={() => pick(m.id)} aria-pressed={on} aria-label={`${m.name}, ${m.role}`} disabled={locked && !on} style={{ height: 318 }}>
                <div className={s.stripes} style={{ height: 168, backgroundColor: m.cardBg, borderBottom: '4px solid #0B0F1A', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                  <span className="mono" style={{ position: 'absolute', left: 8, top: 8, fontSize: 12, fontWeight: 700, background: '#101522', border: '2px solid #0B0F1A', borderRadius: 5, padding: '0 5px', color: '#A9B3CC' }}>{i + 1}</span>
                  <div className={s.art} style={{ marginBottom: 4 }}><MachineArt kind={m.id} tint="#F45B55" size={168} aim={20} /></div>
                  {on && <span className="fd" style={{ position: 'absolute', right: 8, top: 8, background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 8px', fontSize: 13 }}>SELECTED</span>}
                  {by && <span style={{ position: 'absolute', right: 8, top: 8, background: '#101522', color: '#F5F1E8', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 8px', fontSize: 12, fontWeight: 600 }}>Picked by {by}</span>}
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, width: '100%' }}>
                  <span className="fd" style={{ fontSize: 24, lineHeight: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: m.color, fontWeight: 700 }}>{m.role}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '3px 6px', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#A9B3CC', marginTop: 'auto' }}>
                    {bar('HP', m.stats.health, '#5ACB91')}{bar('ATK', m.stats.attack, '#F45B55')}{bar('DEF', m.stats.defense, '#4C9AFF')}{bar('MOB', m.stats.mobility, '#FFD166')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DetailPanel id={sel} locked={locked} />

        <footer className="panel" style={{ position: 'absolute', left: 24, top: 796, width: 1392, height: 84, display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px' }}>
          {inRoom && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>TEAM PICKS</span>}
          {mates.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '4px 12px 4px 4px', height: 58 }}>
              <span style={{ width: 48, height: 46, background: TEAM_DARK[team], borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={p.machine} tint={TEAM_COLOR[team]} size={44} /></span>
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span><span style={{ fontSize: 12, color: p.ready ? '#5ACB91' : '#FFD166' }}>{p.ready ? 'Locked' : 'Picking…'} · {MACHINES[p.machine].name}</span></span>
            </div>
          ))}
          {inRoom && mates.length === 0 && <span style={{ fontSize: 13, color: '#A9B3CC' }}>No teammates yet</span>}
          <span style={{ fontSize: 13, color: '#C9D1E0', marginLeft: 8, maxWidth: 260, lineHeight: 1.3 }}>{inRoom ? hint : 'Your pick becomes the machine you bring into new rooms.'}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" disabled title="Skins arrive with the Inventory (Phase 4)" style={{ height: 58, padding: '0 18px', fontSize: 16 }}>Skins for {MACHINES[sel].name}</button>
          {!locked
            ? <Button className="dark" onClick={lockIn} style={{ height: 62, width: 230, background: '#FFD166', fontSize: 28 }}><span className="fd">LOCK IN</span></Button>
            : <Button className="dark" onClick={() => nav(back)} style={{ height: 62, width: 230, background: '#5ACB91', fontSize: 22 }}><span className="fd">{inRoom ? 'BACK TO LOBBY' : 'BACK TO HOME'}</span></Button>}
        </footer>
      </div>
    </Stage>
  );
}
