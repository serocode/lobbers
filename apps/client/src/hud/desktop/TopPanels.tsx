// Team Red / Team Blue panels and the Current Turn panel (Battle.dc.html top HUD).
import { CAMERA, type TeamId, type UnitState } from '@lobbers/shared';
import { MachineArt, SkullIcon, TimerRing } from '../../components';
import { cameraBus } from '../../state/cameraBus';
import { TEAM_COLOR, TEAM_DARK, canControl, isLocal, unitOf } from '../../state/matchStore';
import { useMatch, useTurnSeconds } from '../BattleContext';
import s from '../battle.module.css';

const fmt = (n: number): string => n.toLocaleString('en-US');

function Member({ u, team, active, you }: { u: UnitState; team: TeamId; active: boolean; you: boolean }): JSX.Element {
  const dead = !u.alive;
  const pct = Math.round((u.hp / u.maxHp) * 100);
  return (
    <button type="button" className={active ? s.pulse : ''} onClick={() => cameraBus.command({ t: 'lookAt', x: u.x, y: u.y - CAMERA.focusAboveUnit })} title={`Look at ${u.name}`}
      style={{ height: 52, borderRadius: 8, border: `2px solid ${active ? '#FFD166' : you ? '#8A6F2E' : '#0B0F1A'}`, background: '#1C2338', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px', position: 'relative', opacity: dead ? 0.55 : 1, cursor: 'pointer', color: '#F5F1E8', fontFamily: 'Fredoka,sans-serif', textAlign: 'left', minWidth: 0 }}>
      <span style={{ width: 38, height: 40, flex: 'none', borderRadius: 6, background: TEAM_DARK[team], display: 'flex', alignItems: 'center', justifyContent: 'center', filter: dead ? 'grayscale(1)' : 'none' }}>
        <MachineArt kind={u.machine} tint={TEAM_COLOR[team]} size={36} flip={team === 'blue'} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: dead ? 'line-through' : 'none' }}>{you ? 'You' : u.name}</span>
        <span style={{ height: 6, borderRadius: 3, background: '#0E1320', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: TEAM_COLOR[team], transition: 'width .6s' }} /></span>
        <span className="mono" style={{ fontSize: 10, color: '#A9B3CC' }}>{dead ? 'OUT' : u.hp}</span>
      </span>
      {dead && <SkullIcon role="img" aria-label="Eliminated" style={{ position: 'absolute', right: 3, top: 3 }} />}
    </button>
  );
}

export function TeamPanel({ team }: { team: TeamId }): JSX.Element {
  const units = useMatch((v) => v.units);
  const active = useMatch((v) => v.activeUnitId);
  const youId = useMatch((v) => (v.localPlayerIds.length === 1 ? v.units.find((u) => u.playerId === v.localPlayerIds[0])?.id : undefined));
  const us = units.filter((u) => u.team === team).sort((a, b) => a.id.localeCompare(b.id));
  const hp = us.reduce((n, u) => n + u.hp, 0), max = us.reduce((n, u) => n + u.maxHp, 0);
  const red = team === 'red', col = TEAM_COLOR[team];
  return (
    <section aria-label={`Team ${red ? 'Red' : 'Blue'}`} className="hud" style={{ position: 'absolute', left: red ? 80 : 908, top: 12, width: 452, height: 100, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: red ? 'row' : 'row-reverse' }}>
        <span className="fd" style={{ background: col, color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '1px 10px', fontSize: 16 }}>{red ? 'RED' : 'BLUE'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}><span className="mono">{us.filter((u) => u.alive).length}</span>/{us.length} alive</span>
        <span style={{ flex: 1, height: 14, border: '2px solid #0B0F1A', borderRadius: 7, background: '#0E1320', overflow: 'hidden', display: 'flex', justifyContent: red ? 'flex-start' : 'flex-end' }}>
          <span style={{ display: 'block', height: '100%', width: `${max ? Math.round((hp / max) * 100) : 0}%`, background: col, transition: 'width .6s' }} />
        </span>
        <span className="mono" style={{ fontSize: 12, color: '#C9D1E0', whiteSpace: 'nowrap' }}>{fmt(hp)} / {fmt(max)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
        {us.map((u) => <Member key={u.id} u={u} team={team} active={u.id === active && u.alive} you={u.id === youId} />)}
      </div>
    </section>
  );
}

export function TurnPanel(): JSX.Element {
  const secs = useTurnSeconds();
  const total = useMatch((v) => v.settings?.turnSeconds ?? 30);
  const turn = useMatch((v) => v.turnNumber);
  const act = useMatch((v) => unitOf(v, v.activeUnitId));
  const mine = useMatch(canControl);
  const online = useMatch((v) => v.localPlayerIds.length === 1);
  const local = useMatch((v) => isLocal(v, unitOf(v, v.activeUnitId)));
  const phase = useMatch((v) => v.sync.phase);
  const replaying = useMatch((v) => v.replaying);
  const col = act ? TEAM_COLOR[act.team] : '#F45B55', dark = act ? TEAM_DARK[act.team] : '#3A2230';
  const frozen = !!act && act.status.frozenTurns > 0;
  const status = !act ? 'Get ready…'
    : mine ? (frozen ? 'Frozen — you can still fire' : 'Your turn — aim and fire!')
      : phase === 'resolving' || replaying ? 'Shot in the air…' : 'Aiming…';
  return (
    <section aria-label="Current turn" className="hud" style={{ position: 'absolute', left: 546, top: 12, width: 348, height: 100, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 68, height: 68, flex: 'none', borderRadius: 10, border: `3px solid ${col}`, background: dark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {act && <MachineArt kind={act.machine} tint={col} size={60} flip={act.facing < 0} />}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 12, color: '#A9B3CC', fontWeight: 700 }}>TURN {turn}</span>
        <span className="fd" style={{ fontSize: 24, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: col }}>{act ? `${act.name}${online && local ? ' (you)' : ''}` : '—'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#C9D1E0' }}>{status}</span>
      </div>
      <TimerRing seconds={secs} total={total} pulse={mine} />
    </section>
  );
}
