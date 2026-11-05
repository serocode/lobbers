# Game rules (as implemented in `packages/shared`)

All numbers live in `packages/shared/src/config`. This page explains them; change the config, not this text alone.

## World & physics (60 Hz fixed tick, units = world px)
- World = `map.width × map.height` (see Maps). Terrain = 1-bit mask (`Terrain`), filled from
  `terrainHeightAt(map.terrain, x)` down to `terrainBottomAt` (the floor, or the underside of a floating island);
  columns inside `chasms` are empty.
- Launch: angle 0–180 (0 right, 90 up, 180 left), power 0–100 → speed `power/100 × 26 × weapon.speed` px/tick (45° full power ≈ 2600 px),
  from the muzzle (pivot 52 px above the feet, 30 px along the barrel).
- Each tick: `vx += wind × 0.0035 × windFactor`, `vy += 0.26 × gravityFactor`; movement in ≤4 px sub-steps; collision
  with machines (hit circles) then terrain; out of bounds = 80 px outside the world (left, right, bottom).
- Preview = the same functions (`predictTrajectory`), first 70 ticks shown.

## Damage
`raw = damage × (1 − 0.65 × d / (radius + 36))`, ×1.25 on a direct hit, × attack multiplier `0.85 + attack × 0.03`,
× friendly-fire factor for teammates (0 / 0.5 / 1), × `(1 − defense × 0.025)`, × `(1 − shield)`, × server variance
±5%. Rounded. Explosions also carve `radius × craterMult` and apply knockback `knockback × 1.1 × (1 − d/reach)`.
Gravity bomb pulls instead.

## Maps
| Map | World | Hazard (y) | Feature |
|---|---|---|---|
| Cobalt Crags | 2400×1000 | void 992 | central peak, two barrels in the middle |
| Ember Basin | 2800×1000 | lava 954 | twin ridges around a deep basin |
| Glacier Rift | 2600×1050 | icy water 1004 | tall central glacier |
| Sunscar Dunes | 3000×1000 | void 992 | long, rolling — longest shots |
| Skyreach Isles | 2800×1100 | void 1092 | 3 floating islands (thickness 250) split by chasms at x 860 and 1930 |
| Glowcap Hollow | 2600×1000 | void 992 | two hills, glowing mushroom forest |
Spawns and props per map are in `config/maps.ts`.

## Props
- **Explosive barrel**: destroyed by any explosion that reaches it (`triggerReach` 30 beyond the radius). It detonates
  `chainDelayTicks` (27) later: damage 130, radius 54, crater ×0.7, knockback 7, credited to the shooter; can chain.
- **Repair crate**: a unit walking within 36 px collects it: +150 HP (capped at max). Explosions destroy crates.
- Props fall with the terrain under them; a prop that falls out of the world is removed. Events: `prop`, `heal`.

## Movement & falling
Fuel per turn `60 + mobility × 14`; walk speed `0.9 + mobility × 0.12` px/tick; climbs ≤ 6 px per step, walls stop you,
ledges drop you. Jump costs 12 fuel. Falls over 120 px deal `0.6 × (fall − 120)`. Falling below `hazard.level` (void /
lava / icy water) or off the side = eliminated; credit goes to the last enemy who damaged you within 2 turns.

## Turns
Teams alternate; inside a team, players rotate by slot. Eliminated players are never picked; disconnected players are
skipped (a team with no one able to act is skipped). Start-of-turn upkeep (`beginTurn`): new wind from the setting
range (off 0, calm ±4, variable ±10, wild ±16), refill fuel, tick cooldowns, expire shields, apply burn zones. One shot
per turn (abilities may grant extra). Frozen units cannot move or jump for their next turn. The match ends when one team
has no surviving units (both gone = draw).

## Weapons (launch set)
| Weapon | Behaviour | Dmg | Radius | Ammo | CD |
|---|---|---|---|---|---|
| Standard Rocket | impact | 150 | 40 | ∞ | 0 |
| Heavy Bomb | impact, heavy (low wind, more gravity, bigger crater) | 260 | 58 | 3 | 2 |
| Cluster Bomb | impact + 5 bomblets (60 each) | 70 | 26 | 2 | 2 |
| Guided Missile | homes on nearest enemy while descending | 180 | 34 | 2 | 3 |
| Piercing Drill | bores 110 px through terrain, then detonates | 230 | 36 | 1 | 3 |
| Lightning Strike | small impact + sky bolt (170) + chain (50%) | 40 | 18 | 2 | 3 |
| Fire Bomb | impact + burn zone 35/turn × 2 | 110 | 46 | 2 | 2 |
| Ice Bomb | impact + freeze 1 turn | 100 | 62 | 2 | 3 |
| Airstrike | beacon → 5 bombs (90) across the landing point | — | 34 | 1 | 4 |
| Gravity Bomb | pulls machines in, crater ×1.4 | 140 | 50 | 1 | 4 |

## Machines
| Machine | HP | ATK | DEF | MOB | Special | Ultimate |
|---|---|---|---|---|---|---|
| Thumper | 1000 | 9 | 7 | 3 | Bunker Buster (1.6× dmg, wider crater) | Siege Barrage (3 Heavy Bombs) |
| Sprocket | 600 | 6 | 4 | 10 | Nitro Hop (200 px leap) | Afterburner (∞ fuel + extra shot) |
| Mollusk | 1100 | 5 | 10 | 2 | Shell Up (−50% dmg nearby allies, 1 round) | Fortress (−40% team, 2 rounds) |
| Whirligig | 700 | 6 | 4 | 8 | Updraft (ignore wind) | Carpet Run (free Airstrike) |
| Voltaic | 700 | 8 | 5 | 5 | Overcharge (+1 chain, +15%) | Thunderdome (120 to enemies ≤320 px) |
| Cinder | 800 | 9 | 5 | 6 | Scorched Earth (burn zone on impact) | Eruption (5 Fire Bombs) |
| Frostbite | 800 | 6 | 7 | 5 | Deep Freeze (hits freeze) | Absolute Zero (freeze + 80 ≤360 px) |
| Boomba | 700 | 10 | 3 | 6 | Big Fuse (3× crater) | Mega Boom (2× dmg, 2× radius) |
Ultimate charge: +0.12 per damage dealt, +0.06 per damage taken, max 100.

## Rewards
XP = `120 + 0.12 × damage + 40 × elims + 15 × assists`, ×1.5 on a win, +100 MVP. Coins = `50 + 25 × elims (+100 win)`.
MVP = highest `damage + 300 × elims + 120 × assists`. Level curve `4000 + 147 × level` XP per level.
