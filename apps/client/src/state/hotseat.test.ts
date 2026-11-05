import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MACHINES, WEAPONS, canUseWeapon, predictTrajectory, unitById, type AimInput, type ServerMessage, type World } from '@lobbers/shared';
import { LocalMatchController } from '../net/local/LocalMatchController';
import { ClientMatch } from './ClientMatch';
import { decodeLocalConfig, seatsFor, settingsFor } from './localMatchConfig';

/** Picks the preview aim that lands closest to the nearest enemy (uses the client mirror world). */
function aimAtNearest(w: World, id: string): AimInput | null {
  const me = unitById(w, id);
  const foe = w.units.filter((u) => u.alive && u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
  if (!foe) return null;
  const usable = MACHINES[me.machine].loadout.filter((id) => canUseWeapon(w, me.id, id).ok && WEAPONS[id].behavior.kind === 'impact');
  const weaponId = usable.sort((a, b) => WEAPONS[b].damage - WEAPONS[a].damage)[0] ?? 'standard-rocket';
  let best: AimInput = { angle: 45, power: 60, weaponId }, bd = Infinity;
  const angle = foe.x > me.x ? 55 : 125;
  for (let p = 20; p <= 100; p += 1) {
    const r = predictTrajectory(w, id, { angle, power: p, weaponId });
    if (!r.hit || r.hit.kind === 'out') continue;
    const d = Math.hypot(r.hit.x - foe.x, r.hit.y - (foe.y - 30));
    if (d < bd) { bd = d; best = { angle, power: p, weaponId }; }
  }
  return best;
}

describe('hot-seat match (LocalMatchController → ClientMatch)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('plays a 2v2 to victory with identical terrain hashes and rejects out-of-phase intents', async () => {
    const cfg = decodeLocalConfig(new URLSearchParams('map=cobalt&red=thumper,boomba&blue=cinder,voltaic&wind=off&turn=45&seed=7'));
    const ctrl = new LocalMatchController({ settings: settingsFor(cfg), seats: seatsFor(cfg), seed: cfg.seed, introDelayMs: 0 });
    const match = new ClientMatch(ctrl);
    const seen: ServerMessage['t'][] = [];
    const rejected: string[] = [];
    ctrl.subscribe({ message: (m) => { seen.push(m.t); if (m.t === 'rejected') rejected.push(m.reason); }, state: () => undefined });
    match.start(false);
    const step = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(100); match.replay.advance(100); };
    const ready = (): boolean => { const v = match.store.getState(); return !!v.result || (v.sync.phase === 'acting' && !match.replay.busy && !!v.activeUnitId); };
    const until = async (cond: () => boolean, maxMs = 20_000): Promise<void> => { for (let t = 0; t < maxMs && !cond(); t += 100) await step(); };
    let turns = 0;
    while (!match.store.getState().result && turns < 120) {
      await until(ready);
      const v = match.store.getState();
      if (v.result || !match.world || !v.activeUnitId) break;
      const aim = aimAtNearest(match.world, v.activeUnitId);
      if (!aim) break;
      turns++;
      match.send({ t: 'fire', aim });
      await step();
      match.send({ t: 'fire', aim: { angle: 45, power: 50, weaponId: 'standard-rocket' } }); // while resolving → rejected
      await until(() => match.store.getState().sync.phase !== 'resolving');
    }
    await until(() => !!match.store.getState().result);
    const v = match.store.getState();
    expect(v.result?.winner === 'red' || v.result?.winner === 'blue').toBe(true);
    expect(v.hash.checks).toBeGreaterThan(turns);
    expect(v.hash.mismatches).toBe(0);
    expect(rejected).toContain('not accepting actions');
    expect(seen).toContain('matchEnded');
    expect(v.log.length).toBeGreaterThan(0);
    match.dispose();
  }, 120_000);
});
