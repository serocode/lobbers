// Controls deck, left half: player card (portrait, HP, fuel, move + jump) and the weapon block.
import { MACHINES } from '@lobbers/shared';
import { ChevronLeft, ChevronRight, ChevronUp, MachineArt, WeaponIcon } from '../../components';
import { quickSlots } from '../../state/battleControls';
import { TEAM_COLOR, TEAM_DARK } from '../../state/matchStore';
import { useBattleUi } from '../../state/uiStores';
import { useBattle, useCanControl, useDeckUnit, useMatch, weaponInfo } from '../BattleContext';
import s from '../battle.module.css';

/** Hold-to-walk buttons: pointer down starts, up/leave stops (one step on keyboard activation). */
function MoveButton({ dir, disabled }: { dir: -1 | 1; disabled: boolean }): JSX.Element {
  const { controls } = useBattle();
  return (
    <button type="button" className="btn" aria-label={dir < 0 ? 'Move left' : 'Move right'} disabled={disabled} style={{ width: 40, height: 32 }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); controls.startMove(dir); }}
      onPointerUp={() => controls.stopMove()} onPointerCancel={() => controls.stopMove()} onLostPointerCapture={() => controls.stopMove()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); controls.stepMove(dir); } }}>
      {dir < 0 ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}

export function PlayerCard(): JSX.Element {
  const { controls } = useBattle();
  const u = useDeckUnit();
  const mine = useCanControl();
  const angle = useMatch((v) => (u ? v.aim[u.id]?.angle : undefined) ?? 30);
  useMatch((v) => v.units); // re-render on movement / fuel changes
  if (!u) return <div style={{ width: 210 }} />;
  const m = MACHINES[u.machine];
  const fuelPct = u.status.unlimitedFuel ? 100 : Math.round((u.fuel / m.fuel) * 100);
  const frozen = u.status.frozenTurns > 0;
  const facingRight = mine ? angle <= 90 : u.facing > 0;
  const elev = facingRight ? angle : 180 - angle;
  const cantMove = !controls.canMove();
  return (
    <div style={{ width: 210, height: 122, display: 'flex', flexDirection: 'column', gap: 6, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: 8, flex: 'none' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 50, height: 46, flex: 'none', borderRadius: 8, background: TEAM_DARK[u.team], border: '2px solid #FFD166', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MachineArt kind={u.machine} tint={TEAM_COLOR[u.team]} size={46} flip={!facingRight} aim={Math.max(0, Math.min(90, elev))} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span className="fd" style={{ fontSize: 17, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
          <span className="mono" style={{ fontSize: 12, color: '#C9D1E0' }}>HP {u.hp} / {u.maxHp}</span>
        </span>
      </div>
      <span style={{ height: 10, border: '2px solid #0B0F1A', borderRadius: 5, background: '#0E1320', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((u.hp / u.maxHp) * 100)}%`, background: '#5ACB91', transition: 'width .6s' }} /></span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <MoveButton dir={-1} disabled={cantMove} />
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1, whiteSpace: 'nowrap' }}>{frozen ? 'FROZEN' : u.status.unlimitedFuel ? 'FUEL ∞' : `FUEL ${Math.round(u.fuel)}`}</span>
          <span style={{ height: 6, borderRadius: 3, background: '#0E1320', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${fuelPct}%`, background: '#FFD166' }} /></span>
        </span>
        <MoveButton dir={1} disabled={cantMove} />
        <button type="button" className="btn" aria-label="Jump (J)" title="Jump (J)" disabled={!controls.canJump()} onClick={() => controls.jump()} style={{ width: 40, height: 32 }}><ChevronUp /></button>
      </div>
    </div>
  );
}

export function WeaponBlock(): JSX.Element {
  const { controls } = useBattle();
  const u = useDeckUnit();
  const mine = useCanControl();
  const weaponId = useMatch((v) => (u ? v.aim[u.id]?.weaponId : undefined) ?? 'standard-rocket');
  const openArmory = (): void => useBattleUi.getState().set({ armoryOpen: true });
  const w = weaponInfo(weaponId, u);
  const slots = u ? quickSlots(MACHINES[u.machine]) : [];
  return (
    <div style={{ width: 282, height: 122, display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
      <button type="button" className="btn" onClick={openArmory} aria-label="Open armory (W)" style={{ height: 70, justifyContent: 'flex-start', padding: '0 10px', gap: 10, background: '#1C2338' }}>
        <WeaponIcon icon={w.def.icon} color={w.def.color} size={46} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{w.def.name}</span>
          <span className="mono" style={{ fontSize: 11, color: '#C9D1E0', whiteSpace: 'nowrap' }}>DMG {w.dmgTxt} · RAD {w.rad} · <span style={{ color: '#FFD166' }}>×{w.ammoTxt}</span></span>
        </span>
        <span className="mono" style={{ fontSize: 11, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 5, padding: '1px 5px', color: '#A9B3CC' }}>W</span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
        {slots.map((id, i) => {
          const q = weaponInfo(id, u);
          return (
            <button key={id} type="button" className={`btn ${s.qs} ${weaponId === id ? s.on : ''}`} onClick={() => controls.selectWeapon(id)} disabled={!mine || !controls.canUse(id)}
              aria-label={`${q.def.name} (key ${i + 1})`} style={{ height: 44, padding: 0, position: 'relative', background: '#1C2338' }}>
              <WeaponIcon icon={q.def.icon} color={q.def.color} size={28} />
              <span className="mono" style={{ position: 'absolute', left: 3, top: 1, fontSize: 9, color: '#A9B3CC' }}>{i + 1}</span>
              <span className="mono" style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 10, color: '#FFD166' }}>{q.ammoTxt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
