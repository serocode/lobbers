# Decisions log

Append-only. Format: date · decision · reason · affects.

- Kit · Stack: React + Vite client, Phaser 3 for the battlefield canvas only, Colyseus 0.16 + Hono + Drizzle/Postgres +
  Redis server, npm workspaces. · The brief recommends Colyseus/Postgres/Redis; the mockup's component model maps
  1:1 to React; Phaser is the suggested engine. · all
- Kit · Gameplay physics is custom and shared (`packages/shared/src/sim`), not Phaser Arcade/Matter. · One
  implementation for server authority and the client preview; pixel-mask terrain makes real destruction trivial. ·
  server, client game/
- Kit · Launch weapon set is the brief's 10 (replaces the mockup's 14 demo weapons). The Armory UI is unchanged and
  data-driven. Two new icons (Drill, Gravity) were added to `WeaponIcon.dc.html` in the house style. · Brief §7 · Armory
- Kit · Aim is 0–180° (brief) instead of the mockup's 0–90° + facing; the existing semicircle dial already fits. ·
  Brief §4 · HUD
- Kit · Added to the HUD in mockup style: Ultimate button, Jump button, disconnected indicators, status-effect icons
  (DESIGN_SPEC §3). · Brief §6, §8, §11 · HUD, lobby
- Kit · Ember Basin and Glacier Rift get their own terrain curves; the mockup reused Cobalt's curve for all three
  backdrops. · Maps should play differently · maps config, Scene rendering
- Kit · Small decorative floating islands are background art (non-colliding). Skyreach Isles' three big islands ARE
  terrain (top + bottom curve + chasms in the same 1-bit mask). · One mask, still interesting · maps, terrain
- Kit · Max HP = health × 100 + 100 (Machine Select shows this). The battle mockup's demo HP values differ slightly. ·
  One formula · machines config
- Kit · Spectating, direct messages and server bots are out of scope for v1; their buttons are disabled with tooltips. ·
  Not required by the Definition of Done · Home, Friends
- Update 2 · Battlefields are bigger than the screen (2400–3000 × 1000–1100) with a Gunbound camera: focus the active
  player, follow the shell after release, hold on impact, pan to the next player; drag/wheel, F, Z overview, minimap,
  off-screen marker. · The 1440×750 field felt cramped · camera.ts, Battle*.dc.html, battlefield-renderer
- Update 2 · Three new maps: Sunscar Dunes, Skyreach Isles, Glowcap Hollow (6 total). · More variety · maps.ts, Scene
- Update 2 · Interactive props: explosive barrels (chain reactions) and repair crates. · Battlefield interaction ·
  PROPS in physics.ts, combat.ts, movement.ts
- Update 2 · Launch speed 19 → 26 so full-power shots cross the bigger maps. · Range scales with world · physics.ts
- Update 2 · The mockup Armory now shows the brief's 10 weapons (was 14 demo weapons); "Items On" = full arsenal. ·
  Mockup = implementation · Battle.dc.html, DESIGN_SPEC §2.4

### Phases 0–1 (2026-11-05)
- 2026-11-05 · **pnpm instead of npm workspaces** (`pnpm-workspace.yaml`, `workspace:*` deps, `packageManager: pnpm@10.28.0`,
  `pnpm.onlyBuiltDependencies: [esbuild, msgpackr-extract]`). · Owner's request. Every dependency range in the kit resolved
  as-is (phaser 3.90, colyseus 0.16, vite 6, react 18, zustand 5, hono 4, zod 3) — no version changes were needed. · all
- 2026-11-05 · `design/tokens/*.css` are imported directly (Vite alias `@design`, `@fontsource` aliased to the client's
  node_modules so the tokens' font @imports resolve). Screen-specific mockup CSS lives in CSS modules (`battle.module.css`,
  `components.module.css`) so classes like `.tab`/`.toast`, which differ between mockup screens, can't collide. · client
- 2026-11-05 · `/` redirects to `/dev/kit` until Home (Main.dc.html) is ported in Phase 2. The kit page hosts the Phase 1
  **hot-seat launcher** (map, 1–4 machines per team, timer, wind, seed → `/match/local?…`). Dev harness, not a mockup screen. · client
- 2026-11-05 · **Protocol snapshot fields**: `MatchStartedMsg` gained `props`, `burnZones`, `wind`; `TurnStartedMsg` gained
  `burnZones`. Burn-zone expiry and prop state are server-owned and were otherwise unknowable after a reconnect / remount.
  `pnpm test:core` still 24/24. · shared protocol, client
- 2026-11-05 · **Transport seam**: `MatchTransport` (`subscribe({message, state})`, `send(intent)`, `serverNow()`,
  `localPlayerIds`). `LocalMatchController` implements it with the ARCHITECTURE state machine over `@lobbers/shared`; the
  `state` channel mirrors the Colyseus `MatchState` schema (phase, active unit, endsAt, wind, shotsLeft). Phase 2 adds
  `NetMatchController` with no BattleScene/HUD changes. · client net/
- 2026-11-05 · Outcomes are **replayed in time** (`state/replay.ts`, 60 ticks/s): HUD HP bars, damage numbers, craters and
  shells advance together; units snap to the authoritative snapshot at the end of each action and the client's mirror
  `terrainHash` is compared with the server's after every action (`store.hash`). · client
- 2026-11-05 · **Armory lists the active machine's loadout** (5 weapons), i.e. the spec's "Items Off" view, because
  `rules.ts canUseWeapon` only accepts loadout weapons and `createUnit` only stocks loadout ammo. The info line reads
  "{Machine} loadout — 5 weapons" instead of "Items: On — full arsenal this match". Quick slots 1–4 = `DEFAULT_QUICK_SLOTS`
  filtered to the loadout, topped up from it. "Items On = all 10" needs a shared-rules change → Phase 3. · HUD, armory
- 2026-11-05 · **Mouse aim**: drag on the field pans (free look, never aims). Press-and-hold the left button still for 200 ms
  on your turn → aim mode: the barrel follows the cursor and power charges 0→100→0 while held; release keeps both. Fire with
  Space / FIRE (release does not fire, to avoid accidental shots). Touch aims with the HUD (tablet steppers/slider, phone aim
  pad). · battlefield input
- 2026-11-05 · Angle keys: ↑/↓ raise/lower the barrel on the facing side (stops at 90°); the dial and ± buttons change the
  absolute 0–180° value (the dial's range input runs right-to-left because 0° is on the right). Walking turns the machine
  and mirrors the angle so the elevation is kept. · HUD
- 2026-11-05 · **Hot-seat copy**: with several local players the turn banner shows the machine name in its team colour
  (not "YOUR TURN"), the controls deck shows the active machine, and the HP bars use green for Red / blue for Blue (the
  mockup's "your team = green"). "You" labels and the yellow tag border appear only online (one local player). Victory
  overlay: "VICTORY!" in the winning team's colour; SEE RESULTS is disabled ("Results screen arrives with multiplayer
  (Phase 2)"); "Back to lobby" reads "Back to setup" and returns to the hot-seat launcher; "Play again" = same setup, seed+1.
  Pause → "Surrender & return home" asks to confirm, then leaves the hot-seat match. "Skip to match results" is omitted
  (dev-only in the spec, and there is no Results screen yet). · HUD
- 2026-11-05 · **Additions on tablet/phone** (not in those mockups, needed for parity): jump button next to the move buttons;
  special + ultimate circles (§3.2 style) on the tablet controls row and inside the phone "More" weapon sheet. The tablet
  mockup has no pause button, so tablet pause is Esc only (known gap). · HUD tablet/phone
- 2026-11-05 · Battle backdrop = `assets/maps/<map>-background.svg` rasterised once (SMIL clouds/twinkles are static in the
  battle, as the kit README warns); parallax uses the mockup formula `translate(ox − cam × 0.6 × z)` per frame rather than
  Phaser `scrollFactor` (which pivots on the viewport centre and misaligns the letterboxed overview). · game/render
- 2026-11-05 · Terrain art is painted from the same paths as Scene.dc.html into **512 px CanvasTexture tiles** at device
  density; a carve only re-uploads the tiles it touches. Crater rim (r+9, #151B2B 55 %) + grass edge re-stroked over it, as in
  the mockup's layer order. Decorations (trees/rocks/columns) are sprites from the scene markup and topple when the ground
  under them is carved (they are not cut by craters the way the SVG mask cuts them). · game/render
- 2026-11-05 · The canvas renders at `min(2, devicePixelRatio × stage scale)` and machine/prop/decoration SVGs are rasterised
  at the matching texture scale, so art stays crisp at zoom 1 on retina screens. · game
- 2026-11-05 · Server Phase 0: Hono and Colyseus share one HTTP server (Colyseus wraps the Hono listener for `/matchmake`).
  `POST /api/auth/guest` issues a signed guest JWT (HS256, 30 d; name rule 3–16 letters/digits/._). Guest identities are
  stateless until the Drizzle schema lands in Phase 4. Redis presence/driver are used only when `REDIS_URL` is set. · server
- 2026-11-05 · Dev-only hooks (`window.__lobbers`, `__lobbersCam`, `__lobbersPerf`, `__lobbersDev.aimAtNearest`) exist only
  under `import.meta.env.DEV` for Playwright; `aimAtNearest` uses the same preview the player sees and sets aim through
  BattleControls (the shot still goes through the intent pipeline). · client
