# Progress

Update at the end of every phase: what works, how to verify it (commands, URLs, test names), screenshots, known gaps.

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

## Phase 2 — Multiplayer
_not started_

## Phase 3 — Content
_not started_

## Phase 4 — Persistence
_not started_

## Phase 5 — Quality
_not started_
