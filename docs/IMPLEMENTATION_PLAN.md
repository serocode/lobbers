# Implementation plan

Already done in this kit: design source + screenshots, extracted art, design tokens, typed config, the deterministic
shared simulation (terrain, projectiles, 10 weapon behaviours, combat, knockback, falling, hazards, movement, abilities,
turns, intent validation, lobby rules, rewards) with 16 passing tests including full 1v1–4v4 simulated matches.

Every phase ends with: tests green · Playwright screenshots compared to `design/screenshots` · `docs/PROGRESS.md`
updated · deviations in `docs/DECISIONS.md`.

## Phase 0 — Bootstrap (½ day)
- `pnpm install` at the root (fix any version that fails to resolve; record it in DECISIONS). `pnpm test:core` green.
- Client: Vite React app in `apps/client` with router, `<Stage>` scaler, fonts via `@fontsource`, global
  `design/tokens/*.css`. Shared components: Button (+ link), PlayButton, FireButton, Panel, HudPanel, Modal, Toast,
  Switch, Segmented, Meter, TimerRing, and the art components MachineArt / WeaponIcon / SceneBackdrop ported from the
  three component mockups.
- Server: Colyseus + Hono on one port (`/api` and websocket), health check, guest auth endpoint, zod setup.
- Check: a Storybook-like `/dev/kit` route showing every component and all 8 machines in both tints + 3 backdrops,
  screenshot compared with `screenshots/c1..c3` and the mockup screens.

## Phase 1 — Playable local game (hot-seat, same physics as the server)
Purpose: prove the battlefield end-to-end before networking. Use `@lobbers/shared` directly in a `LocalMatchController`
that implements the exact same interface the network controller will (so Phase 2 swaps transport, not logic).
- Phaser `BattleScene` (skill `battlefield-renderer`): world of `map.width × map.height`, Gunbound camera from
  `config/camera.ts` (focus → follow shell → hold → next player, drag/wheel, F/Z, minimap, off-screen marker),
  parallax backdrop, terrain CanvasTexture from the mask with carving, barrels and crates,
  machines with rotating barrels, projectiles, explosions, bolts, burn zones, freeze overlay, damage numbers, shake.
- React battle HUD ported from `Battle.dc.html` incl. additions (§3.1–3.5 of DESIGN_SPEC): team panels, turn panel +
  timer, kill feed, combat log, banner, elimination ribbon, controls deck, armory, pause, victory overlay.
- Inputs: mouse aim + hold-to-charge, keyboard, HUD drag/±, quick slots, special/ultimate, move/jump.
- Tablet + phone battle layouts (aim pad, sliders, weapon sheet).
- Check: hot-seat 2v2 played to victory; trajectory preview matches flight; craters change collision; falls/knockback
  work; every weapon visibly distinct; camera follows every shot on all 6 maps; 55+ fps.

## Phase 2 — Multiplayer
- `LobbyRoom` (create, join by code, public listing, leave, team assignment, machine select, ready, settings, chat,
  kick, host transfer, validated start, countdown) wired to the Lobby + Machine Select screens.
- `MatchRoom` + `MatchController` (server state machine, turn timer, intents → shared sim → broadcasts, aim relay,
  reconnection window, skip/forfeit rules, AFK, host transfer, terrain hash checks).
- Client `net/` layer: connect, reconnect with token, time offset, message → store/event queue; the battle scene now
  plays server events (replace LocalMatchController with NetMatchController).
- Home: Create Room / Join Room / Quick Match (simple matchmaker: fill public rooms, else create) / Play Now (ranked
  queue = same matchmaker with rating band).
- Check (skill `multiplayer-e2e`): 1v1, 2v2, 3v3, 4v4 in separate browser contexts; identical outcomes; out-of-turn
  rejection; disconnect + reconnect; host leaves; forfeit after window.

## Phase 3 — Content integration
- All 8 machines' specials and ultimates in the HUD and Machine Select; loadouts per machine; all 10 weapons in the
  Armory; all 6 maps with their terrain shapes, palettes, hazards (lava glow, icy water, void), decorations and props.
- Cosmetics in matches: skins (paint), trails (colour/dash), explosion styles (colour/shape), titles, emotes (emote
  wheel: 4 equipped emotes shown as speech bubbles over the unit — add in the mockup's speech-bubble style).
- Sound: SFX for fire, flight whistle, explosion (per weapon category), hit, elimination, turn start, UI clicks; music
  loop for menus and battle. Volume settings from the Settings modal. (Use royalty-free assets; list licences.)

## Phase 4 — Persistent features
- Drizzle schema + migrations + seed (`docs/DATA_MODEL.md`); guest accounts with first-run name modal (§3.7).
- Match results persisted; XP/levels/coins applied (`computeResults`, `applyXp`); rating update (Elo-style per team).
- Profile (stats, history, achievements), Inventory (equip/unequip/purchase), Missions (progress + claim),
  Leaderboards (global/friends), Friends (requests, presence, invites, join friend's room), Recent players.
- Home shows real profile/activity/friends.

## Phase 5 — Quality
- Server tests with `@colyseus/testing`; client unit tests; Playwright suites for every screen and the multiplayer
  matrix; visual comparison screenshots.
- Physics tests for new edge cases found while playing; terrain-hash desync test across 8 clients.
- Performance passes (terrain dirty-rects, texture atlases from the SVGs at 1×/2×, pooled particles), bundle size.
- Security review (`docs/NETWORK.md § Security checklist`), error handling, reconnect UX, accessibility (focus order,
  labels, reduced motion).
- Final walkthrough Artifact with screenshots of every screen next to the design reference.
