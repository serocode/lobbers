// Replay → visuals: shells + trails, explosions, craters, bolts, props, damage numbers, unit paths.
import { MACHINES, WEAPONS, type ActionResolvedMsg, type SimEvent, type UnitCosmetics, type WeaponCategory } from '@lobbers/shared';
import type { ReplayPresenter } from '../../state/replay';
import type { BattleScene } from './BattleScene';
import { useSettings } from '../../state/uiStores';

const SUB: Partial<Record<WeaponCategory, string>> = { Ice: 'FROZEN', Fire: 'BURNING', Electric: 'SHOCKED' };
const BARREL_COLOR = '#FF8A3D';

export function createScenePresenter(s: BattleScene): ReplayPresenter {
  let hasDamage = false;
  let missShown = false;
  let shotWeapon: WeaponCategory | null = null;
  let barrels: Array<{ x: number; y: number }> = [];
  let look: UnitCosmetics | undefined;

  const floaterY = (unitId: string): { x: number; y: number } | null => {
    const v = s.unitViews.get(unitId), u = s.unitState(unitId);
    if (!v || !u) return null;
    return { x: v.x, y: v.y - 130 - MACHINES[u.machine].hover };
  };

  return {
    turnStarted: (msg) => {
      s.paths.clear();
      s.director.endIntro();
      const u = s.unitState(msg.activeUnitId);
      if (u) s.director.focusOn(u.x, u.y);
    },

    actionStart: (a: ActionResolvedMsg) => {
      s.paths.clear();
      hasDamage = a.result.events.some((e) => e.t === 'damage' && e.cause !== 'burn');
      missShown = false;
      barrels = [];
      if (a.kind !== 'shot' || !('tracks' in a.result)) { shotWeapon = null; look = undefined; return; }
      look = s.cosmetics(a.unitId);
      shotWeapon = a.result.tracks[0] ? WEAPONS[a.result.tracks[0].weaponId].category : null;
      s.shots.start(a.result.tracks, (track, at) => {
        if (track.weaponId === 'airstrike' && track.spawnTick === 0) s.fx.floater({ x: at[0], y: at[1] - 60, text: 'INCOMING!', size: 28, color: '#4C9AFF' });
      }, look);
      s.director.follow(s.settings().cameraFollow);
    },

    event: (e: SimEvent) => {
      switch (e.t) {
        case 'explosion': {
          if (e.radius <= 0) return;
          const isBarrel = barrels.some((b) => Math.abs(b.x - e.x) < 3 && Math.abs(b.y - e.y) < 3);
          if (isBarrel || !look) s.fx.explosion(e.x, e.y, e.radius, isBarrel ? BARREL_COLOR : e.color);
          else s.fx.explosion(e.x, e.y, e.radius, e.color, look.explosion.style, look.explosion.color);
          s.shake();
          if (isBarrel) s.fx.floater({ x: e.x, y: e.y - 80, text: 'KABOOM!', size: 34, color: BARREL_COLOR });
          else if (shotWeapon && !hasDamage && !missShown) { missShown = true; s.fx.floater({ x: e.x, y: e.y - 70, text: 'MISS', size: 30, color: '#A9B3CC' }); }
          return;
        }
        case 'carve': return s.carve(e.x, e.y, e.r);
        case 'bolt': s.fx.bolt(e.x, e.fromY, e.toY, e.chain); s.shake(); return;
        case 'damage': {
          s.unitViews.get(e.unitId)?.hit();
          const p = floaterY(e.unitId);
          if (!p || !useSettings.getState().damageNumbers) return;
          const big = s.layout.damageFont;
          if (e.cause === 'fall') s.fx.floater({ ...p, y: p.y + 20, text: `-${e.amount}`, size: Math.round(big * 0.78), color: '#C9D1E0', sub: 'FALL' });
          else if (e.cause === 'burn') s.fx.floater({ ...p, text: `-${e.amount}`, size: Math.round(big * 0.83), color: '#FF6B3D', sub: 'BURNING' });
          else if (e.cause === 'hazard') return;
          else s.fx.floater({ ...p, text: `-${e.amount}`, size: e.direct ? Math.round(big * 1.28) : big, color: e.direct ? '#FFD166' : '#F5F1E8', sub: e.direct ? 'DIRECT HIT!' : (shotWeapon && SUB[shotWeapon]) || undefined });
          return;
        }
        case 'heal': {
          const p = floaterY(e.unitId);
          if (p && useSettings.getState().damageNumbers) s.fx.floater({ ...p, text: `+${e.amount}`, size: s.layout.damageFont, color: '#5ACB91', sub: 'REPAIR KIT' });
          return;
        }
        case 'unitPath': s.paths.set(e.unitId, { start: e.startTick, points: e.points }); return;
        case 'eliminated': if (e.cause === 'hazard') s.vanishAfterPath(e.unitId); return;
        case 'prop': {
          if (e.change === 'moved' && e.y !== undefined) s.props.moved(e.propId, e.y);
          else if (e.change !== 'moved') {
            const p = s.props.get(e.propId);
            if (e.change === 'exploded' && p) barrels.push({ x: p.x, y: p.y - 18 });
            s.props.remove(e.propId, e.change);
          }
          return;
        }
        default:
      }
    },

    actionEnd: () => {
      s.paths.clear();
      s.director.hold();
    },
  };
}
