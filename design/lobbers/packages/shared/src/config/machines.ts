import type { MachineDef, MachineId, MachineStats } from '../types.ts';

// The eight battle machines from the mockup (Machines.dc.html / Machine.dc.html).
// Derived numbers come from the stat ratings so balancing stays in one place.

const derive = (s: MachineStats) => ({
  maxHp: s.health * 100 + 100,
  fuel: 60 + s.mobility * 14,
  walkSpeed: 0.9 + s.mobility * 0.12,
  jumpVelocity: 5 + s.mobility * 0.35,
});

const base = (
  id: MachineId, name: string, role: string, color: string, cardBg: string, description: string,
  stats: MachineStats, rest: Pick<MachineDef, 'primaryWeapon' | 'loadout' | 'special' | 'ultimate' | 'barrelPivot'> & Partial<Pick<MachineDef, 'hover' | 'hitRadius' | 'hitHeight'>>,
): MachineDef => ({
  id, name, role, color, cardBg, description, stats, ...derive(stats),
  hitRadius: rest.hitRadius ?? 28, hitHeight: rest.hitHeight ?? 36, hover: rest.hover ?? 0,
  primaryWeapon: rest.primaryWeapon, loadout: rest.loadout, special: rest.special, ultimate: rest.ultimate, barrelPivot: rest.barrelPivot,
});

export const MACHINES: Record<MachineId, MachineDef> = {
  thumper: base('thumper', 'Thumper', 'Heavy Artillery', '#F28C38', '#4A2E1E',
    'A walking siege mortar. Slow to reposition, devastating once it digs in.',
    { health: 9, attack: 9, defense: 7, mobility: 3 }, {
      primaryWeapon: 'heavy-bomb', loadout: ['standard-rocket', 'heavy-bomb', 'piercing-drill', 'cluster-bomb', 'airstrike'],
      special: { id: 'bunker-buster', name: 'Bunker Buster', description: 'Next shot deals 1.6× damage and carves a 50% wider crater.', cooldownTurns: 3, effects: [{ type: 'shotModifier', damageMult: 1.6, radiusMult: 1.5, craterMult: 1.5 }] },
      ultimate: { id: 'siege-barrage', name: 'Siege Barrage', description: 'Fire three Heavy Bombs in a tight fan.', chargeCost: 100, effects: [{ type: 'shotModifier', spread: { count: 3, angleStep: 4, weaponId: 'heavy-bomb' } }] },
      barrelPivot: { x: 64, y: 44 },
    }),
  sprocket: base('sprocket', 'Sprocket', 'Scout', '#5ACB91', '#1E3E33',
    'Twitchy dune buggy with a spring-loaded antenna and twice the fuel of anything else.',
    { health: 5, attack: 6, defense: 4, mobility: 10 }, {
      primaryWeapon: 'standard-rocket', loadout: ['standard-rocket', 'cluster-bomb', 'ice-bomb', 'guided-missile', 'airstrike'],
      special: { id: 'nitro-hop', name: 'Nitro Hop', description: 'Leap 200 px in your facing direction without spending fuel.', cooldownTurns: 2, effects: [{ type: 'hop', distance: 200 }] },
      ultimate: { id: 'afterburner', name: 'Afterburner', description: 'Unlimited fuel this turn and one extra shot.', chargeCost: 100, effects: [{ type: 'unlimitedFuel' }, { type: 'shotModifier', extraShots: 1 }] },
      barrelPivot: { x: 78, y: 54 },
    }),
  mollusk: base('mollusk', 'Mollusk', 'Defender', '#B07CF2', '#33264E',
    'Retreats into a tungsten spiral shell. Teammates love hiding behind it.',
    { health: 10, attack: 5, defense: 10, mobility: 2 }, {
      primaryWeapon: 'standard-rocket', loadout: ['standard-rocket', 'heavy-bomb', 'ice-bomb', 'gravity-bomb', 'fire-bomb'],
      special: { id: 'shell-up', name: 'Shell Up', description: 'You and allies within 140 px take 50% less damage for one round.', cooldownTurns: 4, effects: [{ type: 'shield', reduction: 0.5, radius: 140, rounds: 1 }] },
      ultimate: { id: 'fortress', name: 'Fortress', description: 'Whole team takes 40% less damage for two rounds.', chargeCost: 100, effects: [{ type: 'shield', reduction: 0.4, radius: 5000, rounds: 2 }] },
      barrelPivot: { x: 60, y: 32 }, hitRadius: 32,
    }),
  whirligig: base('whirligig', 'Whirligig', 'Aerial Support', '#4CC3D9', '#1B3A48',
    'Hovers over craters and gaps. Ignores slopes, hates crosswinds.',
    { health: 6, attack: 6, defense: 4, mobility: 8 }, {
      primaryWeapon: 'guided-missile', loadout: ['standard-rocket', 'guided-missile', 'lightning-strike', 'airstrike', 'cluster-bomb'],
      special: { id: 'updraft', name: 'Updraft', description: 'Your shot this turn ignores wind.', cooldownTurns: 3, effects: [{ type: 'shotModifier', ignoreWind: true }] },
      ultimate: { id: 'carpet-run', name: 'Carpet Run', description: 'Next shot calls an Airstrike with no ammo cost.', chargeCost: 100, effects: [{ type: 'shotModifier', spread: { count: 1, angleStep: 0, weaponId: 'airstrike' } }] },
      barrelPivot: { x: 72, y: 64 }, hover: 24,
    }),
  voltaic: base('voltaic', 'Voltaic', 'Electric Control', '#FFD166', '#3E3820',
    'A rolling tesla tower. Its bolts arc between machines standing close together.',
    { health: 6, attack: 8, defense: 5, mobility: 5 }, {
      primaryWeapon: 'lightning-strike', loadout: ['standard-rocket', 'lightning-strike', 'guided-missile', 'cluster-bomb', 'ice-bomb'],
      special: { id: 'overcharge', name: 'Overcharge', description: 'Electric chains hit one extra target this turn.', cooldownTurns: 3, effects: [{ type: 'shotModifier', chainExtraTargets: 1, damageMult: 1.15 }] },
      ultimate: { id: 'thunderdome', name: 'Thunderdome', description: 'Strike every enemy within 320 px for 120 damage.', chargeCost: 100, effects: [{ type: 'strikeEnemies', damage: 120, radius: 320 }] },
      barrelPivot: { x: 72, y: 58 },
    }),
  cinder: base('cinder', 'Cinder', 'Fire Brawler', '#FF6B3D', '#4A221C',
    'A two-legged furnace that leaves the ground burning for two turns.',
    { health: 7, attack: 9, defense: 5, mobility: 6 }, {
      primaryWeapon: 'fire-bomb', loadout: ['standard-rocket', 'fire-bomb', 'heavy-bomb', 'cluster-bomb', 'piercing-drill'],
      special: { id: 'scorched-earth', name: 'Scorched Earth', description: 'Your next impact leaves a burn zone (40/turn, 2 turns).', cooldownTurns: 4, effects: [{ type: 'shotModifier', burn: { radius: 80, damagePerTurn: 40, turns: 2 } }] },
      ultimate: { id: 'eruption', name: 'Eruption', description: 'Fire five Fire Bombs in a wide fan.', chargeCost: 100, effects: [{ type: 'shotModifier', spread: { count: 5, angleStep: 6, weaponId: 'fire-bomb' } }] },
      barrelPivot: { x: 86, y: 42 },
    }),
  frostbite: base('frostbite', 'Frostbite', 'Ice Control', '#9FE3FF', '#1E3A50',
    'An igloo turret on skis. Freezes targets in place and slicks the terrain.',
    { health: 7, attack: 6, defense: 7, mobility: 5 }, {
      primaryWeapon: 'ice-bomb', loadout: ['standard-rocket', 'ice-bomb', 'heavy-bomb', 'guided-missile', 'gravity-bomb'],
      special: { id: 'deep-freeze', name: 'Deep Freeze', description: 'Anything your next shot damages is frozen for one turn.', cooldownTurns: 3, effects: [{ type: 'shotModifier', freezeTurns: 1 }] },
      ultimate: { id: 'absolute-zero', name: 'Absolute Zero', description: 'Freeze every enemy within 360 px and deal 80 damage.', chargeCost: 100, effects: [{ type: 'strikeEnemies', damage: 80, radius: 360, freezeTurns: 1 }] },
      barrelPivot: { x: 78, y: 48 },
    }),
  boomba: base('boomba', 'Boomba', 'Demolition', '#FF7EB6', '#4A2440',
    'A grinning bomb on a unicycle. Every shot is a little bit personal.',
    { health: 6, attack: 10, defense: 3, mobility: 6 }, {
      primaryWeapon: 'cluster-bomb', loadout: ['standard-rocket', 'cluster-bomb', 'heavy-bomb', 'gravity-bomb', 'fire-bomb'],
      special: { id: 'big-fuse', name: 'Big Fuse', description: 'Your next shot leaves a crater three times the normal size.', cooldownTurns: 4, effects: [{ type: 'shotModifier', craterMult: 3, radiusMult: 1.25 }] },
      ultimate: { id: 'mega-boom', name: 'Mega Boom', description: 'Next shot: 2× damage and 2× blast radius.', chargeCost: 100, effects: [{ type: 'shotModifier', damageMult: 2, radiusMult: 2, craterMult: 2 }] },
      barrelPivot: { x: 80, y: 56 },
    }),
};

export const MACHINE_LIST: MachineDef[] = Object.values(MACHINES);
