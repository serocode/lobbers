// DEV ONLY (stripped from production builds): lets Playwright drive a hot-seat match through the real
// input path. `aimAtNearest()` picks an aim with the same preview the player sees, then sets it via
// BattleControls; the test presses Space to fire. Nothing here touches authoritative state.
import { MACHINES, WEAPONS, canUseWeapon, predictTrajectory, unitById, type MatchIntent, type WeaponId } from '@lobbers/shared';
import type { ClientMatch } from '../state/ClientMatch';
import { lobbyService, useLobby } from '../net/p2p/roomService';
import type { BattleControls } from '../state/battleControls';

export interface DevSnapshot {
  turn: number; wind: number; phase: string; active: string | null; replaying: boolean; result: string | null; mine: boolean;
  hash: { client: number; server: number; checks: number; mismatches: number };
  units: Array<{ id: string; hp: number; alive: boolean; x: number; y: number }>;
  offline: string[];
  /** Room link: joined / reconnecting / closed… and why it closed. */
  link: string;
}

export interface DevApi {
  aimAtNearest(prefer?: WeaponId): boolean;
  /** Immediate view of what this client displays (multiplayer-e2e compares these across contexts). */
  debug(): DevSnapshot;
  /** Sends an intent straight through the transport (used to prove the server rejects forged/out-of-turn intents). */
  sendRaw(intent: MatchIntent): void;
}

export function installDevHooks(match: ClientMatch, controls: BattleControls): () => void {
  if (!import.meta.env.DEV) return () => undefined;
  const api: DevApi = {
    debug() {
      const st = match.store.getState();
      return {
        turn: st.turnNumber, wind: st.wind, phase: st.sync.phase, active: st.activeUnitId, replaying: match.replay.busy, result: st.result?.winner ?? null,
        mine: controls.enabled, hash: st.hash, offline: Object.keys(st.sync.offline),
        link: `peer:${lobbyService.client?.match?.phase ?? '-'}/${lobbyService.client?.ended ? 'ended' : 'no-end'}/acts:${lobbyService.client?.actions.length ?? 0}/feedActs:${match.store.getState().hash.checks} ${useLobby.getState().status}${useLobby.getState().closedReason ? `:${useLobby.getState().closedReason}` : ''}`,
        units: st.units.map((u) => ({ id: u.id, hp: u.hp, alive: u.alive, x: Math.round(u.x), y: Math.round(u.y) })),
      };
    },
    sendRaw(intent) { match.send(intent); },
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
