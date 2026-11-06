# Progress

Update at the end of every phase: what works, how to verify it (commands, URLs, test names), screenshots, known gaps.

> Phases 0–3 were built on Colyseus + Postgres, then migrated to peer-to-peer (section **P2P migration** below). Their
> server/REST notes are history; `apps/server` no longer exists.

## Phase 0 — Bootstrap ✅ (2026-11-05)
**Works**
- pnpm workspace (`pnpm install` resolves every kit range unchanged; see DECISIONS). `pnpm test:core` 24/24.
- Client: Vite + React 18 + TS, React Router, `<Stage>` scaler (1440×900 letterboxed), self-hosted fonts, global
  `design/tokens/*.css`. Shared components in `apps/client/src/components`: Button (+ ButtonLink), PlayButton, FireButton,
  Panel, HudPanel, Modal (Esc, focus trap), Toast, Switch, Segmented (seg/tab/chip), Meter, TimerRing, inline icons.
- Art: `MachineArt` (8 kinds × tint/paint/flip/aim/pose idle·victory·wreck, SMIL kept), `WeaponIcon` (9 glyphs),
  `SceneBackdrop` (6 maps, layers all/back/terrain, craters). Scene geometry (`sceneModel.ts`) reproduces the mockup's seeded
  scatter exactly and is shared with the Phaser terrain painter.
- `/dev/kit`: every component, 8 machines × red/blue/victory/wreck, the 9 icons + 10 weapons, all 6 backdrops.
- Server: Colyseus 0.16 + Hono on one port; `GET /api/health`, `POST /api/auth/guest` (signed guest JWT), `GET /api/auth/session`.

**Verify**
```bash
pnpm install && pnpm test:core
pnpm dev:client            # http://localhost:5173/dev/kit
pnpm dev:server            # curl localhost:2567/api/health
pnpm --filter @lobbers/server test            # 3 API tests
pnpm --filter @lobbers/client exec playwright test e2e/devkit.spec.ts
```
**Evidence** — `docs/screenshots/phase-0/` (`c1.png`, `c2.png`, `c3-<map>.png`, `kit-*.png`). Pixel difference vs
`design/screenshots` (`diff-report.json`): c1 0.31 %, c2 0.16 %, scenes 0.3–1.2 % (only animated clouds/stars/motes differ).

## Phase 1 — Playable local game ✅ (2026-11-05)
**Works**
- `LocalMatchController` (`apps/client/src/net/local`) runs the server state machine over `@lobbers/shared`
  (createWorld, advanceTurn, beginTurn, rules.ts validate/commit, resolveShot, walk, jump, activateAbility, endTurn,
  matchWinner, computeResults) behind `MatchTransport` — the same interface Phase 2's network controller implements.
- `ClientMatch` keeps a mirror World (terrain + snapshots) for rendering and `predictTrajectory` only, replays outcomes at
  60 ticks/s, and checks the terrain hash after every action.
- Phaser `BattleScene`: world-sized parallax backdrop, destructible terrain (tiled CanvasTextures, mockup rims), decorations
  that topple, barrels/crates (chain explosions, pickups, falling props), machines with rotating barrels, name tags / HP /
  status icons / active arrow, wrecks with smoke, frozen ice overlay, shells + trails, explosion layers, bolts, burn flames,
  damage / heal / MISS / KABOOM / INCOMING numbers, camera shake, trajectory preview.
- Gunbound camera (`CameraDirector`): intro overview → focus active machine → follow the shell → hold on impact → next
  player; drag/wheel free look, F focus, Z overview, minimap (live crater silhouette, viewport rect, click to pan, shell dot),
  off-screen marker.
- React HUD ported from Battle.dc.html with §3.1–3.5 additions: 0–180° dial, special + ultimate (charge ring), jump, status
  icons; team panels, turn panel + timer, kill feed, combat log, banner, elimination ribbon, hurt vignette, controls deck,
  armory, pause (settings persisted), victory overlay. Tablet (BattleTablet) and phone (BattleMobile: aim pad, weapon sheet)
  layouts; portrait phones get the rotate card.
- Inputs: mouse hold-to-aim/charge, ↑/↓ ←/→ Q/E Space W 1–4 J F Z Esc, HUD drag/±, quick slots, move/jump, abilities, touch.
- Hot-seat launcher on `/dev/kit#hotseat`; controls only work for the active unit.

**Verify**
```bash
pnpm dev:client   # /dev/kit → "Hot-seat match" → START HOT-SEAT
pnpm --filter @lobbers/client test                        # vitest: 2v2 headless match + helpers
pnpm --filter @lobbers/client exec playwright test e2e/hotseat.spec.ts
pnpm --filter @lobbers/client exec playwright test e2e/record.spec.ts   # re-records the demo clip
```
Manual: fire a Heavy Bomb at a slope (Thumper: arm Bunker Buster first) — the hole is real (shells fly through, machines
and props fall in). On Sunscar Dunes press E to 100 and fire: the camera chases the shell across the map, holds, then pans.

**Evidence** — `docs/screenshots/phase-1/`
- `desktop-turn.png` (vs 04-battle), `desktop-armory.png` (04b), `desktop-shot-in-flight.png` (04c), `desktop-impact.png`
  (04d), `desktop-next-turn.png` (04e), `desktop-overview.png` (04h), `desktop-skyreach.png` (04i), `tablet-turn.png` (04f),
  `phone-turn.png` + `phone-weapon-sheet.png` (04g), `desktop-victory.png`, `dunes-chase-0…8.png` + `dunes-next-player.png`,
  `crater-seq-0…5.png`.
- `desktop-report.json`: 2v2 hot-seat (Thumper+Boomba vs Cinder+Voltaic, Cobalt) played to victory in 13 turns, 14
  terrain-hash checks, **0 mismatches**; 60 fps; worst crater draw 0.3 ms.
- `layout-report.json`: 60 fps with 8 machines on tablet / phone / desktop layouts (headless Chromium, ANGLE/Metal).
  Image difference vs the references 3.9–8.3 % — mock names, HP and positions differ from the mockup's demo state.
- `dunes-camera.json`: camera x went 59 → 1545+ in `follow` mode during one full-power shot.
- `docs/media/phase1-heavy-bomb-crater.webm`: Bunker Buster + Heavy Bomb carves a crater; Blue 4 takes 454 and drops in.

**Known gaps** (logged in DECISIONS)
- Armory shows the machine's loadout (shared rules); "Items On = all 10 weapons" needs a rules change (Phase 3).
- SEE RESULTS disabled until the Results screen (Phase 2); hot-seat "Back to setup" replaces "Back to lobby".
- Tablet layout has no on-screen pause (mockup has none); Esc only.
- Rasterised backdrop: SMIL cloud drift / star twinkle are static on the battlefield.
- Decorations are not cut by craters (they topple when their base is carved).
- fps measured headless on an Apple-silicon Mac; re-measure on a mid laptop in Phase 5.

## Phase 2 — Multiplayer ✅ (2026-11-05)
**Works**
- **One state machine**: the match loop now lives in `packages/shared/src/match/flow.ts` (`MatchFlow`) with an injected clock.
  The server `MatchRoom` and the hot-seat `LocalMatchController` both run it. It adds disconnects (turn ends at once,
  turns skipped, forfeit after `maxSkippedTurnsWhileDisconnected` or the reconnect window), AFK forfeits
  (`maxConsecutiveTimeouts`), surrender (`forfeit` intent), and a tally for Results (damage per turn, weapon use, MVP line).
- **Server** (`apps/server/src`): `LobbyRoom` (LOB-XXXX codes in Colyseus presence, auto team balance, setTeam / setMachine /
  setReady / updateSettings / setRoomName / kick / chat with 2/s limit + filter, host transfer, validated 3-2-1 start, seat
  reservations, stays open during the match and reopens after it) and `MatchRoom` (reserved seats only, JWT `onAuth`,
  zod-validated intents, 10/s aim relay, reconnect window, full snapshot on (re)join, same-account rejoin from a new tab,
  results archived for `GET /api/matches/:id`). REST: `/api/rooms` (public list), `/api/rooms/code/:code`, `/api/season`.
- **Client net** (`apps/client/src/net/online`): guest session + first-run name modal, colyseus client, `lobbyService`
  (create / join by code / join by id / quick match / resume), `NetMatchController` (MatchTransport over the room; replays
  history to late subscribers; reconnects inside the window → fresh snapshot), clock offset (median of 3).
- **Screens** ported from the mockups: Home (+ Quick Match / Play Now, Create Room, Join Room, Settings, first-run name),
  Lobby (slots incl. RECONNECTING m:ss, host kick, public/private toggle, chat, countdown + DEPLOYING!), Machine Select
  (in room and `/machines` browse mode, Ultimate row), Results (podium, MVP, sortable rankings, rewards, match details).
- **Battle online**: offline badge on HUD chips, grey `OFFLINE m:ss` tag on units, combat-log lines for
  disconnected / reconnected / forfeited, "Reconnecting…" scrim with countdown + Leave match, red toasts for rejections,
  pause → surrender (server forfeit), victory → SEE RESULTS / Play again / Back to lobby.

**Verify**
```bash
pnpm test:core                                   # 32 tests (8 new MatchFlow tests)
pnpm --filter @lobbers/server test               # 12 tests: REST + LobbyRoom/MatchRoom via @colyseus/testing
pnpm dev:server & pnpm dev:client
pnpm --filter @lobbers/client exec playwright test e2e/multiplayer.spec.ts   # 1v1–4v4 to victory, validation, host leave, disconnect/reconnect/forfeit
pnpm --filter @lobbers/client exec playwright test e2e/screens-phase2.spec.ts
```
Manual: open two browser profiles → Create Room in one, Join Room with the code in the other → READY UP → START MATCH.
Close the active player's tab mid-turn and reopen `/match/<id>`: the seat, HP and craters come back.

**Evidence** — `docs/screenshots/phase-2/`
- `matrix-report.json`: 1v1 (16 turns), 2v2 (21), 3v3 (29), 4v4 (37) each played to victory in separate browser
  contexts; every client compared after every action — **0 terrain-hash mismatches**, identical HP/positions/wind/turn.
- `sync-2v2-a.png` + `sync-2v2-b.png`: the same moment from two contexts.
- Screens vs references (`screens-report.json`, mean pixel difference): home 6.9 % (01), create room 3.8 % (01c), quick
  match 2.9 % (01b), lobby 4.2 % (02), machine select 4.6 % / 4.2 % (03 / 03b); `results.png`, `results-details.png` (05 / 05b).
  Differences are guest data (names, levels, currency) and the references' substitute fonts.

**Known gaps** (logged in DECISIONS)
- Guest progress (XP, coins, level, history, friends, missions, inventory, leaderboards) is not stored until Phase 4;
  those buttons are disabled with the reason. Recent Activity lists this browser's matches.
- Capture the Hill, Duel 1v1 and Best of 3 have no rules yet → visible but disabled. Ranked has no rating band until ratings exist.
- Machine Select lock-in ring is hidden (no server lock timer). Lobby ping panel shows your ping, not a region.
- Finished-match results live in server memory (lost on restart) until the matches table lands.

## Phase 3 — Content ✅ (2026-11-06)
**Works**
- **Items On = full arsenal** (shared rules: `arsenalFor`, `createUnit` stocks ammo, `canUseWeapon`): Armory lists all 10
  with "Items: On — full arsenal this match"; Items Off lists the machine loadout. Quick slots, tablet row (6th button →
  "More" sheet when the arsenal is larger) and the phone sheet follow it. Hot-seat launcher gained an Items toggle.
- **All 8 specials + ultimates**: HUD (Phase 1) and Machine Select (Special + Ultimate rows); a core test proves every one
  changes the outcome (shot modifiers change the resolved shot; instant effects change state).
- **Maps**: all 6 in battle at world size; lava glow and icy-water wave animate again (Phaser `HazardView` over the
  rasterised backdrop, same timings as Scene.dc.html).
- **Cosmetics in matches** (`config/cosmetics.ts`, items/copy from Inventory.dc.html): skins (body repainted from exported
  templates so only the body changes), weapon skins (shell colour per Armory category), 6 trail styles (smoke, sparks,
  bubbles, dash, rainbow, stars), 6 explosion styles (classic, confetti, plasma, pixel, sakura, black hole), titles (lobby
  slot), emotes. Loadouts are sanitised server-side against what the player owns (guests: the default items) and resolved
  into `matchStarted.cosmetics`, so everyone sees the same thing.
- **Emote wheel**: T or the bubble button next to Focus/Overview; 4 equipped emotes; `emote` intent (any time, 2.5 s
  cooldown, server-validated) → speech bubble over the machine in the Inventory mockup's bubble style.
- **Sound** (`src/audio`, all synthesised with WebAudio — no third-party files): fire per weapon category, flight whistle,
  explosion by category/size, lightning, hit, heal, elimination, turn start, match end, UI clicks, emote pop; menu and
  battle music loops. Master / Music / Effects volumes from Settings; unlocks on the first gesture.

**Verify**
```bash
pnpm test:core                                                # 35 tests (Items On/Off, all abilities, cosmetics + emotes)
pnpm --filter @lobbers/client exec playwright test e2e/cosmetics.spec.ts e2e/maps.spec.ts
```
Manual: `/dev/kit#hotseat` → pick "RED COSMETICS: Rainbow Ribbon · Black Hole" → START → press T, then 2; fire a shot.

**Evidence** — `docs/screenshots/phase-3/`: `<preset>-emote.png`, `<preset>-flight.png`, `<preset>-impact.png` for the five
presets (all trails, explosion styles, skins, weapon-skin shells, bubbles); `armory-items-on.png`; `map-<id>.png` ×6.

**Known gaps** (logged in DECISIONS)
- Players can't change cosmetics in the UI until the Inventory screen (Phase 4); the hot-seat harness has presets to see them.
- Unlock prices/requirements for items the mockup shows as already owned are placeholders until the store exists.
- Void maps have no animated hazard strip (none in the mockup).

## P2P migration ✅ (2026-11-06, branch `p2p-migration`)
Colyseus + Postgres → peer-to-peer (the room host's tab is the authority, WebRTC via PeerJS) + localStorage + static Vercel
deploy, in seven steps (merge shared code → transport → persistence → screens → delete backend → deploy → verify).

**What replaced what**
| Before (Colyseus + Postgres) | Now |
|---|---|
| `apps/server` `LobbyRoom` | `packages/shared/src/host/lobby.ts` `HostLobby` (in the host's tab) |
| `apps/server` `MatchRoom` + `match/flow.ts` `MatchFlow` | `host/match.ts` `HostMatch` (+ our ports: emotes, cosmetics, burn zones, reconnect deadline, tally) |
| Colyseus transport, zod intents, JWT `onAuth` | `host/session.ts` `HostSession` + `net/codec.ts` `parsePeerMessage` + PeerJS data channels |
| Colyseus reconnection | rejoin token in `lobbers:rejoin:<code>`; host F5 → `lobbers:host:<code>` snapshot → `HostSession.restore` |
| `client/net/online/*` (colyseus client, lobbyService, matchService, storage) | `net/p2p/peerjs.ts`, `net/p2p/roomService.ts`, `net/p2p/MatchFeed.ts` |
| `client/net/local/LocalMatchController` | `net/local/HotSeat.ts` (a `HostSession` with no network, one loopback client per seat) |
| `POST /api/auth/guest` (guest JWT) | local profile (`persist/profile.ts`) + first-run modal (§3.7) |
| `GET /api/matches/:id`, Postgres history, rewards | `creditMatch` on each peer's own profile; `resultFromHistory` for revisits |
| `/api/rooms` public list, Quick Match queue | Recent rooms, share link `/?join=`, PLAY NOW → Create Room, Hot Seat tile |
| Postgres / Redis / docker-compose / JWT env | nothing — `.env.example` is client-only (`VITE_ICE_SERVERS`, `VITE_PEER_*`) |
| server vitest + `@colyseus/testing` | `test/host.test.ts` + `test/ports.test.ts` (in-process loopback, `ManualClock`) + `smoke:p2p` |

**Screens changed** (§3.7–3.9): first-run modal (+ "I have a save code"), Home (PLAY NOW → Create Room, Hot Seat tile +
modal, storage banner, real profile header, Your Crew), Create Room (no Private switch), Join Room (Recent rooms),
Settings (save data export/import/reset), Lobby (Private room · You are hosting, ping from RTT, invite link, host Close
Room confirm), global room-closed card, Battle HUD "Host reconnecting…" + frozen timer, Results (local credit, details
from history).

**How to verify**
- `pnpm test:core` — 46 tests (host engine, ports, profile, physics, rules).
- `pnpm --filter @lobbers/client test` — 9 (HotSeat, profile store, config).
- `pnpm smoke:p2p` — 4 real Chromium over WebRTC (local signaling): host F5 mid-match resumes, identical terrain hashes,
  everyone credited once.
- Multiplayer e2e (skill `multiplayer-e2e`): `pnpm peer:local`, `apps/client/.env.local` with `VITE_PEER_HOST=localhost …`,
  `pnpm dev:client`, then `pnpm --filter @lobbers/client exec playwright test e2e/multiplayer.spec.ts`.
- Production build: `pnpm build && pnpm --filter @lobbers/client preview --port 4180`, then
  `E2E_BASE_URL=http://localhost:4180 pnpm --filter @lobbers/client exec playwright test e2e/deploy.spec.ts`.

**Results (2026-11-06)**
| Suite | Result |
|---|---|
| test:core / client unit | 46/46 · 9/9 |
| smoke:p2p (4 browsers, cobalt) | pass — 31 turns, winner red, host refresh resumed with identical terrain hash, all credited |
| Matrix 1v1 / 2v2 / 3v3 / 4v4 | pass — 16 / 21 / 31 / 37 turns, 0 hash mismatches (`docs/screenshots/phase-2/matrix-report.json`) |
| Lobby validation · host leaves · host refresh mid-match · out-of-turn/forged + drop/rejoin/forfeit | pass |
| Storage (reload, empty, corrupt, blocked, export → import in another browser) · screens-p2p (3) · hot seat / devkit / cosmetics / maps / sound / record | pass — 35 Playwright tests in all |
| Production build + local PeerServer: deep link, refresh on `/lobby/:code` (guest + host), `/?join=` | pass |
| **PeerJS cloud** (no `VITE_PEER_HOST`): same deploy checks on the production build + a full 1v1 match in two windows | pass — 1v1 16 turns, 0 mismatches |

Fixed during verification: battle music now also plays on `/hotseat` (the route was `/match/local`).

**Evidence** — walkthrough https://claude.ai/artifact/7Vh3M2UgaUW6ZMiQLHNq5k · `docs/screenshots/p2p/` (`battle-guest-lost-host.png`, first run, Home, Hot Seat, Create/Join Room, Settings save data, Lobby host/guest,
invite, close confirm, closed card, Machine Select; `screens-report.json` = mean pixel difference vs `design/screenshots`),
`docs/screenshots/phase-2/sync-2v2-*.png`, `results*.png`.

**Known gaps**
- Two real devices on different networks (Wi-Fi + mobile data) on the Vercel deploy: owner to run. If a device can't
  connect, set `VITE_ICE_SERVERS` with a TURN server.
- Match e2e drives turns through the dev-only `window.__lobbersDev` hook, so full matches are tested on the dev server;
  the production bundle is covered by `deploy.spec.ts` (rooms, deep links, refresh, invite).
- No host migration: if the host closes the tab for good, the room ends (a refresh is fine).
- `docs/screenshots/phase-2/home-quick-match.png` shows the removed Quick Match modal (Phase 2 history).

## Phase 4 — Persistence
_not started_

## Phase 5 — Quality
_not started_
