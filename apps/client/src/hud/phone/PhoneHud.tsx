// Phone landscape battle HUD (BattleMobile.dc.html, 844×390; the field is the whole screen at zoom 0.55).
import { useRef } from 'react';
import { MACHINES, type TeamId, type WeaponId } from '@lobbers/shared';
import { CloseButton, FocusIcon, MachineArt, MoreIcon, PauseIcon, WeaponIcon } from '../../components';
import { cameraBus } from '../../state/cameraBus';
import { TEAM_DARK, arsenalOf, canControl, unitOf } from '../../state/matchStore';
import { useBattleUi } from '../../state/uiStores';
import { useBattle, useCanControl, useDeckUnit, useMatch, useTurnSeconds, weaponInfo } from '../BattleContext';
import { BattleToast, ElimRibbon, HurtVignette, TurnBanner } from '../Overlays';
import { AbilityPair, MoveButtons, SHORT, useTeam } from '../compact';
import { PauseMenu, VictoryOverlay } from '../desktop/Modals';
import { EmoteButton, EmoteWheel } from '../EmoteWheel';
import { timerColor } from '../../components/controls';
import s from '../battle.module.css';

function Mini({ team }: { team: TeamId }): JSX.Element {
  const t = useTeam(team);
  const active = useMatch((v) => v.activeUnitId);
  return (
    <div className="hud" aria-label={`Team ${team === 'red' ? 'Red' : 'Blue'}`} style={{ display: 'flex', gap: 3, padding: 3, border: '2px solid #0B0F1A', borderRadius: 10 }}>
      {t.units.map((u) => (
        <span key={u.id} style={{ width: 30, height: 36, borderRadius: 6, background: TEAM_DARK[team], border: `2px solid ${u.id === active && u.alive ? '#FFD166' : '#0B0F1A'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', opacity: u.alive ? 1 : 0.45 }}>
          <MachineArt kind={u.machine} tint={t.col} size={26} flip={team === 'blue'} />
          <span style={{ width: 22, height: 4, background: '#0E1320', borderRadius: 2, overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((u.hp / u.maxHp) * 100)}%`, background: t.col }} /></span>
        </span>
      ))}
    </div>
  );
}

function TopBar(): JSX.Element {
  const secs = useTurnSeconds();
  const wind = useMatch((v) => v.wind);
  const mine = useMatch(canControl);
  const act = useMatch((v) => unitOf(v, v.activeUnitId));
  const hotseat = useMatch((v) => v.localPlayerIds.length > 1);
  const title = mine && !hotseat ? 'YOUR TURN' : (act?.name ?? '').toUpperCase();
  return (
    <div style={{ position: 'absolute', left: 8, top: 8, width: 828, display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn" aria-label="Pause" onClick={() => useBattleUi.getState().set({ paused: true })} style={{ width: 44, height: 44, padding: 0 }}><PauseIcon size={16} /></button>
      <Mini team="red" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div className="hud" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', border: '2px solid #0B0F1A', borderRadius: 10 }}>
          <span className="fd" style={{ fontSize: 18, color: mine && !hotseat ? '#FFD166' : act?.team === 'blue' ? '#4C9AFF' : '#F45B55', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700, background: '#0E1320', borderRadius: 6, padding: '0 6px', color: timerColor(secs) }}>{secs}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 700 }}><svg aria-hidden="true" width="22" height="12" viewBox="0 0 70 34" style={{ transform: `scaleX(${wind < 0 ? -1 : 1})` }}><path d="M4 12 H46 V4 L66 17 L46 30 V22 H4 Z" fill="#FFD166" stroke="#0B0F1A" strokeWidth="4" /></svg><span className="mono">{Math.abs(wind)}</span></span>
        </div>
      </div>
      <Mini team="blue" />
    </div>
  );
}

/** Drag-to-aim pad: direction = angle (left/right picks the facing), distance = power. Never pans. */
function AimPad(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const aim = useMatch((v) => (u ? v.aim[u.id] : undefined));
  const drag = useRef(false);
  const angle = aim?.angle ?? 45, power = aim?.power ?? 60;
  const a = (angle * Math.PI) / 180, R = 56 * (power / 100);
  const knob = { x: 63 + Math.cos(a) * R, y: 63 - Math.sin(a) * R };
  const from = (e: React.PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = r.top + r.height / 2 - e.clientY;
    const rad = (r.width / 2) * 0.86;
    const elev = Math.max(0, Math.min(90, Math.round((Math.atan2(Math.max(0, dy), Math.abs(dx)) * 180) / Math.PI)));
    controls.setAim({ angle: dx < 0 ? 180 - elev : elev, power: Math.max(5, Math.min(100, Math.round((Math.hypot(dx, Math.max(0, dy)) / rad) * 100))) });
  };
  return (
    <div style={{ position: 'absolute', left: 568, top: 212, width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span className="hud mono" style={{ fontSize: 14, fontWeight: 700, padding: '1px 8px', border: '2px solid #0B0F1A', borderRadius: 10 }}>{angle}° · <span style={{ color: '#FFD166' }}>{power}</span></span>
      <div className={s.pad} role="slider" aria-label="Aim pad: drag to set angle and power" aria-valuetext={`${angle} degrees, power ${power}`} aria-valuenow={power} tabIndex={0}
        onPointerDown={(e) => { if (!mine) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = true; from(e); }}
        onPointerMove={(e) => { if (drag.current) { e.stopPropagation(); from(e); } }}
        onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') controls.nudgePower(2); else if (e.key === 'ArrowDown') controls.nudgePower(-2); else if (e.key === 'ArrowLeft') controls.nudgeAngle(1); else if (e.key === 'ArrowRight') controls.nudgeAngle(-1); }}
        style={{ width: 132, height: 132, borderRadius: '50%', background: 'rgba(16,21,34,.7)', border: '3px solid #0B0F1A', position: 'relative', opacity: mine ? 1 : 0.6 }}>
        <svg aria-hidden="true" width="126" height="126" viewBox="0 0 126 126" style={{ position: 'absolute', left: 0, top: 0 }}>
          <circle cx="63" cy="63" r="56" fill="none" stroke="#F5F1E8" strokeWidth="2" strokeDasharray="4 6" opacity=".5" />
          <circle cx="63" cy="63" r="28" fill="none" stroke="#F5F1E8" strokeWidth="1.5" opacity=".3" />
          <line x1="63" y1="63" x2={knob.x.toFixed(1)} y2={knob.y.toFixed(1)} stroke="#FFD166" strokeWidth="4" strokeLinecap="round" />
          <circle cx="63" cy="63" r="5" fill="#F5F1E8" />
          <circle cx={knob.x.toFixed(1)} cy={knob.y.toFixed(1)} r="15" fill="#FFD166" stroke="#0B0F1A" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

/** Bottom sheet with every weapon this unit can use (phone "More"; tablet "More" when the arsenal exceeds its row). */
export function WeaponSheet(): JSX.Element | null {
  const { controls } = useBattle();
  const open = useBattleUi((x) => x.sheetOpen), set = useBattleUi((x) => x.set);
  const u = useDeckUnit();
  const current = useMatch((v) => (u ? v.aim[u.id]?.weaponId : undefined));
  const arsenal = useMatch((v) => (u ? arsenalOf(v, u).join(',') : '')).split(',').filter(Boolean) as WeaponId[];
  if (!open || !u) return null;
  const close = (): void => set({ sheetOpen: false });
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,20,.6)', display: 'flex', alignItems: 'flex-end', zIndex: 40 }} onClick={close}>
      <div className={s.sheet} role="dialog" aria-label="Weapons" onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#151B2B', borderTop: '4px solid #0B0F1A', borderRadius: '16px 16px 0 0', padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="fd" style={{ fontSize: 22 }}>WEAPONS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><AbilityPair size={44} /><CloseButton onClick={close} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8 }}>
          {arsenal.map((id) => {
            const w = weaponInfo(id, u), on = current === id;
            return (
              <button key={id} type="button" className={`btn ${s.wb} ${on ? s.on : ''}`} disabled={!controls.canUse(id)} onClick={() => { controls.selectWeapon(id); close(); }} style={{ height: 86, flexDirection: 'column', gap: 2, padding: 0 }}>
                <WeaponIcon icon={w.def.icon} color={w.def.color} size={40} /><span style={{ fontSize: 12 }}>{SHORT[id]}</span><span className="mono" style={{ fontSize: 11, color: '#FFD166' }}>{w.ammo < 0 ? '∞' : `×${w.ammo}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BottomLeft(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const current = useMatch((v) => (u ? v.aim[u.id]?.weaponId : undefined));
  const quick = useMatch((v) => (u ? arsenalOf(v, u).slice(0, 3).join(',') : '')).split(',').filter(Boolean) as WeaponId[];
  return (
    <div style={{ position: 'absolute', left: 10, top: 318, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <MoveButtons w={52} h={60} />
      <span style={{ width: 2 }} />
      {quick.map((id) => {
        const w = weaponInfo(id, u), on = current === id;
        return (
          <button key={id} type="button" className={`btn ${s.wb} ${on ? s.on : ''}`} onClick={() => controls.selectWeapon(id)} aria-label={w.def.name} aria-pressed={on} disabled={!mine || !controls.canUse(id)} style={{ width: 64, height: 64, flexDirection: 'column', position: 'relative', padding: 0 }}>
            <WeaponIcon icon={w.def.icon} color={w.def.color} size={38} /><span className="mono" style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 11, color: '#FFD166' }}>{w.ammo < 0 ? '∞' : `×${w.ammo}`}</span>
          </button>
        );
      })}
      <button type="button" className="btn" onClick={() => useBattleUi.getState().set({ sheetOpen: true })} aria-label="All weapons and abilities" style={{ width: 64, height: 64, flexDirection: 'column', fontSize: 11, padding: 0 }}><MoreIcon />More</button>
      <button type="button" className="btn" onClick={() => cameraBus.command({ t: 'focusActive' })} aria-label="Focus camera on the active machine" style={{ width: 48, height: 48, padding: 0 }}><FocusIcon /></button>
      <EmoteButton size={48} />
    </div>
  );
}

export function PhoneHud(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  return (
    <>
      <HurtVignette />
      <TopBar />
      <TurnBanner width={844} top={110} scale={0.55} />
      <ElimRibbon width={844} top={160} scale={0.55} />
      <BottomLeft />
      <AimPad />
      <button type="button" className={`fd ${s.firec}`} aria-label="Fire" onClick={() => controls.fire()} disabled={!mine} style={{ position: 'absolute', left: 730, top: 280 }}>FIRE</button>
      <BattleToast bottom={110} />
      <WeaponSheet />
      <EmoteWheel layout="phone" />
      <PauseMenu />
      <VictoryOverlay scale={0.42} />
    </>
  );
}

