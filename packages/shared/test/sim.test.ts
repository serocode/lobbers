// Run: node --experimental-strip-types --test packages/shared/test/*.test.ts   (Node ≥ 22.6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Terrain, MAPS, MAP_LIST, DEFAULT_SETTINGS, CAMERA, cameraFor, fitZoom, createWorld, createRng, NO_VARIANCE, predictTrajectory, resolveShot,
  advanceTurn, initialTurnState, beginTurn, endTurn, matchWinner, validateFire, commitFire, validateStart, transferHost, generateRoomCode,
  computeResults, walk, jump, activateAbility, unitById, cloneWorld, applyExplosion, settleUnits, inChasm, terrainBottomAt, MACHINES, WEAPONS,
  type World, type SeatInput, type WeaponId, type AimInput, type MachineId, type TeamId, type LobbyPlayer, type ActiveTurn, type MapId, type SimContext,
} from '../src/index.ts';

const seats = (n: number, machines: MachineId[] = ['thumper', 'voltaic', 'cinder', 'sprocket', 'frostbite', 'mollusk', 'whirligig', 'boomba']): SeatInput[] => {
  const out: SeatInput[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ playerId: `pr${i}`, name: `Red${i}`, team: 'red', machine: machines[i % 8], slot: i });
    out.push({ playerId: `pb${i}`, name: `Blue${i}`, team: 'blue', machine: machines[(i + 4) % 8], slot: i });
  }
  return out;
};
const world1v1 = (red: MachineId = 'thumper', blue: MachineId = 'mollusk', mapId: MapId = 'cobalt'): World =>
  createWorld({ ...DEFAULT_SETTINGS, mapId, wind: 'off' }, [{ playerId: 'a', name: 'A', team: 'red', machine: red, slot: 0 }, { playerId: 'b', name: 'B', team: 'blue', machine: blue, slot: 0 }]);
const place = (w: World, id: string, x: number): void => { const u = unitById(w, id); u.x = x; u.y = w.terrain.surfaceBelow(x, 0) ?? 700; };
const loadout = (w: World, id: string, weaponId: WeaponId): void => { unitById(w, id).ammo[weaponId] = 5; };
const ctxOf = (w: World): SimContext => ({ world: w, rng: NO_VARIANCE, events: [], tick: 0 });

/** Scans power at a fixed angle with the PREVIEW until the predicted impact lands near tx. */
function aimAt(w: World, shooterId: string, tx: number, weaponId: WeaponId, angle?: number): AimInput {
  const u = unitById(w, shooterId);
  const a = angle ?? (tx > u.x ? 55 : 125);
  let best: AimInput = { angle: a, power: 60, weaponId }, bd = Infinity;
  for (let p = 10; p <= 100; p += 0.5) {
    const r = predictTrajectory(w, shooterId, { angle: a, power: p, weaponId });
    if (!r.hit || r.hit.kind === 'out') continue;
    const d = Math.abs(r.hit.x - tx);
    if (d < bd) { bd = d; best = { angle: a, power: p, weaponId }; }
  }
  return best;
}

test('terrain: carving removes collision and RLE round-trips', () => {
  const t = Terrain.fromMap(MAPS.cobalt);
  const y = t.surfaceBelow(300, 0)!;
  assert.ok(t.isSolid(300, y + 10));
  assert.ok(t.carveCircle(300, y + 10, 30) > 1500);
  assert.equal(t.isSolid(300, y + 10), false);
  assert.equal(Terrain.decodeRLE(t.width, t.height, t.encodeRLE()).hash(), t.hash());
});

test('all six maps are bigger than the camera and every spawn/prop stands on ground', () => {
  assert.equal(MAP_LIST.length, 6);
  for (const m of MAP_LIST) {
    assert.ok(m.width > CAMERA.viewport.desktop.w && m.height > CAMERA.viewport.desktop.h, `${m.id} scrolls both ways`);
    const t = Terrain.fromMap(m);
    for (const x of [...m.spawns.red, ...m.spawns.blue, ...m.props.barrels, ...m.props.crates]) {
      assert.ok(!inChasm(m.terrain, x), `${m.id} x=${x} not in a chasm`);
      const y = t.surfaceBelow(x, 0);
      assert.ok(y !== null && y < m.hazard.level, `${m.id} x=${x} has ground`);
    }
    const w = createWorld({ ...DEFAULT_SETTINGS, mapId: m.id }, seats(4));
    assert.equal(w.props.length, m.props.barrels.length + m.props.crates.length);
  }
});

test('Skyreach: chasms are open top to bottom and islands float', () => {
  const m = MAPS.skyreach, t = Terrain.fromMap(m);
  for (const c of m.terrain.chasms) assert.equal(t.surfaceBelow(c.x, 0), null);
  const x = 1400, bottom = terrainBottomAt(m.terrain, m.width, m.height, x);
  assert.ok(t.isSolid(x, bottom - 4) && !t.isSolid(x, bottom + 6), 'void below the island');
});

test('camera: focus clamps to the world, overview fits it', () => {
  const view = CAMERA.viewport.desktop, world = MAPS.dunes;
  assert.deepEqual(cameraFor(0, 0, 1, view, world), { x: 0, y: 0 });
  const far = cameraFor(99999, 99999, 1, view, world);
  assert.equal(far.x, world.width - view.w); assert.equal(far.y, world.height - view.h);
  assert.ok(fitZoom(view, world) * world.width <= view.w + 0.001);
});

test('preview uses the same physics as the real shot', () => {
  const w = world1v1();
  w.wind = 7;
  const aim: AimInput = { angle: 48, power: 55, weaponId: 'standard-rocket' };
  const preview = predictTrajectory(w, 'red-0', aim);
  const real = resolveShot(w, 'red-0', aim, [], NO_VARIANCE).tracks[0].points;
  const n = Math.min(preview.points.length, real.length);
  assert.ok(n > 40);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(preview.points[i][0] - real[i][0]) < 0.06 && Math.abs(preview.points[i][1] - real[i][1]) < 0.06, `diverged at tick ${i}`);
});

test('long range: a full-power shot can cross the biggest map', () => {
  const w = world1v1('thumper', 'mollusk', 'dunes'); place(w, 'blue-0', 2900);
  const r = predictTrajectory(w, 'red-0', { angle: 45, power: 100, weaponId: 'standard-rocket' });
  const last = r.points[r.points.length - 1];
  assert.ok(last[0] > 2400, `reached x=${last[0].toFixed(0)}`);
});

test('explosion damages the target and carves terrain at the blast', () => {
  const w = world1v1(); place(w, 'blue-0', 760);
  const hp0 = unitById(w, 'blue-0').hp;
  const res = resolveShot(w, 'red-0', aimAt(w, 'red-0', 760, 'standard-rocket'), [], NO_VARIANCE);
  assert.ok(unitById(w, 'blue-0').hp < hp0);
  const carve = res.events.find((e) => e.t === 'carve');
  assert.ok(carve && carve.t === 'carve' && !w.terrain.isSolid(carve.x, carve.y));
});

test('units fall into craters (ground removed under them)', () => {
  const w = world1v1(); place(w, 'blue-0', 1500);
  const u = unitById(w, 'blue-0'); const y0 = u.y;
  w.terrain.carveCircle(u.x, u.y + 5, 34);
  resolveShot(w, 'red-0', { angle: 100, power: 30, weaponId: 'standard-rocket' }, [], NO_VARIANCE);
  assert.ok(u.y > y0 + 15 && u.alive);
});

test('knockback can throw a machine into a Skyreach chasm (void elimination)', () => {
  const w = world1v1('thumper', 'sprocket', 'skyreach');
  place(w, 'blue-0', 1828);
  const u = unitById(w, 'blue-0');
  const ctx = ctxOf(w);
  applyExplosion(ctx, { x: u.x - 30, y: u.y - 20, damage: 10, radius: 50, craterRadius: 0, knockback: 14, weaponId: 'heavy-bomb', shooterId: 'red-0', directUnitId: null, modifiers: [] });
  settleUnits(ctx);
  assert.equal(u.alive, false);
  assert.ok(ctx.events.some((e) => e.t === 'eliminated' && e.unitId === u.id && e.cause === 'hazard' && e.byUnitId === 'red-0'), 'credited to the shooter');
});

test('wind changes the trajectory', () => {
  const w = world1v1();
  const aim: AimInput = { angle: 55, power: 50, weaponId: 'standard-rocket' };
  w.wind = 0; const calm = predictTrajectory(w, 'red-0', aim).hit!;
  w.wind = 12; const gust = predictTrajectory(w, 'red-0', aim).hit!;
  assert.ok(gust.x > calm.x + 20);
});

const fireAt = (weaponId: WeaponId, tx = 760, red: MachineId = 'thumper') => {
  const w = world1v1(red); place(w, 'blue-0', tx); loadout(w, 'red-0', weaponId);
  return { w, res: resolveShot(w, 'red-0', aimAt(w, 'red-0', tx, weaponId), [], NO_VARIANCE), target: unitById(w, 'blue-0') };
};

test('every weapon has distinct functional behaviour', () => {
  const explosions = (r: ReturnType<typeof fireAt>['res']) => r.events.filter((e) => e.t === 'explosion');
  const cluster = fireAt('cluster-bomb');
  assert.ok(explosions(cluster.res).length >= 4 && cluster.res.tracks.length >= 4, 'cluster');

  const wd = world1v1(); place(wd, 'blue-0', 2140); loadout(wd, 'red-0', 'piercing-drill');
  const drill = resolveShot(wd, 'red-0', aimAt(wd, 'red-0', 700, 'piercing-drill'), [], NO_VARIANCE);
  const boom = drill.events.find((e) => e.t === 'explosion'), entry = drill.events.find((e) => e.t === 'carve');
  assert.ok(boom && boom.t === 'explosion' && entry && entry.t === 'carve' && Math.hypot(boom.x - entry.x, boom.y - entry.y) > 90, 'drill bores before detonating');

  assert.ok(fireAt('lightning-strike').res.events.some((e) => e.t === 'bolt'), 'lightning');
  const fire = fireAt('fire-bomb'); assert.ok(fire.w.burnZones.length === 1, 'fire zone');
  assert.ok(fireAt('ice-bomb').target.status.frozenTurns > 0, 'ice freezes');
  assert.ok(explosions(fireAt('airstrike').res).length >= 4, 'airstrike bombs');

  const wg = world1v1(); place(wg, 'blue-0', 900); loadout(wg, 'red-0', 'gravity-bomb');
  const startX = unitById(wg, 'blue-0').x;
  const g = resolveShot(wg, 'red-0', aimAt(wg, 'red-0', 830, 'gravity-bomb'), [], NO_VARIANCE);
  const ex = g.events.find((e) => e.t === 'explosion');
  assert.ok(ex && ex.t === 'explosion' && Math.abs(unitById(wg, 'blue-0').x - ex.x) < Math.abs(startX - ex.x), 'gravity pulls inward');

  const wm = world1v1(); place(wm, 'blue-0', 800); loadout(wm, 'red-0', 'guided-missile');
  const aimG = aimAt(wm, 'red-0', 680, 'guided-missile', 62);
  const straight = predictTrajectory(wm, 'red-0', aimG).hit!;
  const guided = resolveShot(wm, 'red-0', aimG, [], NO_VARIANCE).events.find((e) => e.t === 'explosion');
  assert.ok(guided && guided.t === 'explosion' && Math.abs(guided.x - 800) < Math.abs(straight.x - 800) - 30, 'guided homes in');

  const heavy = fireAt('heavy-bomb'), std = fireAt('standard-rocket');
  assert.ok(heavy.target.maxHp - heavy.target.hp > std.target.maxHp - std.target.hp);
});

test('interactive props: barrels chain-explode, crates repair', () => {
  const w = world1v1();
  const barrel = w.props.find((p) => p.kind === 'barrel')!;
  place(w, 'blue-0', barrel.x + 40);
  const hp0 = unitById(w, 'blue-0').hp;
  const res = resolveShot(w, 'red-0', aimAt(w, 'red-0', barrel.x - 30, 'heavy-bomb'), [], NO_VARIANCE);
  assert.ok(res.events.some((e) => e.t === 'prop' && e.propId === barrel.id && e.change === 'exploded'));
  assert.ok(res.events.filter((e) => e.t === 'explosion').length >= 2, 'barrel detonated');
  assert.ok(!barrel.alive && unitById(w, 'blue-0').hp < hp0);

  const wc = world1v1('sprocket'); const crate = wc.props.find((p) => p.kind === 'crate')!;
  const me = unitById(wc, 'red-0'); place(wc, 'red-0', crate.x - 30); me.hp = 300;
  const mv = walk(wc, 'red-0', 1, 30, NO_VARIANCE);
  assert.ok(mv.events.some((e) => e.t === 'heal') && me.hp > 300 && !crate.alive);
});

test('movement: walking climbs slopes, spends fuel; jumping lands; frozen units stay put', () => {
  const w = world1v1('sprocket');
  const u = unitById(w, 'red-0');
  const x0 = u.x, fuel0 = u.fuel;
  walk(w, 'red-0', 1, 40, NO_VARIANCE);
  assert.ok(u.x > x0 + 20 && u.fuel < fuel0);
  const jx = u.x; jump(w, 'red-0', NO_VARIANCE); assert.ok(u.x > jx && u.alive);
  u.status.frozenTurns = 1; const fx = u.x; walk(w, 'red-0', 1, 20, NO_VARIANCE); assert.equal(u.x, fx);
});

test('falling out of the world eliminates the unit', () => {
  const w = world1v1();
  const u = unitById(w, 'blue-0');
  for (let y = 0; y < w.map.height; y += 20) w.terrain.carveCircle(u.x, y, 60);
  const res = resolveShot(w, 'red-0', { angle: 10, power: 5, weaponId: 'standard-rocket' }, [], NO_VARIANCE);
  assert.equal(u.alive, false);
  assert.ok(res.events.some((e) => e.t === 'eliminated' && e.unitId === u.id));
});

test('abilities have real effects', () => {
  const w = world1v1('thumper', 'mollusk');
  assert.equal(activateAbility(w, 'red-0', 'special', NO_VARIANCE).modifiers[0].damageMult, 1.6);
  assert.throws(() => activateAbility(w, 'red-0', 'special', NO_VARIANCE));
  activateAbility(w, 'blue-0', 'special', NO_VARIANCE);
  assert.ok(unitById(w, 'blue-0').status.shield);
  const v = world1v1('voltaic', 'mollusk'); place(v, 'blue-0', unitById(v, 'red-0').x + 250); unitById(v, 'red-0').charge = 100;
  const hp = unitById(v, 'blue-0').hp; activateAbility(v, 'red-0', 'ultimate', NO_VARIANCE);
  assert.ok(unitById(v, 'blue-0').hp < hp, 'Thunderdome');
});

test('turns alternate teams, rotate players and skip eliminated/disconnected', () => {
  const w = createWorld(DEFAULT_SETTINGS, seats(3));
  let ts = initialTurnState(); const seen: string[] = [];
  for (let i = 0; i < 6; i++) { const r = advanceTurn(w.units, ts, () => true); ts = r.state; seen.push(r.activeUnitId!); }
  assert.deepEqual(seen, ['red-0', 'blue-0', 'red-1', 'blue-1', 'red-2', 'blue-2']);
  unitById(w, 'red-0').alive = false;
  const r1 = advanceTurn(w.units, ts, (u) => u.id !== 'blue-0'); assert.equal(r1.activeUnitId, 'red-1');
  const r2 = advanceTurn(w.units, r1.state, (u) => u.id !== 'blue-0'); assert.equal(r2.activeUnitId, 'blue-1');
  for (const u of w.units) if (u.team === 'blue' && u.id !== 'blue-0') u.alive = false;
  const r3 = advanceTurn(w.units, r2.state, (u) => u.id !== 'blue-0'); assert.equal(r3.activeUnitId, 'red-2');
  const r4 = advanceTurn(w.units, r3.state, (u) => u.id !== 'blue-0');
  assert.equal(r4.activeUnitId?.startsWith('red'), true); assert.deepEqual(r4.skipped, ['blue-0']);
});

test('intent validation rejects out-of-turn, bad weapons and empty ammo', () => {
  const w = world1v1();
  w.settings = { ...w.settings, itemsEnabled: false };
  const turn: ActiveTurn = { unitId: 'red-0', playerId: 'a', phase: 'acting', shotsLeft: 1, endsAt: 1e15 };
  assert.equal(validateFire(w, turn, 'b', { angle: 45, power: 50, weaponId: 'standard-rocket' }, 0).ok, false);
  assert.equal(validateFire(w, turn, 'a', { angle: 45, power: 50, weaponId: 'ice-bomb' }, 0).ok, false);
  const ok = validateFire(w, turn, 'a', { angle: 400, power: 900, weaponId: 'heavy-bomb' }, 0);
  assert.ok(ok.ok && ok.value.angle === 180 && ok.value.power === 100);
  for (let i = 0; i < 3; i++) commitFire(w, 'red-0', 'heavy-bomb');
  unitById(w, 'red-0').weaponCooldowns = {};
  assert.equal(validateFire(w, turn, 'a', { angle: 45, power: 50, weaponId: 'heavy-bomb' }, 0).ok, false);
});

test('lobby rules', () => {
  const P = (id: string, team: TeamId, slot: number, extra: Partial<LobbyPlayer> = {}): LobbyPlayer => ({ id, name: id, team, slot, machine: 'thumper', ready: true, connected: true, isHost: false, joinedAt: slot, ...extra });
  const host = P('h', 'red', 0, { isHost: true, ready: false });
  assert.equal(validateStart([host], 'h').ok, false);
  assert.equal(validateStart([host, P('x', 'blue', 0)], 'x').ok, false);
  assert.equal(validateStart([host, P('x', 'blue', 0, { ready: false })], 'h').ok, false);
  assert.equal(validateStart([host, P('x', 'blue', 0)], 'h').ok, true);
  assert.equal(validateStart([host, P('a', 'red', 1), P('b', 'red', 2), P('c', 'red', 3), P('d', 'red', 4), P('x', 'blue', 0)], 'h').ok, false);
  assert.equal(transferHost([{ ...host, connected: false }, P('x', 'blue', 0, { joinedAt: 5 }), P('y', 'red', 1, { joinedAt: 2 })]).find((p) => p.isHost)?.id, 'y');
  assert.match(generateRoomCode(createRng(1)), /^LOB-[A-Z2-9]{4}$/);
});

const MATCHES: Array<[number, MapId]> = [[1, 'cobalt'], [2, 'ember'], [3, 'glacier'], [4, 'dunes'], [4, 'skyreach'], [2, 'hollow']];
for (const [n, mapId] of MATCHES) {
  test(`full ${n}v${n} match on ${MAPS[mapId].name} runs to a winner`, () => {
    const rng = createRng(1000 + n + mapId.length);
    const w = createWorld({ ...DEFAULT_SETTINGS, mapId }, seats(n));
    let ts = initialTurnState(); let winner = null;
    for (let turn = 0; turn < 500 && !winner; turn++) {
      const next = advanceTurn(w.units, ts, () => true); ts = next.state;
      const id = next.activeUnitId!;
      beginTurn(w, id, rng);
      const me = unitById(w, id);
      if (me.alive) {
        const foes = w.units.filter((u) => u.alive && u.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
        const tgt = foes[rng.next() < 0.7 ? 0 : rng.int(0, foes.length - 1)];
        const weaponId = MACHINES[me.machine].loadout.find((wid) => (me.ammo[wid] ?? 0) !== 0 && !me.weaponCooldowns[wid] && WEAPONS[wid].damage > 100) ?? 'standard-rocket';
        const aim = aimAt(w, id, tgt.x, weaponId, tgt.x > me.x ? 48 + rng.int(0, 15) : 132 - rng.int(0, 15));
        const v = validateFire(w, { unitId: id, playerId: me.playerId, phase: 'acting', shotsLeft: 1, endsAt: 1e15 }, me.playerId, aim, 0);
        if (v.ok) { commitFire(w, id, aim.weaponId); resolveShot(w, id, v.value, [], rng); }
        endTurn(w, id);
      }
      winner = matchWinner(w.units);
    }
    assert.ok(winner, 'match finished');
    const res = computeResults(w.units, winner!);
    assert.equal(res.filter((r) => r.mvp).length, 1);
    assert.ok(res.filter((r) => r.team !== winner).every((r) => !r.survived));
  });
}

test('items: On = all 10 weapons stocked and usable; Off = the machine loadout only', () => {
  const seat = [{ playerId: 'a', name: 'A', team: 'red' as const, machine: 'thumper' as const, slot: 0 }, { playerId: 'b', name: 'B', team: 'blue' as const, machine: 'mollusk' as const, slot: 0 }];
  const on = createWorld({ ...DEFAULT_SETTINGS, itemsEnabled: true }, seat);
  const off = createWorld({ ...DEFAULT_SETTINGS, itemsEnabled: false }, seat);
  assert.equal(Object.keys(unitById(on, 'red-0').ammo).length, 10);
  assert.deepEqual(Object.keys(unitById(off, 'red-0').ammo).sort(), [...MACHINES.thumper.loadout].sort());
  const turn: ActiveTurn = { unitId: 'red-0', playerId: 'a', phase: 'acting', shotsLeft: 1, endsAt: 1e15 };
  assert.ok(validateFire(on, turn, 'a', { angle: 45, power: 50, weaponId: 'lightning-strike' }, 0).ok, 'Items On: off-loadout weapon allowed');
  const r = validateFire(off, turn, 'a', { angle: 45, power: 50, weaponId: 'lightning-strike' }, 0);
  assert.ok(!r.ok && r.reason === 'weapon not in loadout');
  for (const wd of WEAPONS_ALL()) assert.equal(unitById(on, 'red-0').ammo[wd], WEAPONS[wd].ammo);
});
const WEAPONS_ALL = (): WeaponId[] => Object.keys(WEAPONS) as WeaponId[];

test('all 8 machines: special and ultimate each have an observable effect', () => {
  const ids = Object.keys(MACHINES) as MachineId[];
  for (const id of ids) {
    for (const slot of ['special', 'ultimate'] as const) {
      const w = world1v1(id, 'mollusk');
      const me = unitById(w, 'red-0');
      place(w, 'blue-0', me.x + 260);
      me.charge = 100;
      w.wind = 9; // Updraft only matters in wind
      const foe = unitById(w, 'blue-0');
      const before = { x: me.x, foeHp: foe.hp, shield: !!me.status.shield, fuel: me.status.unlimitedFuel };
      const probe = cloneWorld(w);
      const r = activateAbility(w, 'red-0', slot, NO_VARIANCE);
      const changed = me.x !== before.x || foe.hp !== before.foeHp || !!me.status.shield !== before.shield || me.status.unlimitedFuel !== before.fuel || foe.status.frozenTurns > 0;
      let shotDiffers = false;
      if (r.modifiers.length) {
        const weaponId = MACHINES[id].loadout.find((x) => WEAPONS[x].behavior.kind === 'impact') ?? 'standard-rocket';
        const aim = aimAt(probe, 'red-0', foe.x, weaponId);
        const base = resolveShot(cloneWorld(probe), 'red-0', aim, [], NO_VARIANCE);
        const mod = resolveShot(cloneWorld(probe), 'red-0', aim, r.modifiers, NO_VARIANCE);
        shotDiffers = JSON.stringify(base.events) !== JSON.stringify(mod.events) || base.tracks.length !== mod.tracks.length || r.modifiers.some((m) => (m.extraShots ?? 0) > 0);
      }
      assert.ok(changed || shotDiffers, `${id} ${slot} (${MACHINES[id][slot].name}) has no effect`);
    }
  }
});
