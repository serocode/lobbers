import type { WeaponDef, WeaponId, WeaponCategory } from '../types.ts';

// The ten launch weapons. Adding a weapon = add an entry here (and a behaviour
// handler in sim/behaviors.ts only if it needs a NEW `behavior.kind`).
// Icons: assets/weapons/<id>.svg (exported from WeaponIcon.dc.html).

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  'standard-rocket': {
    id: 'standard-rocket', name: 'Standard Rocket', category: 'Explosive', icon: 'Explosive', color: '#F5F1E8',
    description: 'The reliable all-rounder. Infinite ammo, honest blast, no surprises.',
    damage: 150, speed: 1, radius: 40, knockback: 6, craterMult: 1, windFactor: 1, gravityFactor: 1,
    ammo: -1, cooldownTurns: 0, behavior: { kind: 'impact' },
  },
  'heavy-bomb': {
    id: 'heavy-bomb', name: 'Heavy Bomb', category: 'Explosive', icon: 'Explosive', color: '#FFB547',
    description: 'A dense, slow round. Wind barely nudges it and terrain does not survive it.',
    damage: 260, speed: 0.85, radius: 58, knockback: 10, craterMult: 1.15, windFactor: 0.35, gravityFactor: 1.15,
    ammo: 3, cooldownTurns: 2, behavior: { kind: 'impact' },
  },
  'cluster-bomb': {
    id: 'cluster-bomb', name: 'Cluster Bomb', category: 'Cluster', icon: 'Cluster', color: '#FF7EB6',
    description: 'Bursts on impact into five bomblets that pepper a wide strip of ground.',
    damage: 70, speed: 1, radius: 26, knockback: 4, craterMult: 0.8, windFactor: 1, gravityFactor: 1,
    ammo: 2, cooldownTurns: 2, behavior: { kind: 'cluster', count: 5, childDamage: 60, childRadius: 28, spreadSpeed: 3.4 },
  },
  'guided-missile': {
    id: 'guided-missile', name: 'Guided Missile', category: 'Guided', icon: 'Guided', color: '#B07CF2',
    description: 'Steers toward the nearest enemy once it starts falling. Strong wind confuses it.',
    damage: 180, speed: 1.05, radius: 34, knockback: 6, craterMult: 0.9, windFactor: 1.2, gravityFactor: 1,
    ammo: 2, cooldownTurns: 3, behavior: { kind: 'guided', turnRate: 0.09, seekRadius: 420 },
  },
  'piercing-drill': {
    id: 'piercing-drill', name: 'Piercing Drill', category: 'Special', icon: 'Drill', color: '#C9A26B',
    description: 'Bores straight through terrain before detonating. Digs enemies out of cover.',
    damage: 230, speed: 1, radius: 36, knockback: 7, craterMult: 1, windFactor: 0.6, gravityFactor: 1,
    ammo: 1, cooldownTurns: 3, behavior: { kind: 'drill', depth: 110, tunnelRadius: 11 },
  },
  'lightning-strike': {
    id: 'lightning-strike', name: 'Lightning Strike', category: 'Electric', icon: 'Electric', color: '#FFE45E',
    description: 'Marks a spot; a bolt drops from the sky and chains to a second machine nearby.',
    damage: 40, speed: 1, radius: 18, knockback: 2, craterMult: 0.5, windFactor: 1, gravityFactor: 1,
    ammo: 2, cooldownTurns: 3,
    behavior: { kind: 'lightning', boltDamage: 170, boltRadius: 30, chainRange: 170, chainDamageMult: 0.5 },
  },
  'fire-bomb': {
    id: 'fire-bomb', name: 'Fire Bomb', category: 'Fire', icon: 'Fire', color: '#FF6B3D',
    description: 'Sticky burning gel. The splash zone keeps burning for two turns.',
    damage: 110, speed: 1, radius: 46, knockback: 4, craterMult: 0.8, windFactor: 1, gravityFactor: 1,
    ammo: 2, cooldownTurns: 2, behavior: { kind: 'fire', zoneRadius: 72, damagePerTurn: 35, turns: 2 },
  },
  'ice-bomb': {
    id: 'ice-bomb', name: 'Ice Bomb', category: 'Ice', icon: 'Ice', color: '#9FE3FF',
    description: 'Freezes everything in a wide radius. Frozen machines cannot move on their next turn.',
    damage: 100, speed: 1, radius: 62, knockback: 2, craterMult: 0.6, windFactor: 1, gravityFactor: 1,
    ammo: 2, cooldownTurns: 3, behavior: { kind: 'ice', freezeTurns: 1 },
  },
  airstrike: {
    id: 'airstrike', name: 'Airstrike', category: 'Special', icon: 'Special', color: '#4C9AFF',
    description: 'Throw a beacon. Five bombs drop in a line across where it lands.',
    damage: 0, speed: 0.9, radius: 0, knockback: 0, craterMult: 0, windFactor: 1, gravityFactor: 1,
    ammo: 1, cooldownTurns: 4, behavior: { kind: 'airstrike', bombs: 5, spacing: 46, bombDamage: 90, bombRadius: 34 },
  },
  'gravity-bomb': {
    id: 'gravity-bomb', name: 'Gravity Bomb', category: 'Special', icon: 'Gravity', color: '#B07CF2',
    description: 'Collapses inward: pulls machines toward the blast and scoops out a deep crater.',
    damage: 140, speed: 1, radius: 50, knockback: 0, craterMult: 1.4, windFactor: 1, gravityFactor: 1,
    ammo: 1, cooldownTurns: 4, behavior: { kind: 'gravity', pullRadius: 170, pullStrength: 9 },
  },
};

export const WEAPON_LIST: WeaponDef[] = Object.values(WEAPONS);

/** Order of tabs in the Armory modal (mockup). */
export const ARMORY_TABS: Array<'All' | WeaponCategory> = ['All', 'Explosive', 'Cluster', 'Guided', 'Electric', 'Fire', 'Ice', 'Special'];

/** Quick-slot keys 1–4 in the combat controls. */
export const DEFAULT_QUICK_SLOTS: WeaponId[] = ['standard-rocket', 'heavy-bomb', 'cluster-bomb', 'ice-bomb'];
