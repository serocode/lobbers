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

### Phase 2 (2026-11-05)
- 2026-11-05 · **Match state machine moved to `packages/shared/src/match/` (`MatchFlow` + `MatchTally`)** instead of a server-only
  `match/MatchController`. · The hot-seat controller and the server must not drift; one implementation, tested in `pnpm test:core`
  with a fake clock. The server room only adapts Colyseus (auth, zod, rate limits, reconnection). · shared, server, client net/local
- 2026-11-05 · **Protocol additions**: `forfeit` intent + `forfeit` action kind / damage cause; `setRoomName` lobby intent;
  `MatchStateView` (with `offline: playerId → reconnect deadline`) moved into protocol; `MatchEndedMsg` gained `mapId`, `mode`,
  `mvpHighlight`, `details` (damage per turn, weapon usage); `LobbyView`, `LobbyServerMessage`, `TimeSyncReply`, `PublicRoomInfo`.
  Rejections go only to the sender. · Results and reconnect needed them · protocol.ts
- 2026-11-05 · **Match schema = turn/phase/timer/wind/shotsLeft/offline only.** Unit HP/positions travel in `actionResolved`
  snapshots, not in the schema (NETWORK.md listed units). · Schema patches arrive before the replay animates, so HP bars would
  drop before the shell lands; snapshots keep one source of truth in step with the animation. · MatchRoom, client
- 2026-11-05 · **The LobbyRoom stays alive during the match**; MatchRoom calls `matchFinished` on it (remoteRoomCall), which reopens
  the room and un-readies non-hosts. "Play again" = back to the same room (non-hosts auto-ready); there is no separate "new lobby". ·
  Same players, settings and code with no extra flow · LobbyRoom, Results, victory overlay
- 2026-11-05 · **Match rooms are created only by lobbies** (HMAC key of JWT_SECRET in create options); seats are reserved per lobby
  client with its verified auth. A returning account (new tab, no token) is re-seated by `joinById`; the old reconnection is then
  not treated as a forfeit. Reconnection tickets live in `localStorage` (one active game per browser profile). · Security + a
  closed tab must be able to come back · rooms, net/online
- 2026-11-05 · **Consented leave mid-match = surrender** (forfeit). Disconnect-forfeited players stay in `offline` so clients don't log
  "reconnected". · Leave button and closing the socket on purpose mean the same thing · MatchFlow, MatchRoom
- 2026-11-05 · **Join by code** resolves through a presence hash (`lobbers:room-codes`) because private rooms are hidden from
  matchmaking. Quick Match = `joinOrCreate('lobby', { ranked: false })`; Play Now = the same over the `ranked` pool
  (`filterBy(['ranked'])`). No rating band until ratings exist (Phase 4). · Simple matchmaker per the plan · server, Home
- 2026-11-05 · **Home for guests**: the profile card shows a fresh guest's real values (Lv 1, 0 XP, 0 coins, "Unranked · Guest");
  Recent Activity lists this browser's finished matches (localStorage); Friends shows an empty state. Inventory, Missions,
  Leaderboards, profile card, "See all", Lobby "Customize", Machine Select "Skins for X" and Results "My Profile" are disabled with
  "Arrives with accounts (Phase 4)". The Results "Mission" card reads "Guest progress · Not saved yet". · No fake data · Home, Lobby,
  Results, Machine Select
- 2026-11-05 · **Modes/options without rules are disabled with a reason**: Capture the Hill (lobby MODE + Create Room), Duel 1v1
  (Create Room), Best of 3 (lobby ROUNDS). · Not in @lobbers/shared · Lobby, Home
- 2026-11-05 · Lobby header ping panel reads "PING · n ms" (the mockup's "SEA · 38ms" implies regions we don't have). Lobby chat
  shows the last 4 lines (4 fit in the mockup's 166 px panel). Invite Friends modal offers "Copy invite link" (code + /lobby/CODE)
  until friends exist; empty slots open it. · Lobby
- 2026-11-05 · Machine Select: the LOCK-IN ring is hidden (no server lock timer outside ranked; the ranked timer is not built). The
  Special box gains the Ultimate row inside the same box (purple divider) so the detail panel keeps its 668 px height. In
  `/machines` (no room) LOCK IN saves the default machine for new rooms. · DESIGN_SPEC §2.3, §3.2 · Machine Select
- 2026-11-05 · Finished matches are kept in server memory (500 most recent) for `GET /api/matches/:id` until the Phase 4 matches
  table. · Results revisits work today · server match/archive.ts
- 2026-11-05 · Settings store gained master/music/effects volume, floating damage numbers and graphics quality (Low/Medium/High
  caps canvas density at 1 / 1.5 / 2). · Home Settings modal is real · uiStores, PhaserHost, scenePresenter
- 2026-11-05 · Map card taglines ("Lava vents, gusty") moved into `MapDef.tagline` (shared config) rather than UI literals. · maps.ts
- 2026-11-05 · Server tests run on vitest's `threads` pool: Colyseus uses `process.send` IPC in child processes, which collides with
  the default `forks` pool. Test-only timing overrides (countdown, intro delay, reconnect window) are accepted only when
  `NODE_ENV=test`. `RECONNECT_WINDOW_SEC` now actually sets the window. · server tests
- 2026-11-05 · `/` is Home; the component kit and hot-seat launcher stay at `/dev/kit`. · routes

### Phase 3 (2026-11-06)
- 2026-11-06 · **Items On = full arsenal** via `arsenalFor(loadout, itemsEnabled)` in shared config, used by `createUnit` (ammo),
  `canUseWeapon` and every HUD weapon picker. Items Off = machine loadout. The tablet's 6-button weapon row shows 5 + "More"
  (opens the phone weapon sheet) when the arsenal has more than 6. · DESIGN_SPEC §2.4 Armory · shared rules, HUD
- 2026-11-06 · **Cosmetics catalog in `packages/shared/src/config/cosmetics.ts`** (Inventory.dc.html ids, names, rarities, copy).
  Machine unlocks and avatars stay with the Phase 4 Inventory. Unlock prices/requirements for items the mockup lists as already
  owned are placeholders. "Wind?!" is a default emote so the wheel has four for every player (the mockup has 3 defaults). · catalog
- 2026-11-06 · **Ownership**: loadouts are sanitised server-side (`sanitizeLoadout`) against owned items — guests own the default
  items until Phase 4's inventory — and the server resolves them per unit into `MatchStartedMsg.cosmetics`. Clients store their
  loadout locally and send it on join (`setCosmetics` intent for later edits). The hot-seat harness can apply any preset (local
  only) so every style can be seen in a real match. · no client trust · LobbyRoom, MatchFlow, devkit
- 2026-11-06 · **Skins in Phaser**: `public/assets/machines/templates/<kind>-<team>-body.svg` are exported from the mockup parts
  (`pnpm --filter @lobbers/client skin-templates`) with a body-colour token; the battle repaints only the token. A plain colour
  replace would also recolour parts that share the signature colour (Voltaic coils, Frostbite ice). Verified identical to the
  shipped body art when the token = signature colour. · game/render, scripts
- 2026-11-06 · **Explosion/trail styles**: non-classic explosions keep the ring in the weapon colour (so the weapon still reads)
  and restyle fireball/debris; barrel explosions stay classic. Default trail (Smoke Ring) is the mockup's flight trail. · Fx, ShotView
- 2026-11-06 · **Emote wheel** (not in the mockup): T or a 46 px bubble button beside Focus/Overview (tablet 52 px above Focus,
  phone 48 px beside Focus); 4 bubbles in the Inventory emote style around the field centre; 1–4 picks while open. Server
  cooldown 2.5 s; bubble 2.6 s; "KABOOM!" shakes. · Phase 3 plan · HUD, MatchFlow
- 2026-11-06 · **Hazard animation**: Phaser `HazardView` redraws the lava glow pulse and the icy-water wave over the rasterised
  backdrop in backdrop (parallax) space. Void maps have no strip in the mockup, so nothing is added there. · game/render
- 2026-11-06 · **Sound is synthesised in code** (`apps/client/src/audio`: WebAudio oscillators + filtered noise, a look-ahead
  step sequencer for two music loops). No third-party audio files, so there are no licences to list. Audio unlocks on the first
  pointer/key press (browser autoplay rules). · Phase 3 plan · client

### P2P switch (kit)
- P2P switch · **Multiplayer is peer-to-peer**: the room host's browser runs the authoritative `HostSession`
  (lobby + match), players connect over WebRTC data channels (PeerJS; free cloud signaling by default; STUN, optional
  TURN). Supersedes the brief's server/Colyseus/Postgres/Redis requirements and the earlier "Stack" decision. ·
  Hobby game for friends; must host free on Vercel with no backend. · all multiplayer, AGENTS.md, rules
- P2P switch · All saved data in **localStorage** (`persist/profile.ts`): no accounts, no DB, no REST API. Export/Import
  save code for backups and new devices. · No server to store it · Home, Profile, Inventory, Results, Friends
- P2P switch · Trust model: guests can't change outcomes (host validates everything); the host *could* cheat and local
  coins can be edited. Accepted — friends-only. · No neutral server exists · rules
- P2P switch · Host leaving ends the room (no host migration in v1); a host refresh resumes from a localStorage
  snapshot (match paused up to 15 s). · Migration needs every peer to hold full authoritative state + re-signaling;
  revisit later · NETWORK.md
- P2P switch · Removed (need a server): matchmaking queue (PLAY NOW now hosts a room; Quick Match tile → Hot Seat),
  public room list (→ Recent rooms), global leaderboard (disabled tab; Friends tab = local), presence / friend requests
  / pushed invites (→ Recent players + Starred + share links), lock-in timer, ranked queue. · DESIGN_SPEC §3.9 · Home,
  Lobby, Friends, Machine Select
- P2P switch · Protocol v2: match message names/payloads unchanged (renderer untouched); new session messages
  (`hello`, `welcome`, `ping/pong`, `lobbyState`, `matchState`, `closed`), `forfeit` intent, `matchId`/`props` on
  match messages. · Minimal client churn · protocol.ts
- P2P switch · Items On now really means the full arsenal (`createUnit(…, fullArsenal)`); Items Off = machine loadout. ·
  The spec said so but the rules only allowed the loadout · world.ts, rules.ts

### P2P migration (2026-11-06, branch `p2p-migration`, migration steps 1–7)
The kit's decisions above apply. Our additions and deviations:
- 2026-11-06 · **Kit merge location**: the kit was unzipped at `design/lobbers/` only as an input. The design source of truth
  stays the top-level `design/` (DESIGN_SPEC §2.4 camera, §2.x data wiring, §3.7–3.9, 6-map mockups, screenshots and map art
  were merged into it; files changed since the first kit were diffed first). `design/lobbers/` is `git rm`'d at the end. · owner
- 2026-11-06 · **pnpm stays** (owner): `packageManager: pnpm@10.28.0` in the root `package.json` (Vercel uses the same pnpm),
  root scripts use `pnpm --filter`, `peer` is a root devDependency run with `pnpm exec peerjs` (`pnpm peer:local`);
  `vercel.json` installs with `pnpm install --frozen-lockfile` and builds with `pnpm --filter @lobbers/client build`.
  `tools/p2p-smoke` resolves esbuild/ws/playwright from the root devDependencies. · build, deploy
- 2026-11-06 · **Our cosmetics catalog wins over the kit's sample ids** (owner). `STARTER_ITEMS` = starter machines as
  `machine:<id>` + our default items; `createProfile()` equips `DEFAULT_EQUIPPED`; equipped slot names are the catalog's
  (`trail`, `explosion`, `title`, `emote:1..4`, `skin:<machine>`, `weaponSkin:<category>`); every machine-ownership check
  uses `machine:<id>` (`machineItemId`, `ownsMachine`). The host only checks ids and slots (`ALL_COSMETIC_IDS`, `fitsSlot`);
  `toPeerProfile` drops items the player doesn't own before sending. · persist, config/cosmetics, host
- 2026-11-06 · **Results tally is host-computed** (better than the spec's per-peer tally; owner-approved). `HostMatch` keeps a
  `MatchTally` and puts `mvpHighlight` + `details` on `MatchEndedMsg`; **PROTOCOL_VERSION 2 → 3**. The tally is part of
  `HostMatch.snapshot()/restore()`, so a host F5 mid-match keeps it, and a peer that rejoined mid-match gets identical details
  (both tested in `host.test.ts`). `creditMatch` stores a compact `summary` in `profile.history` (last 14 turns of damage,
  top-4 weapons, per-player results) so revisiting `/results/:id` works offline (`resultFromHistory`). DESIGN_SPEC §2.5. ·
  protocol, host/match, match/tally, persist
- 2026-11-06 · **Ports from our Colyseus build into the host engine** (protocol v3): emote intent/message with the server
  cooldown (`EMOTE_RULES`), `MatchStartedMsg.cosmetics` resolved per unit, `burnZones` on `turnStarted`, `reconnectUntil`
  on `MatchView` (reconnect countdown badge), lobby slot ping from the measured RTT (`ping {rtt}` → `HostLobby.setPing`),
  chat profanity mask, `shots`/`hits` in results, no kill credit on forfeit. `ports.test.ts` covers them. `match/flow.ts`
  (the Colyseus-era `MatchFlow`) is gone — `HostMatch` replaces it. · shared
- 2026-11-06 · **Server tests → host tests**: every `apps/server` room/API case has a host-engine equivalent (lobby rules,
  chat, kick, 9th player, out-of-turn, drop/rejoin, forfeit, lobby reopening after a match). Not ported, by design: host-crown
  transfer (P2P closes the room instead), "clients can't create match rooms" (only the host tab starts a match), guest JWT
  auth (→ local profile tests). · tests
- 2026-11-06 · **Nothing existing calls a server**: guest auth → local profile + first-run modal (§3.7); Home profile header,
  Results rewards (`creditMatch`), Settings, Machines favourite → localStorage. `apps/client` has no `/api`, `colyseus` or
  server `fetch(` (the only `fetch` loads a static skin template from `public/assets`). · client
- 2026-11-06 · **Client transport**: `MatchFeed` implements the battle screen's `MatchTransport` over the room's `PeerClient`
  and seeds itself from the client's current state (`started`, `actions`, `turn`, `ended`, `match`) — a resumed host's
  loopback messages arrive before React subscribes. Room actions (host/join/resume) are single-flight: React StrictMode's
  double effect otherwise opened two PeerJS peers that kicked each other. · net/p2p
- 2026-11-06 · **Hot Seat** is a `HostSession` with no network (`net/local/HotSeat.ts`) on `/hotseat`, launched from a Home
  tile + modal in the Create Room style (2–8 named seats, map, mode); banner "PASS TO {NAME}"; no rewards. Replaces the
  Colyseus-era `LocalMatchController` so local play runs the same engine as online. · Home, Battle
- 2026-11-06 · **PLAY NOW** opens Create Room (no matchmaking). Create Room has no Private switch (every room is private —
  only the code or the link gets in); the lobby shows "Private room" and "You are hosting". Invite link `/?join=LOB-XXXX`. ·
  DESIGN_SPEC §3.9 · Home, Lobby
- 2026-11-06 · **Home "Your Crew"** lists `recentPlayers` (starred first) in the Friends panel's place; **Join Room** shows
  Recent rooms (`profile.recentRooms`, last 4). · §3.9 · Home
- 2026-11-06 · **Closed-room card** (global, any screen): "Room is full", "The host closed the room", "Room not found",
  "Version mismatch", "Kicked" — with Back to Home. Host Leave asks to confirm ("CLOSE ROOM"). · §3.8 · app
- 2026-11-06 · **Host reconnecting**: while the match is `paused` after a host F5, guests' HUD shows "Host reconnecting…" in
  the turn panel and the timer freezes; input is disabled. · §2.6 · HUD
- 2026-11-06 · **Deleted**: `apps/server`, `docker-compose.yml`, Postgres/Redis/JWT env vars, `dev:server`/`db:*` scripts,
  the client's Colyseus/REST services (`net/api.ts`, `net/online/*`, `net/config.ts`), Quick Match modal. `.env.example`
  is client-only (`VITE_ICE_SERVERS`, `VITE_PEER_*`). · all
- 2026-11-06 · **Vercel caching**: only top-level `/assets/*` files (Vite's content-hashed bundles) are `immutable`; the
  hand-exported art under `/assets/machines|maps|weapons/` has no hashes, so it keeps default caching. · vercel.json
- 2026-11-06 · **Build output at the repo root `dist/`** (`build.outDir` in `apps/client/vite.config.ts`; `vercel.json`
  `outputDirectory: "dist"`). The first Vercel deploys ignored `vercel.json#outputDirectory` and looked for `dist` at the
  root; writing the build there works with Vercel's defaults, `vercel.json` and dashboard overrides alike. · deploy
- 2026-11-06 · **Phone sizing** (owner test on a Galaxy A54, landscape: "too small"). A54 Chrome is ~915×360 CSS px, so the
  width-only rule picked the 1024×768 tablet battle layout at ~47%. Now `pickLayout(w, h)` uses a bigger layout only at
  ≥ 0.7 scale → phone layout at ~92%. Menus on short landscape screens fit the width (0.64×) and scroll vertically
  instead of shrinking to the height (0.40×); the battle never scrolls. On touch devices the first tap requests
  fullscreen + landscape lock (`MobileFullscreen`, once per load; no-op on iPhone Safari) to win back the browser bar.
  DESIGN_SPEC §0 Stage updated. Tests: `layouts.test.ts`, e2e `mobile.spec.ts` (A54 emulation). · Stage, Battle

### Phase 4 — persistent features (2026-11-06)
- 2026-11-06 · **Per-player feats are host-counted** (protocol **v4**): `MatchTally` counts direct hits, burn damage, carved px,
  teammate hits, wind ≥ 10 hits, longest Lightning chain, most enemies frozen by one action, most eliminations in one
  turn, ice-weapon eliminations and guided hits from the same events peers replay; they ride on `PlayerResult.feats`
  and survive `snapshot()/restore()`. Achievements and missions never trust a peer's own counting. · host/match, tally
- 2026-11-06 · **Progress engine** `persist/progress.ts` runs inside `creditMatch` (idempotent like rewards): lifetime
  `counters`, `best` feats + win streak, `winsOn` per map, local play `streak`, the mockup's 5 **daily missions** (reset at
  local midnight, Claim pays once) and **12 achievements** (unlock time recorded). · persist
- 2026-11-06 · **Server-only requirements mapped to local goals** (owner-approved plan): Season pass level L → Reach level L;
  Gold I / Platinum rank → rating 1,200 / 1,400; Season 2 top 500 / Season 3 top 1,000 → 100 / 50 wins; Harvest Havoc /
  Season event → 30 / 15 daily missions; login streak 30 → play 30 days in a row; "Achievement reward" titles → the
  linked achievement (Hill Breaker → carve 10,000 px). Requirement items unlock for free once met. · config/progression
- 2026-11-06 · **Achievement copy for things our game doesn't have**: "Arc Bolt" → Lightning Strike; "Frost Nova" → any
  single action ("Freeze 4 enemies at once"); Island Hopper (teleport onto islands — no machine teleports) → "Win 10
  matches on Skyreach Isles"; Friendly Fire drops the mock player's name. Last Lobber needs a teammate who went down (a
  solo 1v1 win doesn't count). · config/progression
- 2026-11-06 · **Machines are ownable** (Inventory "Battle Machines"): 5 starters owned; Frostbite 6,000 coins, Whirligig
  level 40, Boomba level 20 (mockup "Season 4 pass · level 20"). Machine Select greys out and lock-badges machines you
  don't own (LOCK IN → UNLOCK IN INVENTORY); Hot Seat keeps all 8 (local, no rewards). `toPeerProfile` falls back to a
  starter if a pre-Phase-4 save's favourite isn't owned. EQUIP on a machine = your favourite (lobby default). · Inventory
- 2026-11-06 · **Avatars** = machine portraits (`avatar:<machine>`), owned with the machine, equipped in slot `avatar`, sent
  in the hello profile; Profile/Home show the avatar machine with its equipped skin. · cosmetics, profile
- 2026-11-06 · **Inventory additions** (DESIGN_SPEC §2.7): "Unequip" secondary button (skins/weapon skins come off; trail,
  explosion, title fall back to the default); emotes get a 4-slot "EMOTE WHEEL SLOT" picker (chip style) because the
  wheel has 4 slots and the mockup equips one per category. · Inventory
- 2026-11-06 · **`setCosmetics` lobby intent** (v4): equipping in the Inventory while in a lobby updates your loadout on the
  host (resolved and sanitised at match start, like the hello profile). Lobby "Customize" opens the Inventory (its back
  button returns to the lobby). · protocol, roomService
- 2026-11-06 · **Rank tiers from rating** (`rankFor`): Bronze 1,000, Silver 1,100, Gold 1,200, Platinum 1,400, Diamond
  1,600; divisions I → III inside a tier (Gold I = 1,200 to match the requirement). New players are Bronze I. · Profile
- 2026-11-06 · **Profile**: "Change title" opens a picker of owned titles (spec) rather than the mockup's cycle; history is
  8 per page with ‹ › paging in the header; a row opens Results from history. "Share profile" copies a text summary + the
  game link (no profile pages without a server). WINS sub = best win streak (tracked from Phase 4 on). · Profile
- 2026-11-06 · **Friends** (§3.9): tabs Starred / Recent players; a row's machine = what they played the last time you met
  (history), Thumper if unknown; no presence dots. "Pending invites" can't be tracked without a server → an INVITES note
  ("anyone with the link or code can join"). Not in a room → "Create a room to invite friends" + CREATE ROOM (opens Home's
  Create Room modal via navigation state). · Friends
- 2026-11-06 · **Leaderboards**: Friends tab = you + recent players by rating; the last column shows **LV** instead of win
  rate (we don't know other players' win rates). Global disabled: "Needs a server — not in this version". · Home
- 2026-11-06 · **Hosted room saved at creation** (bug found by the Friends e2e): `HostSession` only wrote its snapshot on
  lobby changes, so a host F5 before anyone joined lost the room. It now persists once when created. · host/session
