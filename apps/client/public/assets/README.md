# Game art (exported from the approved mockup components)

All SVGs are exact exports of `design/mockup/Machine.dc.html`, `WeaponIcon.dc.html` and `Scene.dc.html`
(SMIL idle animations such as blinking, rotor spin and sparks are preserved for browsers; rasterised textures lose them).

## machines/ (viewBox 120×100, ground line y = 95, facing right)
- `<kind>-red.svg`, `<kind>-blue.svg` — full machine, barrel level (aim 0°)
- `<kind>-red-body.svg`, `<kind>-blue-body.svg` — everything except the barrel
- `<kind>-barrel.svg` — barrel only at 0°; draw it BEHIND the body and rotate it around `rig.json[kind].pivot`
- `<kind>-victory-red.svg` — victory pose (barrel raised, sparkles)
- `rig.json` — `{ kind: { pivot: [x, y], viewBox: [120, 100], groundY: 95 } }`
Team colour lives on one stripe/flag element; skins change the main body colour (`paint` prop in the mockup).
Wreck pose = grayscale(.85) brightness(.65), rotate 9°, + smoke.

## weapons/ (viewBox 64×64)
- `<weapon-id>.svg` for the 10 launch weapons (coloured)
- `icon-<explosive|cluster|guided|electric|fire|ice|special|drill|gravity>.svg` neutral versions for UI chips

## maps/ (viewBox = the map's world size: cobalt 2400×1000, ember 2800×1000, glacier 2600×1050, dunes 3000×1000, skyreach 2800×1100, hollow 2600×1000)
- `<map>-background.svg` — the parallax layer (Scene `layer="back"`): sky, celestial body, far mountains, volcanoes /
  pyramids / mesas / aurora / giant mushrooms, clouds, decorative floating islands, mid/near hills, hazard strip.
  Render with `scrollFactor = CAMERA.parallaxBack` (0.6) behind the destructible terrain; it is authored at world size
  so it still covers the view at 0.6.
- `<map>-full.svg` — reference with the pristine terrain, trees/cacti/mushrooms, rocks and island undersides
  (Scene `layer="all"`). The playable terrain is generated from `config/maps.ts`; use this only to match the look.
- Props (barrels, crates) are drawn by the battle mockup (`Battle.dc.html`, look for `PROPS`) — build them as sprites.
