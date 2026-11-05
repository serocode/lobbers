// Controls deck, right half: angle dial (0–180°, §3.1), power meter, wind, special + ultimate (§3.2).
import { MACHINES, canActivate } from '@lobbers/shared';
import { CrownIcon, StarIcon } from '../../components';
import { useBattle, useCanControl, useDeckUnit, useMatch } from '../BattleContext';
import s from '../battle.module.css';

export function AngleDial(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const angle = useMatch((v) => (u ? v.aim[u.id]?.angle : undefined) ?? 45);
  const a = (angle * Math.PI) / 180;
  const arc = `M112 58 A52 52 0 0 0 ${(60 + 52 * Math.cos(a)).toFixed(1)} ${(58 - 52 * Math.sin(a)).toFixed(1)}`;
  return (
    <div className={s.ovwrap} style={{ width: 160, height: 122, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: '6px 8px', position: 'relative', flex: 'none' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#A9B3CC' }}>ANGLE <span className="mono">↑↓</span></span>
      <div style={{ position: 'relative', width: 120, height: 62 }}>
        <svg aria-hidden="true" width="120" height="62" viewBox="0 0 120 62">
          <path d="M8 58 A52 52 0 0 1 112 58" fill="none" stroke="#0E1320" strokeWidth="10" />
          {angle > 0 && <path d={arc} fill="none" stroke="#FFD166" strokeWidth="10" />}
          <path d="M8 58 A52 52 0 0 1 112 58" fill="none" stroke="#0B0F1A" strokeWidth="2" />
          <line x1="60" y1="58" x2={(60 + 48 * Math.cos(a)).toFixed(1)} y2={(58 - 48 * Math.sin(a)).toFixed(1)} stroke="#F5F1E8" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="58" r="6" fill="#F45B55" stroke="#0B0F1A" strokeWidth="2" />
        </svg>
        {/* 0° is on the right of the dial, so the range runs right-to-left. */}
        <input className={s.ov} type="range" min={0} max={180} value={angle} dir="rtl" onChange={(e) => controls.setAngle(+e.target.value)} disabled={!mine} aria-label="Firing angle in degrees" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn" aria-label="Lower angle" onClick={() => controls.nudgeAngle(-1)} disabled={!mine} style={{ width: 32, height: 28, fontSize: 18 }}>−</button>
        <span className="mono" style={{ fontSize: 22, fontWeight: 700, width: 54, textAlign: 'center' }}>{angle}°</span>
        <button type="button" className="btn" aria-label="Raise angle" onClick={() => controls.nudgeAngle(1)} disabled={!mine} style={{ width: 32, height: 28, fontSize: 18 }}>+</button>
      </div>
    </div>
  );
}

export function PowerMeter({ width = 230 }: { width?: number }): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const power = useMatch((v) => (u ? v.aim[u.id]?.power : undefined) ?? 60);
  const last = useMatch((v) => (u ? v.lastPower[u.id] : undefined));
  const col = power > 85 ? '#F45B55' : power > 60 ? '#FFB547' : '#FFD166';
  return (
    <div className={s.ovwrap} style={{ width, height: 122, display: 'flex', flexDirection: 'column', gap: 6, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: '8px 10px', flex: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#A9B3CC' }}>POWER <span className="mono">Q / E</span></span><span className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: '#FFD166' }}>{power}</span></div>
      <div style={{ position: 'relative', height: 28, border: '3px solid #0B0F1A', borderRadius: 8, background: '#0E1320', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${power}%`, background: col }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg,transparent 0 23px,rgba(11,15,26,.7) 23px 25px)' }} />
        {last !== undefined && <div title="Last shot" style={{ position: 'absolute', top: -2, bottom: -2, left: `${last}%`, width: 4, background: '#F5F1E8', boxShadow: '0 0 0 2px #0B0F1A' }} />}
        <input className={s.ov} type="range" min={0} max={100} value={power} onChange={(e) => controls.setPower(+e.target.value)} disabled={!mine} aria-label="Shot power" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn" aria-label="Less power" onClick={() => controls.nudgePower(-1)} disabled={!mine} style={{ width: 36, height: 28, fontSize: 18 }}>−</button>
        <span style={{ flex: 1, fontSize: 11, color: '#A9B3CC', textAlign: 'center' }}>{last !== undefined ? `last shot ${last}` : 'drag the meter'}</span>
        <button type="button" className="btn" aria-label="More power" onClick={() => controls.nudgePower(1)} disabled={!mine} style={{ width: 36, height: 28, fontSize: 18 }}>+</button>
      </div>
    </div>
  );
}

export const windColor = (abs: number): string => (abs > 8 ? '#F45B55' : abs > 4 ? '#FFD166' : '#5ACB91');

export function WindGauge({ width = 100 }: { width?: number }): JSX.Element {
  const wind = useMatch((v) => v.wind);
  const abs = Math.abs(wind);
  return (
    <div role="img" aria-label={`Wind ${abs}${wind < 0 ? ' blowing left' : wind > 0 ? ' blowing right' : ''}`} style={{ width, height: 122, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, flex: 'none' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#A9B3CC' }}>WIND</span>
      <svg aria-hidden="true" width="70" height="34" viewBox="0 0 70 34" style={{ transform: `scaleX(${wind < 0 ? -1 : 1})` }}><path d="M4 12 H46 V4 L66 17 L46 30 V22 H4 Z" fill={windColor(abs)} stroke="#0B0F1A" strokeWidth="3" strokeLinejoin="round" /></svg>
      <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{abs}</span>
      <div style={{ display: 'flex', gap: 3 }}>{Array.from({ length: 6 }, (_, i) => <span key={i} style={{ width: 9, height: 6, borderRadius: 2, background: i < Math.ceil(abs / 2) ? (abs > 8 ? '#F45B55' : '#FFD166') : '#2A3045' }} />)}</div>
    </div>
  );
}

/** §3.2: SPECIAL (orange star) + ULTIMATE (purple crown, charge ring), 64 px circles side by side. */
export function Abilities({ size = 64, width = 172 }: { size?: number; width?: number }): JSX.Element {
  const { controls, match } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const armed = useMatch((v) => v.armed);
  useMatch((v) => v.units);
  if (!u) return <div style={{ width }} />;
  const m = MACHINES[u.machine];
  const w = match.world;
  const spReady = !!w && u.specialCooldown === 0;
  const ultReady = u.charge >= (m.ultimate.chargeCost ?? 100);
  const spOk = mine && !!w && canActivate(w, u.id, 'special').ok && !armed.special;
  const ultOk = mine && !!w && canActivate(w, u.id, 'ultimate').ok && !armed.ultimate;
  const R = 34, C = 2 * Math.PI * R;
  const label = (on: boolean, ready: boolean, name: string, wait: string): string => (on ? 'ARMED' : ready ? name.toUpperCase() : wait);
  const circle = (slot: 'special' | 'ultimate'): JSX.Element => {
    const sp = slot === 'special';
    const on = sp ? armed.special : armed.ultimate;
    const ready = sp ? spReady : ultReady;
    const bg = on ? '#FFD166' : ready ? (sp ? '#F28C38' : '#B07CF2') : '#3B4257';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: (width - 8) / 2 }}>
        <button type="button" className={`btn ${on || (!sp && ready && mine) ? s.pulse : ''}`} onClick={() => controls.useAbility(slot)} disabled={!(sp ? spOk : ultOk)} aria-pressed={on}
          aria-label={`${sp ? 'Special' : 'Ultimate'} ability: ${(sp ? m.special : m.ultimate).name}`} style={{ width: size, height: size, borderRadius: '50%', background: bg, position: 'relative', padding: 0 }}>
          {sp ? <StarIcon size={size * 0.5} /> : <CrownIcon size={size * 0.5} />}
          {!sp && (
            <svg aria-hidden="true" width={size + 16} height={size + 16} viewBox="0 0 84 84" style={{ position: 'absolute', left: -11, top: -11, pointerEvents: 'none' }}>
              <circle cx="42" cy="42" r={R} fill="none" stroke="#FFD166" strokeWidth="5" strokeDasharray={`${(C * Math.min(100, u.charge)) / 100} ${C}`} transform="rotate(-90 42 42)" strokeLinecap="round" />
            </svg>
          )}
          {sp && !spReady && <span className="fd" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, color: '#F5F1E8', background: 'rgba(16,21,34,.7)', borderRadius: '50%' }}>{u.specialCooldown}</span>}
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, color: on ? '#FFD166' : '#C9D1E0', maxWidth: (width - 8) / 2 }}>
          {sp ? label(on, spReady, m.special.name, `RECHARGING ${u.specialCooldown}`) : label(on, ultReady, m.ultimate.name, `RECHARGING ${Math.floor(u.charge)}%`)}
        </span>
      </div>
    );
  };
  return (
    <div style={{ width, height: 122, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 'none' }}>
      {circle('special')}
      {circle('ultimate')}
    </div>
  );
}
