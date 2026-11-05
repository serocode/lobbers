import type { BurnZone, MachineId, MapDef, MatchSettings, PropState, TeamId, UnitState, WeaponId } from '../types.ts';
import { MACHINES } from '../config/machines.ts';
import { WEAPONS } from '../config/weapons.ts';
import { MAPS } from '../config/maps.ts';
import { Terrain } from './terrain.ts';

export interface World {
  map: MapDef;
  terrain: Terrain;
  units: UnitState[];
  /** Signed wind strength; positive blows right. */
  wind: number;
  burnZones: BurnZone[];
  /** Explosive barrels and repair crates (interactive battlefield objects). */
  props: PropState[];
  settings: MatchSettings;
  nextId: number;
  turnNumber: number;
  /** victimId → attackerId → turn of last damage (for assists). */
  recentDamage: Record<string, Record<string, number>>;
}

export interface SeatInput { playerId: string; name: string; team: TeamId; machine: MachineId; slot: number }

export function createUnit(seat: SeatInput, x: number, y: number): UnitState {
  const m = MACHINES[seat.machine];
  const ammo: Partial<Record<WeaponId, number>> = {};
  for (const id of m.loadout) ammo[id] = WEAPONS[id].ammo;
  return {
    id: `${seat.team}-${seat.slot}`, playerId: seat.playerId, name: seat.name, team: seat.team, machine: seat.machine,
    x, y, vx: 0, vy: 0, hp: m.maxHp, maxHp: m.maxHp, alive: true, facing: seat.team === 'red' ? 1 : -1,
    fuel: m.fuel, charge: 0, specialCooldown: 0, ammo, weaponCooldowns: {},
    status: { frozenTurns: 0, shield: null, unlimitedFuel: false },
    stats: { damageDealt: 0, damageReceived: 0, eliminations: 0, assists: 0, shots: 0, hits: 0 },
  };
}

export function createWorld(settings: MatchSettings, seats: SeatInput[], terrain?: Terrain): World {
  const map = MAPS[settings.mapId];
  const t = terrain ?? Terrain.fromMap(map);
  const units = seats.map((seat) => {
    const x = map.spawns[seat.team][seat.slot] ?? map.width / 2;
    const y = t.surfaceBelow(x, 0) ?? map.height - 1;
    return createUnit(seat, x, y);
  });
  const props: PropState[] = [
    ...map.props.barrels.map((x, i) => ({ id: `barrel-${i}`, kind: 'barrel' as const, x, y: t.surfaceBelow(x, 0) ?? map.height, alive: true })),
    ...map.props.crates.map((x, i) => ({ id: `crate-${i}`, kind: 'crate' as const, x, y: t.surfaceBelow(x, 0) ?? map.height, alive: true })),
  ];
  return { map, terrain: t, units, wind: 0, burnZones: [], props, settings, nextId: 1, turnNumber: 0, recentDamage: {} };
}

export function unitById(world: World, id: string): UnitState {
  const u = world.units.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown unit ${id}`);
  return u;
}

/** Centre of the unit's hit circle. */
export function hitCenter(u: UnitState): { x: number; y: number; r: number } {
  const m = MACHINES[u.machine];
  return { x: u.x, y: u.y - m.hitHeight - m.hover, r: m.hitRadius };
}

export function isGrounded(world: World, u: UnitState): boolean {
  const half = MACHINES[u.machine].hitRadius * 0.6;
  return world.terrain.isSolid(u.x, u.y + 1) || world.terrain.isSolid(u.x - half, u.y + 1) || world.terrain.isSolid(u.x + half, u.y + 1);
}

/** Deep copy for previews / what-if simulation without touching authoritative state. */
export function cloneWorld(w: World): World {
  return { ...w, terrain: w.terrain.clone(), units: w.units.map((u) => structuredClone(u)), burnZones: w.burnZones.map((z) => ({ ...z })), props: w.props.map((p) => ({ ...p })), recentDamage: structuredClone(w.recentDamage) };
}
