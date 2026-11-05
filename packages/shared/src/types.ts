// Core typed data structures shared by client and server.
// No runtime code here — only types.

export type TeamId = 'red' | 'blue';
export type MachineId = 'thumper' | 'sprocket' | 'mollusk' | 'whirligig' | 'voltaic' | 'cinder' | 'frostbite' | 'boomba';
export type WeaponId =
  | 'standard-rocket' | 'heavy-bomb' | 'cluster-bomb' | 'guided-missile' | 'piercing-drill'
  | 'lightning-strike' | 'fire-bomb' | 'ice-bomb' | 'airstrike' | 'gravity-bomb';
export type MapId = 'cobalt' | 'ember' | 'glacier' | 'dunes' | 'skyreach' | 'hollow';
/** Armory tab the weapon is listed under (matches the mockup's Armory categories). */
export type WeaponCategory = 'Explosive' | 'Cluster' | 'Guided' | 'Electric' | 'Fire' | 'Ice' | 'Special';
/** Which drawing assets/weapons/<icon>.svg uses (WeaponIcon.dc.html `cat` prop). */
export type WeaponIconId = WeaponCategory | 'Drill' | 'Gravity';

export interface Vec2 { x: number; y: number }

// ---------- Machines ----------
export interface MachineStats {
  /** 1–10 rating shown on the Machine Select bars. */
  health: number;
  attack: number;
  defense: number;
  mobility: number;
}

export type ShotModifier = {
  type: 'shotModifier';
  damageMult?: number;
  radiusMult?: number;
  craterMult?: number;
  ignoreWind?: boolean;
  chainExtraTargets?: number;
  burn?: { radius: number; damagePerTurn: number; turns: number };
  freezeTurns?: number;
  /** Fire N copies of the shot fanned out by angleStep degrees. */
  spread?: { count: number; angleStep: number; weaponId?: WeaponId };
  /** Extra shots allowed this turn after the first resolves. */
  extraShots?: number;
};

export type InstantEffect =
  | { type: 'hop'; distance: number }
  | { type: 'shield'; reduction: number; radius: number; rounds: number }
  | { type: 'strikeEnemies'; damage: number; radius: number; freezeTurns?: number }
  | { type: 'unlimitedFuel' };

export type AbilityEffect = ShotModifier | InstantEffect;

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  /** Special abilities use cooldowns; ultimates use the charge meter (0–100). */
  cooldownTurns?: number;
  chargeCost?: number;
  effects: AbilityEffect[];
}

export interface MachineDef {
  id: MachineId;
  name: string;
  role: string;
  description: string;
  /** Signature body colour used by Machine.dc.html and assets/machines/*. */
  color: string;
  /** Dark stripe background used behind this machine on cards (mockup `bgc`). */
  cardBg: string;
  stats: MachineStats;
  maxHp: number;
  /** Movement fuel per turn (px of horizontal travel). */
  fuel: number;
  walkSpeed: number;
  jumpVelocity: number;
  /** Hit circle radius and centre height above the feet, in world px. */
  hitRadius: number;
  hitHeight: number;
  /** Whirligig hovers this many px above the ground. */
  hover: number;
  primaryWeapon: WeaponId;
  loadout: WeaponId[];
  special: AbilityDef;
  ultimate: AbilityDef;
  /** Barrel pivot in the 120×100 art viewBox — see assets/machines/rig.json. */
  barrelPivot: Vec2;
}

// ---------- Weapons ----------
export type WeaponBehavior =
  | { kind: 'impact' }
  | { kind: 'cluster'; count: number; childDamage: number; childRadius: number; spreadSpeed: number }
  | { kind: 'guided'; turnRate: number; seekRadius: number }
  | { kind: 'drill'; depth: number; tunnelRadius: number }
  | { kind: 'lightning'; boltDamage: number; boltRadius: number; chainRange: number; chainDamageMult: number }
  | { kind: 'fire'; zoneRadius: number; damagePerTurn: number; turns: number }
  | { kind: 'ice'; freezeTurns: number }
  | { kind: 'airstrike'; bombs: number; spacing: number; bombDamage: number; bombRadius: number }
  | { kind: 'gravity'; pullRadius: number; pullStrength: number };

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  icon: WeaponIconId;
  color: string;
  description: string;
  damage: number;
  /** Multiplies launch speed (1 = standard). */
  speed: number;
  radius: number;
  knockback: number;
  /** Terrain removed = radius × craterMult. 0 = no terrain damage. */
  craterMult: number;
  windFactor: number;
  gravityFactor: number;
  /** -1 = infinite. */
  ammo: number;
  cooldownTurns: number;
  behavior: WeaponBehavior;
}

// ---------- Maps ----------
export interface TerrainShape {
  base: number;
  waves: Array<{ amp: number; period: number; phase: number }>;
  /** Gaussian hills; negative height = valley. */
  peaks: Array<{ x: number; height: number; width: number }>;
  /** Open gaps (no ground at all), centre x and width. */
  chasms: Array<{ x: number; width: number }>;
  /** 0 = ground reaches the world bottom. >0 = floating islands this thick (tapering at edges). */
  thickness: number;
}

export interface MapPalette {
  skyTop: string; skyMid: string; skyBot: string; far: string; mid: string; near: string;
  grass: string; grassHi: string; dirt: string; dirtDark: string; rock: string;
  foliage: string; foliageDark: string; trunk: string; fall: string; cloud: string; mote: string; glow: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  /** Short card line (Create Room thumbnails). */
  tagline: string;
  sizeLabel: string;
  width: number;
  height: number;
  terrain: TerrainShape;
  palette: MapPalette;
  /** Explosive barrels and repair crates placed on the surface at these x positions. */
  props: { barrels: number[]; crates: number[] };
  /** Spawn x positions per team, in slot order. */
  spawns: Record<TeamId, number[]>;
  /** Anything that falls below `level` is destroyed (void / lava / icy water). */
  hazard: { kind: 'void' | 'lava' | 'water'; level: number };
  backgroundAsset: string;
}

// ---------- Match settings ----------
export type WindSetting = 'off' | 'calm' | 'variable' | 'wild';
export type GameMode = 'team-deathmatch' | 'capture-the-hill';

export interface MatchSettings {
  mode: GameMode;
  mapId: MapId;
  turnSeconds: 20 | 30 | 45;
  wind: WindSetting;
  friendlyFire: 0 | 0.5 | 1;
  itemsEnabled: boolean;
  bestOf: 1 | 3;
  isPrivate: boolean;
}

// ---------- Simulation state ----------
export interface UnitStatus {
  frozenTurns: number;
  shield: { reduction: number; rounds: number } | null;
  unlimitedFuel: boolean;
}

export interface UnitState {
  id: string;
  playerId: string;
  name: string;
  team: TeamId;
  machine: MachineId;
  x: number;
  /** Feet position (bottom centre). */
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  fuel: number;
  charge: number;
  specialCooldown: number;
  ammo: Partial<Record<WeaponId, number>>;
  weaponCooldowns: Partial<Record<WeaponId, number>>;
  status: UnitStatus;
  stats: MatchStatLine;
}

export interface MatchStatLine {
  damageDealt: number;
  damageReceived: number;
  eliminations: number;
  assists: number;
  shots: number;
  hits: number;
}

export interface PropState { id: string; kind: 'barrel' | 'crate'; x: number; y: number; alive: boolean }

export interface BurnZone { id: number; x: number; y: number; radius: number; damagePerTurn: number; turnsLeft: number; ownerId: string }

export interface AimInput {
  /** 0 = right, 90 = straight up, 180 = left. */
  angle: number;
  /** 0–100. */
  power: number;
  weaponId: WeaponId;
}
