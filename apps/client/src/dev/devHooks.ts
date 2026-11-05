// DEV ONLY (stripped from production builds): lets Playwright drive a hot-seat match through the real
// input path. `aimAtNearest()` picks an aim with the same preview the player sees, then sets it via
// BattleControls; the test presses Space to fire. Nothing here touches authoritative state.
import { MACHINES, WEAPONS, canUseWeapon, predictTrajectory, unitById, type WeaponId } from '@lobbers/shared';
import type { ClientMatch } from '../state/ClientMatch';
import type { BattleControls } from '../state/battleControls';

export interface DevApi { aimAtNearest(prefer?: WeaponId): boolean }

export function installDevHooks(match: ClientMatch, controls: BattleControls): () => void {
  if (!import.meta.env.DEV) return () => undefined;
  const api: DevApi = {
    aimAtNearest(prefer) {
      const w = match.world, id = match.store.getState().activeUnitId;
      if (!w || !id || !controls.enabled) return false;
      const me = unitById(w, id);
      const foe = w.units.filter((u) => u.alive && u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
      if (!foe) return false;
      const kit = MACHINES[me.machine].loadout.filter((x) => canUseWeapon(w, id, x).ok && WEAPONS[x].behavior.kind === 'impact');
      const weaponId = prefer && kit.includes(prefer) ? prefer : kit.sort((a, b) => WEAPONS[b].damage - WEAPONS[a].damage)[0] ?? 'standard-rocket';
      let best = { angle: 45, power: 60 }, bd = Infinity;
      for (const angle of foe.x > me.x ? [40, 55, 70] : [140, 125, 110]) {
        for (let power = 20; power <= 100; power += 1) {
          const r = predictTrajectory(w, id, { angle, power, weaponId });
          if (!r.hit || r.hit.kind === 'out') continue;
          const d = Math.hypot(r.hit.x - foe.x, r.hit.y - (foe.y - 30));
          if (d < bd) { bd = d; best = { angle, power }; }
        }
      }
      controls.selectWeapon(weaponId);
      controls.setAim(best);
      return true;
    },
  };
  (window as unknown as { __lobbersDev?: DevApi }).__lobbersDev = api;
  return () => { delete (window as unknown as { __lobbersDev?: DevApi }).__lobbersDev; };
}
