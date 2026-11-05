import type { BurnZone, WeaponId } from '../types.ts';

/** Everything the server broadcasts after resolving an action. Clients animate
 *  these in tick order; they never compute outcomes themselves. */
export type SimEvent =
  | { t: 'explosion'; tick: number; x: number; y: number; radius: number; craterRadius: number; weaponId: WeaponId; color: string }
  | { t: 'carve'; tick: number; x: number; y: number; r: number }
  | { t: 'damage'; tick: number; unitId: string; amount: number; sourceUnitId: string | null; direct: boolean; hpAfter: number; cause: DamageCause }
  | { t: 'status'; tick: number; unitId: string; status: 'frozen' | 'shield' | 'unlimitedFuel'; value: number }
  | { t: 'burnZone'; tick: number; zone: BurnZone }
  | { t: 'bolt'; tick: number; x: number; fromY: number; toY: number; chain: Array<{ x: number; y: number }> }
  | { t: 'unitPath'; startTick: number; unitId: string; points: Array<[number, number]> }
  | { t: 'eliminated'; tick: number; unitId: string; byUnitId: string | null; cause: DamageCause }
  | { t: 'prop'; tick: number; propId: string; change: 'destroyed' | 'exploded' | 'collected' | 'moved'; y?: number; unitId?: string }
  | { t: 'heal'; tick: number; unitId: string; amount: number; hpAfter: number };

export type DamageCause = 'explosion' | 'bolt' | 'fall' | 'hazard' | 'burn' | 'ability' | 'forfeit';

export interface ProjectileTrack {
  id: number;
  weaponId: WeaponId;
  spawnTick: number;
  /** One [x, y] per tick from spawnTick. */
  points: Array<[number, number]>;
  color: string;
}

export interface ShotResult {
  tracks: ProjectileTrack[];
  events: SimEvent[];
  durationTicks: number;
  terrainHash: number;
}
