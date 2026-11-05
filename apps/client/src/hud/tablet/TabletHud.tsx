// Tablet battle HUD (BattleTablet.dc.html, 1024×768; field 1024×560 at zoom 0.8).
import { MACHINES, MAPS, type TeamId } from '@lobbers/shared';
import { FocusIcon, MachineArt, TimerRing, WeaponIcon } from '../../components';
import { cameraBus } from '../../state/cameraBus';
import { TEAM_DARK, canControl, unitOf } from '../../state/matchStore';
import { useBattle, useCanControl, useDeckUnit, useMatch, useTurnSeconds, weaponInfo } from '../BattleContext';
import { BattleToast, ElimRibbon, HurtVignette, TurnBanner } from '../Overlays';
import { AbilityPair, MoveButtons, SHORT, useTeam } from '../compact';
import { useCameraView } from '../desktop/FieldHud';
import { ArmoryModal, PauseMenu, VictoryOverlay } from '../desktop/Modals';
import { windColor } from '../desktop/DeckRight';
import s from '../battle.module.css';

function Strip({ team }: { team: TeamId }): JSX.Element {
  const t = useTeam(team);
  const active = useMatch((v) => v.activeUnitId);
  const red = team === 'red';
  return (
    <section aria-label={`Team ${red ? 'Red' : 'Blue'}`} className="hud" style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 5, order: red ? 0 : 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: red ? 'row' : 'row-reverse' }}>
        <span className="fd" style={{ background: t.col, color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 8px', fontSize: 15 }}>{red ? 'RED' : 'BLUE'}</span>
        <span className="mono" style={{ fontSize: 13 }}>{t.alive}/{t.units.length}</span>
        <span style={{ flex: 1, height: 12, border: '2px solid #0B0F1A', borderRadius: 6, background: '#0E1320', overflow: 'hidden', display: 'flex', justifyContent: red ? 'flex-start' : 'flex-end' }}><span style={{ display: 'block', height: '100%', width: `${t.pct}%`, background: t.col, transition: 'width .6s' }} /></span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexDirection: red ? 'row' : 'row-reverse' }}>
        {t.units.map((u) => (
          <span key={u.id} title={u.name} style={{ width: 44, height: 36, borderRadius: 7, border: `2px solid ${u.id === active && u.alive ? '#FFD166' : '#0B0F1A'}`, background: TEAM_DARK[team], display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: u.alive ? 1 : 0.55, filter: u.alive ? 'none' : 'grayscale(1)' }}>
            <MachineArt kind={u.machine} tint={t.col} size={36} flip={!red} />
          </span>
        ))}
      </div>
    </section>
  );
}

function TurnPill(): JSX.Element {
  const secs = useTurnSeconds();
  const total = useMatch((v) => v.settings?.turnSeconds ?? 30);
  const turn = useMatch((v) => v.turnNumber);
  const map = useMatch((v) => v.mapId);
  const mine = useMatch(canControl);
  const act = useMatch((v) => unitOf(v, v.activeUnitId));
  const hotseat = useMatch((v) => v.localPlayerIds.length > 1);
  const title = mine && !hotseat ? 'YOUR TURN' : (act?.name ?? '').toUpperCase();
  return (
    <section aria-label="Current turn" className="hud" style={{ width: 230, order: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 11, color: '#A9B3CC', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>TURN {turn} · {MAPS[map].name.toUpperCase()}</span>
        <span className="fd" style={{ fontSize: 22, color: mine && !hotseat ? '#FFD166' : act ? (act.team === 'red' ? '#F45B55' : '#4C9AFF') : '#FFD166', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
      <TimerRing seconds={secs} total={total} size={52} pulse={mine} />
    </section>
  );
}

function Controls(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const aim = useMatch((v) => (u ? v.aim[u.id] : undefined));
  const wind = useMatch((v) => v.wind);
  if (!u || !aim) return <section style={{ position: 'absolute', left: 0, top: 560, width: 1024, height: 208, background: '#151B2B', borderTop: '4px solid #0B0F1A' }} />;
  const abs = Math.abs(wind);
  return (
    <section aria-label="Combat controls" style={{ position: 'absolute', left: 0, top: 560, width: 1024, height: 208, background: '#151B2B', borderTop: '4px solid #0B0F1A', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, height: 70 }}>
        {MACHINES[u.machine].loadout.map((id) => {
          const w = weaponInfo(id, u), on = aim.weaponId === id;
          return (
            <button key={id} type="button" className={`btn ${s.wb} ${on ? s.on : ''}`} onClick={() => controls.selectWeapon(id)} aria-pressed={on} disabled={!mine || !controls.canUse(id)} style={{ flex: 1, height: 70, flexDirection: 'column', gap: 2, background: '#1C2338', padding: 2 }}>
              <WeaponIcon icon={w.def.icon} color={w.def.color} size={34} />
              <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{SHORT[id]} <span className="mono" style={{ color: '#FFD166', fontSize: 11 }}>{w.ammo < 0 ? '∞' : `×${w.ammo}`}</span></span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', height: 98 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <MoveButtons w={50} h={56} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC' }}>FUEL <span className="mono">{u.status.unlimitedFuel ? '∞' : Math.round(u.fuel)}</span></span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: '6px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#A9B3CC' }}>ANGLE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn" aria-label="Lower angle" onClick={() => controls.nudgeAngle(-1)} disabled={!mine} style={{ width: 48, height: 48, fontSize: 24 }}>−</button>
            <span className="mono" style={{ fontSize: 28, fontWeight: 700, width: 70, textAlign: 'center' }}>{aim.angle}°</span>
            <button type="button" className="btn" aria-label="Raise angle" onClick={() => controls.nudgeAngle(1)} disabled={!mine} style={{ width: 48, height: 48, fontSize: 24 }}>+</button>
          </div>
        </div>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: '8px 14px', minWidth: 0 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#A9B3CC' }}>POWER<span className="mono" style={{ fontSize: 20, color: '#FFD166' }}>{aim.power}</span></span>
          <input className={s.big} type="range" min={0} max={100} value={aim.power} onChange={(e) => controls.setPower(+e.target.value)} disabled={!mine} aria-label="Shot power" />
        </label>
        <div role="img" aria-label={`Wind ${abs}`} style={{ width: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC' }}>WIND</span>
          <svg aria-hidden="true" width="56" height="28" viewBox="0 0 70 34" style={{ transform: `scaleX(${wind < 0 ? -1 : 1})` }}><path d="M4 12 H46 V4 L66 17 L46 30 V22 H4 Z" fill={windColor(abs)} stroke="#0B0F1A" strokeWidth="3" /></svg>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{abs}</span>
        </div>
        <AbilityPair size={52} />
        <button type="button" className={s.tfire} onClick={() => controls.fire()} disabled={!mine} aria-label="Fire"><span className="fd">FIRE</span></button>
      </div>
    </section>
  );
}

export function TabletHud(): JSX.Element {
  const cam = useCameraView();
  return (
    <>
      <HurtVignette />
      <button type="button" className="btn" onClick={() => cameraBus.command({ t: 'focusActive' })} aria-label="Focus camera on the active machine" style={{ position: 'absolute', left: 10, top: 498, width: 52, height: 52 }}><FocusIcon size={24} /></button>
      <span className="hud" style={{ position: 'absolute', left: 72, top: 508, fontSize: 13, fontWeight: 600, padding: '6px 10px', borderRadius: 9, color: '#C9D1E0' }}>{cam.mode === 'follow' ? 'Camera following the shot' : 'Drag to look around'}</span>
      <div style={{ position: 'absolute', left: 10, top: 10, width: 1004, display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <Strip team="red" />
        <TurnPill />
        <Strip team="blue" />
      </div>
      <TurnBanner width={1024} top={200} scale={0.8} />
      <ElimRibbon width={1024} top={300} scale={0.8} />
      <Controls />
      <BattleToast bottom={230} />
      <ArmoryModal />
      <PauseMenu />
      <VictoryOverlay scale={0.75} />
    </>
  );
}
