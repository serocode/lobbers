// Battle sounds driven by the same replay as the scene and HUD, so a boom lands with its explosion.
import { WEAPONS, type ActionResolvedMsg, type WeaponCategory } from '@lobbers/shared';
import type { ClientMatch } from '../state/ClientMatch';
import { isLocal, unitOf } from '../state/matchStore';
import type { ReplayPresenter } from '../state/replay';
import { sfx } from './sfx';

export function createBattleAudio(match: ClientMatch): ReplayPresenter {
  let cat: WeaponCategory | null = null;
  return {
    turnStarted(msg) {
      const v = match.store.getState();
      sfx.turnStart(isLocal(v, unitOf(v, msg.activeUnitId)) && v.localPlayerIds.length === 1);
    },
    actionStart(a: ActionResolvedMsg) {
      if (a.kind !== 'shot' || !('tracks' in a.result) || !a.result.tracks[0]) { cat = null; return; }
      const lead = a.result.tracks[0];
      cat = WEAPONS[lead.weaponId].category;
      sfx.fire(cat);
      sfx.whistle(lead.points.length / 60);
    },
    event(e) {
      switch (e.t) {
        case 'explosion': if (e.radius > 0) sfx.explosion(e.radius, cat ?? 'Barrel'); return;
        case 'bolt': sfx.bolt(); return;
        case 'damage': if (e.cause !== 'burn' && e.cause !== 'hazard') sfx.hit(e.direct); return;
        case 'heal': sfx.heal(); return;
        case 'eliminated': sfx.elimination(); return;
        default:
      }
    },
    matchEnded(m) {
      const v = match.store.getState();
      const mine = v.localPlayerIds.length === 1 ? v.units.find((u) => u.playerId === v.localPlayerIds[0])?.team : undefined;
      sfx.matchEnd(!mine || m.winner === mine);
    },
  };
}
