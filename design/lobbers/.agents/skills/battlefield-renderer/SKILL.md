---
name: battlefield-renderer
description: Build or change the Phaser battlefield (Gunbound camera, parallax maps, terrain texture, props, machines with rotating barrels, projectiles, explosions) so it matches Battle.dc.html and replays the host's events. Use for any work in apps/client/src/game.
---

# Battlefield renderer (Phaser 3)

**Phaser draws; `@lobbers/shared` decides.** No Phaser physics bodies drive gameplay.

## Scene layout (world = map.width × map.height: 2400–3000 × 1000–1100 — bigger than the screen)
0. **Camera** — values from `CAMERA` in `packages/shared/src/config/camera.ts`; the mockup (`Battle.dc.html`) is the
   reference behaviour (screenshots `04-battle`, `04c`, `04d`, `04e`, `04h`, `04i`).
   - Main camera viewport = the field area (desktop 1440×750 above the deck; tablet 1024×560 at zoom 0.8; phone 844×390
     at 0.55). `cameras.main.setBounds(0, 0, map.width, map.height)`; use `cameraFor()` / `fitZoom()` from shared so
     the client matches the spec exactly.
   - A small `CameraDirector` owns the mode: `intro | focus | follow | hold | free | overview`.
     - intro: `zoomTo(fitZoom)` for `introOverviewMs`, then focus.
     - focus (on `turnStarted` and after hold): `pan(x, y − focusAboveUnit, panMs, 'Cubic.easeInOut')` to the active unit.
     - follow (when the `actionResolved` replay starts): `startFollow(shellSprite, true, lerp, lerp)` with
       lerp ≈ `followLerp` scaled to 60 fps (≈0.12); multiple tracks → follow an invisible sprite at the lead shell.
     - hold: `stopFollow()` at the last explosion, shake, wait `holdOnImpactMs` (barrel chains, falls play out), then focus.
     - free: pointer drag beyond `dragThresholdPx` or wheel → scroll the camera; never touches aim. Next turn/shot
       snaps back to the automatic camera. Key F = focus, Z = toggle overview (zoom fit ↔ 1).
     - "Camera follows shots" setting off → skip follow (stay where the player was).
   - **Minimap**: a second Phaser camera (`cameras.add`) at the HUD's minimap rect, zoomed to fit the world, ignoring
     the background layer and labels; or a React canvas fed by the same unit positions. Draw a yellow rectangle for
     `cameras.main.worldView`; click → pan there.
   - **Off-screen marker** for the active unit: if outside `worldView`, the HUD shows the yellow arrow clamped to the
     field edges with `edgeMarkerInset`.
   - The React HUD sits over the canvas and never scrolls. World→screen for DOM name tags:
     `(x − cam.scrollX) × zoom`, `(y − cam.scrollY) × zoom` (or draw tags in Phaser).
1. **Backdrop**: `apps/client/public/assets/maps/<map>-background.svg` (world-sized; sky, celestial body, far scenery,
   clouds, decorative islands, hills, hazard strip). Load as an SVG texture at 1× (and 2× for hi-dpi), origin 0,0,
   `setScrollFactor(CAMERA.parallaxBack)` (0.6). `<map>-full.svg` is a look reference only.
2. **Terrain**: a `CanvasTexture` the size of the world, painted from the `Terrain` mask:
   - fill solid pixels with `palette.dirt`; strata bands `palette.dirtDark` at +70 px (30 px thick, 45%) and +150 px
     (44 px, 60%) below the surface; pebbles `palette.rock` with 2.5 px `#151B2B` outline;
   - surface edge: 20 px `#151B2B` stroke, 14 px `palette.grass`, 4 px `palette.grassHi` 3 px above (same as Scene.dc.html).
   - On `carve` events: erase the circle (`globalCompositeOperation = 'destination-out'`), then repaint a 9 px dark rim
     (`#151B2B` at 55%) inside the remaining terrain around the hole and re-stroke the grass edge in the dirty rect.
     Only touch the dirty rectangle; call `texture.refresh()` once per frame.
   - The mask already contains chasms and floating-island undersides (Skyreach): paint both edges — the underside gets
     the dark `palette.dirtDark` rim and hanging roots like `Scene.dc.html`.
   - Trees, rocks (and cacti / mushrooms per map) from Scene.dc.html are terrain decorations: remove any whose base
     pixel is no longer solid.
   - **Props** (`world.props`, `PropState`): barrel and crate sprites copied from `Battle.dc.html` (`PROPS` block).
     `prop` events: `destroyed` (crate splinters), `exploded` (barrel → same explosion as a weapon, orange), `collected`
     (crate pops + green "+150" number from the `heal` event), `moved` (tween to the new y as the ground falls).
3. **Machines**: a Container per unit = `apps/client/public/assets/machines/<kind>-barrel.svg` (behind) + `<kind>-<team>-body.svg`; barrel rotates about
   `rig.json` pivot (viewBox 120×100, ground at y=95; draw at 100 px wide → 0.8333 scale). Facing left = `scaleX(-1)`
   on the container. Aim angle 0–180 → barrel rotation `-angle` when facing right, `-(180-angle)` mirrored.
   Name tag + HP bar above (DOM-like look: draw with Phaser Text/Graphics or as DOM elements positioned by the HUD).
   Idle bob 2.6 s, blink handled by the SVG's SMIL (rasterised textures lose SMIL → re-add blink with a 4.2 s tween on
   an eyelid sprite or accept static eyes; document choice).
   Eliminated → body tinted `0x777777`, rotated 9°, smoke particles.
4. **Projectiles**: replay `ShotResult.tracks` — one point per tick at 60 Hz. Shell sprite rotated along velocity;
   trail = fading line of the weapon colour (6 px, 55%) + white core (2 px, 70%).
5. **Explosions** at `explosion` events (copy the mockup layers): white flash (1.6×r, 0.35 s), weapon-coloured ring
   (6 px, scale 0.2→1.9, 0.7 s), fireball with 4 px outline (0.7 s), inner `#FFF6D6` core, 12 sparks, 3 smoke puffs.
   Camera shake 450 ms if the setting is on. Floating damage numbers come from `damage` events (Lilita One, 36 px,
   46 px + "DIRECT HIT!" on direct hits, 5 px dark stroke).
6. **Bolts / burn zones / freeze**: `bolt` → jagged polyline yellow + white core, 150 ms flicker; `burnZone` → looping
   flame particles until it expires; `status: frozen` → cyan ice overlay on the unit.
7. **Unit motion**: `unitPath` events (one point per tick) animate walking, knockback and falls; snap to the
   authoritative `units` snapshot when the action finishes.
8. **Trajectory preview** (own turn only): `predictTrajectory(world, myUnitId, aim)` from shared, first
   `PHYSICS.previewTicks` ticks, every 2nd point, dotted 5 px `#F5F1E8` over 8 px `#0B0F1A` at 70%, animated dash, end
   reticle in `#FFD166`. Recompute on aim/power/weapon/wind change.
9. **Input** (desktop): mouse aim = angle from muzzle to cursor (0–180, clamp below horizon), hold left button to charge
   power or drag the HUD meter; keys ↑/↓ angle, Q/E power, ←/→ move, Space fire, W armory, 1–4 quick slots.
   (touch): the phone aim pad from BattleMobile.dc.html sets angle+power by drag; sliders on tablet.
   All inputs become intents; the HUD/Phaser never mutate authoritative state.

## Done when
Playwright screenshot at 1440×900 matches `design/screenshots/04-battle.png` in layout; a fired shot is followed by the
camera across the map (compare `04c`), holds on the impact (`04d`), pans to the next player (`04e`); Z shows
`04h`; Skyreach renders like `04i`; every map loads; every connected client shows the same `terrainHash`.
