// Pieces shared by the tablet and phone layouts (BattleTablet.dc.html / BattleMobile.dc.html).
import { MACHINES, type TeamId, type UnitState, type WeaponId } from '@lobbers/shared';
import { ChevronLeft, ChevronRight, ChevronUp, CrownIcon, StarIcon } from '../components';
import { TEAM_COLOR } from '../state/matchStore';
import { useBattle, useCanControl, useDeckUnit, useMatch } from './BattleContext';
import s from './battle.module.css';

/** Short weapon labels used on the tablet/phone weapon buttons (mockup copy). */
export const SHORT: Record<WeaponId, string> = {
  'standard-rocket': 'Rocket', 'heavy-bomb': 'Heavy', 'cluster-bomb': 'Cluster', 'guided-missile': 'Guided', 'piercing-drill': 'Drill',
  'lightning-strike': 'Lightning', 'fire-bomb': 'Fire Bomb', 'ice-bomb': 'Ice Bomb', airstrike: 'Airstrike', 'gravity-bomb': 'Gravity',
};

export function useTeam(team: TeamId): { units: UnitState[]; pct: number; alive: number; col: string } {
  const all = useMatch((v) => v.units);
  const units = all.filter((u) => u.team === team).sort((a, b) => a.id.localeCompare(b.id));
  const hp = units.reduce((n, u) => n + u.hp, 0), max = units.reduce((n, u) => n + u.maxHp, 0);
  return { units, pct: max ? Math.round((hp / max) * 100) : 0, alive: units.filter((u) => u.alive).length, col: TEAM_COLOR[team] };
}

export function MoveButtons({ w, h, gap = 8, iconSize = 22 }: { w: number; h: number; gap?: number; iconSize?: number }): JSX.Element {
  const { controls } = useBattle();
  useMatch((v) => v.units);
  const can = controls.canMove();
  const btn = (dir: -1 | 1): JSX.Element => (
    <button type="button" className="btn" aria-label={dir < 0 ? 'Move left' : 'Move right'} disabled={!can} style={{ width: w, height: h }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); controls.startMove(dir); }}
      onPointerUp={() => controls.stopMove()} onPointerCancel={() => controls.stopMove()} onLostPointerCapture={() => controls.stopMove()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); controls.stepMove(dir); } }}>
      {dir < 0 ? <ChevronLeft size={iconSize} /> : <ChevronRight size={iconSize} />}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap }}>
      {btn(-1)}{btn(1)}
      <button type="button" className="btn" aria-label="Jump" disabled={!controls.canJump()} onClick={() => controls.jump()} style={{ width: w, height: h }}><ChevronUp size={iconSize} /></button>
    </div>
  );
}

/** Special + ultimate as compact circles (DESIGN_SPEC §3.2 style) for touch layouts. */
export function AbilityPair({ size }: { size: number }): JSX.Element | null {
  const { controls, match } = useBattle();
  const mine = useCanControl();
  const u = useDeckUnit();
  const armed = useMatch((v) => v.armed);
  useMatch((v) => v.units);
  if (!u || !match.world) return null;
  const m = MACHINES[u.machine];
  const R = 34, C = 2 * Math.PI * R;
  const one = (slot: 'special' | 'ultimate'): JSX.Element => {
    const sp = slot === 'special';
    const ready = sp ? u.specialCooldown === 0 : u.charge >= (m.ultimate.chargeCost ?? 100);
    const on = armed[slot];
    return (
      <button key={slot} type="button" className={`btn ${on ? s.pulse : ''}`} onClick={() => controls.useAbility(slot)} disabled={!mine || on || !ready} aria-pressed={on}
        aria-label={`${sp ? 'Special' : 'Ultimate'}: ${(sp ? m.special : m.ultimate).name}`} style={{ width: size, height: size, borderRadius: '50%', padding: 0, position: 'relative', background: on ? '#FFD166' : ready ? (sp ? '#F28C38' : '#B07CF2') : '#3B4257' }}>
        {sp ? <StarIcon size={size * 0.5} /> : <CrownIcon size={size * 0.5} />}
        {!sp && <svg aria-hidden="true" width={size + 14} height={size + 14} viewBox="0 0 84 84" style={{ position: 'absolute', left: -10, top: -10, pointerEvents: 'none' }}><circle cx="42" cy="42" r={R} fill="none" stroke="#FFD166" strokeWidth="5" strokeDasharray={`${(C * Math.min(100, u.charge)) / 100} ${C}`} transform="rotate(-90 42 42)" strokeLinecap="round" /></svg>}
        {sp && !ready && <span className="fd" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, color: '#F5F1E8', background: 'rgba(16,21,34,.7)', borderRadius: '50%' }}>{u.specialCooldown}</span>}
      </button>
    );
  };
  return <div style={{ display: 'flex', gap: 8 }}>{one('special')}{one('ultimate')}</div>;
}
