# Implementation plan

Already done in this kit: design source + screenshots, extracted art, design tokens, typed config, the deterministic
shared simulation (terrain, projectiles, 10 weapon behaviours, combat, knockback, falling, hazards, movement, abilities,
turns, intent validation, lobby rules, rewards), **the peer-to-peer host engine** (`HostSession`/`HostLobby`/`HostMatch`,
`PeerClient`, codec, `WorldMirror`) and the **localStorage profile** — 36 passing tests incl. full matches over a
loopback link, reconnects and a host refresh — plus `tools/p2p-smoke` (4 real browsers over WebRTC).

> **Already built Phases 0–2 with the previous kit (Colyseus + Postgres)?** Do `docs/MIGRATION.md` now (prompt **M** in
> PROMPTS.md), then continue Phase 3. Everything below describes the P2P target.

Every phase ends with: tests green · Playwright screenshots compared to `design/screenshots` · `docs/PROGRESS.md`
updated · deviations in `docs/DECISIONS.md`.

## Phase 0 — Bootstrap (½ day)
- `npm install` at the root (fix any version that fails to resolve; record it in DECISIONS). `npm run test:core` green.
- Client: Vite React app in `apps/client` with router, `<Stage>` scaler, fonts via `@fontsource`, global
  `design/tokens/*.css`. Shared components: Button (+ link), PlayButton, FireButton, Panel, HudPanel, Modal, Toast,
  Switch, Segmented, Meter, TimerRing, and the art components MachineArt / WeaponIcon / SceneBackdrop ported from the
  three component mockups.
- No server. `vercel.json` at the root; `npm run build -w @lobbers/client` produces the deployable `apps/client/dist`.
- Check: a Storybook-like `/dev/kit` route showing every component and all 8 machines in both tints + 3 backdrops,
  screenshot compared with `screenshots/c1..c3` and the mockup screens.

## Phase 1 — Playable local game (Hot Seat, same engine as online)
Purpose: prove the battlefield end-to-end before networking. Run a `HostSession` in the tab with one loopback
`PeerClient` per seat (`connectLoopback`) behind a `MatchController` interface (so Phase 2 swaps the transport only).
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

## Phase 2 — Multiplayer (peer-to-peer)
- Transport `apps/client/src/net/p2p/peerjs.ts` (kit): `createRoom` (host registers `lobbers-v2-LOB-XXXX`, runs
  `HostSession`, own UI over loopback), `joinRoom(code)` with auto-reconnect, `resumeHostedRoom` for host refresh.
- `P2PMatchController` over a `PeerClient`; Zustand stores fed by `lobbyState` / `matchState`; the battle scene plays
  `actionResolved` exactly like Phase 1; `WorldMirror` for terrain + preview; `client.hostNow()` for timers.
- Home: PLAY NOW / Create Room (host), Join Room (code + Recent rooms), invite links `/?join=`, Hot Seat tile.
  Lobby + Machine Select wired to `LobbyView`; host Leave = close room; P2P ping in the header.
- Connection UX (DESIGN_SPEC §3.4, §3.8): disconnected badges, Reconnecting scrim, "Host reconnecting…", closed cards.
- Check (skill `multiplayer-e2e`, local PeerServer): 1v1, 2v2, 3v3, 4v4 in separate browser contexts; identical
  outcomes; out-of-turn rejection; guest drop + rejoin; host refresh; host leave; forfeit after window;
  `npm run smoke:p2p` green.

## Phase 3 — Content integration
- All 8 machines' specials and ultimates in the HUD and Machine Select; loadouts per machine; all 10 weapons in the
  Armory; all 6 maps with their terrain shapes, palettes, hazards (lava glow, icy water, void), decorations and props.
- Cosmetics in matches: skins (paint), trails (colour/dash), explosion styles (colour/shape), titles, emotes (emote
  wheel: 4 equipped emotes shown as speech bubbles over the unit — add in the mockup's speech-bubble style).
- Sound: SFX for fire, flight whistle, explosion (per weapon category), hit, elimination, turn start, UI clicks; music
  loop for menus and battle. Volume settings from the Settings modal. (Use royalty-free assets; list licences.)

## Phase 4 — Persistent features (localStorage)
- `useProfile()` store over `persist/profile.ts` + `safeStore(localStorage)`; first-run modal (§3.7); storage banner.
- `config/cosmetics.ts` from `Inventory.dc.html` (catalog, prices, requirements; ids match `STARTER_ITEMS`).
- On `matchEnded`: `creditMatch` (XP/levels/coins/rating/history/recent players, idempotent) → Results rewards panel.
- Profile (stats, history, achievements), Inventory (equip/unequip/purchase), Missions (local daily, claim),
  Leaderboards (Friends = `localLeaderboard`; Global disabled), Friends (Starred / Recent players, star, invite link),
  Home (profile, activity, Your Crew), Settings (Export / Import / Reset save).

## Phase 5 — Quality
- Host-engine tests for any new rule; client unit tests; Playwright suites for every screen and the multiplayer
  matrix over WebRTC (local PeerServer); visual comparison screenshots.
- Physics tests for new edge cases found while playing; terrain-hash desync test across 8 clients.
- Performance passes (terrain dirty-rects, texture atlases from the SVGs at 1×/2×, pooled particles), bundle size.
- Security review (`docs/NETWORK.md § Security checklist`), error handling, reconnect UX, accessibility (focus order,
  labels, reduced motion).
- Deploy to Vercel; test on two real devices on different networks (Wi-Fi + mobile data); add TURN if needed.
- Final walkthrough Artifact with screenshots of every screen next to the design reference.
