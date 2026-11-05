// Armory (1120×640), Pause menu and the Victory / Defeat overlay (Battle.dc.html).
import { useState } from 'react';
import { ARMORY_TABS, MACHINES, type TeamId, type WeaponCategory, type WeaponId } from '@lobbers/shared';
import { Button, CloseButton, MachineArt, Modal, Switch, WeaponIcon } from '../../components';
import { TEAM_COLOR, arsenalOf } from '../../state/matchStore';
import { useBattleUi, useSettings } from '../../state/uiStores';
import { useBattle, useCanControl, useDeckUnit, useMatch, weaponInfo } from '../BattleContext';
import s from '../battle.module.css';

const CAT_COL: Record<'All' | WeaponCategory, string> = { All: '#F5F1E8', Explosive: '#FFB547', Cluster: '#FF7EB6', Guided: '#B07CF2', Electric: '#FFE45E', Fire: '#FF6B3D', Ice: '#9FE3FF', Special: '#5ACB91' };

export function ArmoryModal(): JSX.Element | null {
  const { controls } = useBattle();
  const ui = useBattleUi();
  const u = useDeckUnit();
  const mine = useCanControl();
  const current = useMatch((v) => (u ? v.aim[u.id]?.weaponId : undefined) ?? 'standard-rocket');
  const [hover, setHover] = useState<WeaponId | null>(null);
  const items = useMatch((v) => v.settings?.itemsEnabled ?? false);
  const arsenal = useMatch((v) => (u ? arsenalOf(v, u).join(',') : '')).split(',').filter(Boolean) as WeaponId[];
  if (!ui.armoryOpen || !u) return null;
  const close = (): void => { setHover(null); ui.set({ armoryOpen: false }); };
  const m = MACHINES[u.machine];
  const list = arsenal.map((id) => weaponInfo(id, u));
  const shown = list.filter((w) => ui.armoryTab === 'All' || w.def.category === ui.armoryTab);
  const usable = (id: WeaponId): boolean => mine && controls.canUse(id);
  const det = weaponInfo(hover ?? current, u);
  const total = det.def.behavior.kind === 'cluster' ? det.def.behavior.count * det.def.behavior.childDamage : det.def.behavior.kind === 'airstrike' ? det.def.behavior.bombs * det.def.behavior.bombDamage : det.def.damage;
  const equip = (id: WeaponId): void => { controls.selectWeapon(id); setTimeout(close, 260); };
  return (
    <Modal label="Armory" onClose={close} style={{ width: 1120, height: 640, padding: 22, display: 'flex', gap: 20 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}><h2 className="fd" style={{ margin: 0, fontSize: 38 }}>ARMORY</h2><span style={{ fontSize: 14, color: '#A9B3CC' }}>{!mine ? 'Browsing — you can equip on your turn' : items ? 'Items: On — full arsenal this match' : `Items: Off — ${m.name} loadout`}</span></div>
          <CloseButton onClick={close} label="Close armory" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ARMORY_TABS.map((t) => (
            <button key={t} type="button" className={`btn ${s.cat} ${ui.armoryTab === t ? s.on : ''}`} onClick={() => ui.set({ armoryTab: t })} aria-pressed={ui.armoryTab === t}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COL[t], border: '2px solid #0B0F1A' }} />{t} <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{t === 'All' ? list.length : list.filter((w) => w.def.category === t).length}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, overflow: 'auto', padding: '4px 4px 8px', alignContent: 'start' }}>
          {shown.map((w) => {
            const cooling = w.cooldown > 0, empty = w.ammo === 0;
            return (
              <button key={w.def.id} type="button" className={`btn ${s.wcard} ${current === w.def.id ? s.on : ''}`} onClick={() => equip(w.def.id)} onMouseEnter={() => setHover(w.def.id)} onFocus={() => setHover(w.def.id)} disabled={cooling || empty || !mine} title={w.def.description}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><WeaponIcon icon={w.def.icon} color={w.def.color} size={54} /><span style={{ fontSize: 11, fontWeight: 700, color: w.def.color }}>{w.def.category}</span></div>
                <span style={{ fontSize: 16 }}>{w.def.name}</span>
                <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '2px 10px', fontSize: 11, color: '#C9D1E0', width: '100%', fontWeight: 500 }}>
                  <span>DMG <b style={{ color: '#F5F1E8' }}>{w.dmgTxt}</b></span><span>RAD <b style={{ color: '#F5F1E8' }}>{w.rad}</b></span>
                  <span>AMMO <b style={{ color: '#FFD166' }}>{w.ammoTxt}</b></span><span>CD <b style={{ color: '#F5F1E8' }}>{w.def.cooldownTurns}t</b></span>
                </div>
                {cooling && <span className="fd" style={{ position: 'absolute', inset: 0, background: 'rgba(16,21,34,.72)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#F5F1E8' }}>COOLDOWN · {w.cooldown} {w.cooldown === 1 ? 'TURN' : 'TURNS'}</span>}
                {empty && <span className="fd" style={{ position: 'absolute', inset: 0, background: 'rgba(16,21,34,.72)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#F45B55' }}>OUT OF AMMO</span>}
              </button>
            );
          })}
        </div>
      </div>
      <aside style={{ width: 300, flex: 'none', background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 150, borderRadius: 10, background: '#1C2338', border: '3px solid #0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 10px,transparent 10px 20px)' }}><WeaponIcon icon={det.def.icon} color={det.def.color} size={120} /></div>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: det.def.color }}>{det.def.category.toUpperCase()}</span>
        <h3 className="fd" style={{ margin: '-8px 0 0', fontSize: 32, lineHeight: 1 }}>{det.def.name}</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: '#C9D1E0' }}>{det.def.description}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 40px', gap: '6px 8px', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#A9B3CC' }}>
          <span>DAMAGE</span><span style={{ height: 10, borderRadius: 5, background: '#1C2338', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.round(total / 3))}%`, background: '#F45B55' }} /></span><span className="mono" style={{ color: '#F5F1E8' }}>{det.dmgTxt}</span>
          <span>RADIUS</span><span style={{ height: 10, borderRadius: 5, background: '#1C2338', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((det.rad / 70) * 100)}%`, background: '#4C9AFF' }} /></span><span className="mono" style={{ color: '#F5F1E8' }}>{det.rad}</span>
          <span>AMMO</span><span /><span className="mono" style={{ color: '#FFD166' }}>{det.ammoTxt}</span>
          <span>COOLDOWN</span><span /><span className="mono" style={{ color: '#F5F1E8' }}>{det.def.cooldownTurns}t</span>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={() => { controls.selectWeapon(det.def.id); close(); }} disabled={!usable(det.def.id) || current === det.def.id} style={{ height: 54, fontSize: 20 }}>
          <span className="fd">{current === det.def.id ? 'EQUIPPED' : usable(det.def.id) ? 'EQUIP' : 'UNAVAILABLE'}</span>
        </Button>
      </aside>
    </Modal>
  );
}

export function PauseMenu(): JSX.Element | null {
  const { nav } = useBattle();
  const ui = useBattleUi();
  const st = useSettings();
  if (!ui.paused) return null;
  const resume = (): void => ui.set({ paused: false, confirmLeave: false });
  return (
    <Modal label={ui.confirmLeave ? 'Surrender?' : 'Paused'} onClose={resume} style={{ width: 440, padding: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ui.confirmLeave ? (
        <>
          <h2 className="fd" style={{ margin: '0 0 6px', fontSize: 40, textAlign: 'center' }}>SURRENDER?</h2>
          <p style={{ margin: 0, color: '#C9D1E0', textAlign: 'center' }}>{nav.surrenderNote}</p>
          <Button variant="danger" onClick={nav.surrender} style={{ height: 56, fontSize: 20 }}><span className="fd">SURRENDER &amp; LEAVE</span></Button>
          <Button onClick={() => ui.set({ confirmLeave: false })} style={{ height: 50, fontSize: 17 }}>Keep playing</Button>
        </>
      ) : (
        <>
          <h2 className="fd" style={{ margin: '0 0 6px', fontSize: 44, textAlign: 'center' }}>PAUSED</h2>
          <Button variant="primary" onClick={resume} style={{ height: 56, fontSize: 20 }}><span className="fd">RESUME</span></Button>
          <Switch label="Trajectory preview" checked={st.trajectoryPreview} onChange={(v) => st.set({ trajectoryPreview: v })} />
          <Switch label="Screen shake" checked={st.screenShake} onChange={(v) => st.set({ screenShake: v })} />
          <Switch label="Camera follows shots" checked={st.cameraFollow} onChange={(v) => st.set({ cameraFollow: v })} />
          <Button onClick={() => ui.set({ confirmLeave: true })} style={{ height: 50, fontSize: 17, background: '#3A2230' }}>Surrender &amp; return home</Button>
        </>
      )}
    </Modal>
  );
}

export function VictoryOverlay({ scale = 1 }: { scale?: number }): JSX.Element | null {
  const { nav } = useBattle();
  const result = useMatch((v) => v.result);
  const units = useMatch((v) => v.units);
  const mineTeam = useMatch((v) => (v.localPlayerIds.length === 1 ? v.units.find((u) => u.playerId === v.localPlayerIds[0])?.team : undefined));
  if (!result) return null;
  const w = result.winner;
  const lost = !!mineTeam && w !== 'draw' && w !== mineTeam;
  const txt = w === 'draw' ? 'DRAW' : lost ? 'DEFEAT' : 'VICTORY!';
  const col = lost ? '#4C9AFF' : '#FFD166';
  const team = (t: TeamId): string => (t === 'red' ? 'Red' : 'Blue');
  const sub = w === 'draw' ? `Both teams wiped out · turn ${result.turns}` : `Team ${team(w)} wins · turn ${result.turns}`;
  const winners = w === 'draw' ? [] : units.filter((u) => u.team === w);
  return (
    <div className="scrim" style={{ flexDirection: 'column', gap: 12 * scale, background: 'rgba(8,11,20,.85)' }} role="dialog" aria-label={txt}>
      <span className={`fd ${s.win}`} style={{ fontSize: 150 * scale, lineHeight: 0.9, color: w !== 'draw' && !mineTeam ? TEAM_COLOR[w] : col, WebkitTextStroke: `${10 * scale}px #0B0F1A`, paintOrder: 'stroke fill', textShadow: `0 ${12 * scale}px 0 #0B0F1A` }}>{txt}</span>
      <span style={{ fontSize: 20 * scale, fontWeight: 700 }}>{sub}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 * scale }}>
        {winners.map((u, i) => <div key={u.id} className={s.vbob} style={{ animationDelay: `${(i * 0.12).toFixed(2)}s` }}><MachineArt kind={u.machine} tint={TEAM_COLOR[u.team]} size={120 * scale} pose={u.alive ? 'victory' : 'wreck'} flip={u.team === 'blue'} /></div>)}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10 * scale }}>
        <Button variant="primary" disabled={!nav.seeResults} title={nav.seeResults ? undefined : nav.resultsReason} onClick={nav.seeResults} style={{ height: 60 * scale, padding: `0 ${30 * scale}px`, fontSize: 22 * scale }}><span className="fd">SEE RESULTS</span></Button>
        <Button disabled={!nav.playAgain} title={nav.playAgain ? undefined : nav.playAgainReason} onClick={nav.playAgain} style={{ height: 60 * scale, padding: `0 ${24 * scale}px`, fontSize: 18 * scale }}>{nav.playAgainLabel}</Button>
        <Button onClick={nav.back} style={{ height: 60 * scale, padding: `0 ${24 * scale}px`, fontSize: 18 * scale }}>{nav.backLabel}</Button>
      </div>
    </div>
  );
}
