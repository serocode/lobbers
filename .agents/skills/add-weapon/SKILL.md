---
name: add-weapon
description: Add or rebalance a weapon through config and behaviour registration only, with tests and an icon in the house art style.
---

# Add a weapon

1. Add the id to `WeaponId` in `packages/shared/src/types.ts`.
2. Add a `WeaponDef` in `packages/shared/src/config/weapons.ts` (damage, speed, radius, knockback, craterMult,
   windFactor, gravityFactor, ammo, cooldownTurns, behavior). Pick an existing `behavior.kind` if possible.
3. New behaviour only if needed: add the variant to `WeaponBehavior` and `registerBehavior(kind, handler)` in
   `sim/behaviors.ts` (hooks: `steer`, `skipForces`, `passTerrain`, `postMove`, `onHit`). Do **not** edit `shot.ts`.
4. Put it in machine loadouts in `config/machines.ts` as wanted.
5. Icon: add a branch to `design/mockup/WeaponIcon.dc.html` style (64×64 viewBox, 3 px `#151B2B` strokes, flat fill in
   the weapon colour, white 50% highlight) and export `apps/client/public/assets/weapons/<id>.svg` (render the component in a browser and save the inner <svg>).
6. Tests in `packages/shared/test/`: prove the behaviour is distinct (event types, positions, statuses). Run
   `pnpm test:core`.
7. The Armory and quick slots are data-driven — confirm the weapon appears in the right tab with correct stats.
