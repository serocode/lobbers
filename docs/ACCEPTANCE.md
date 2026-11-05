# Definition of done — checklist

Tick only with evidence (test name, Playwright report, or screenshot path).

## Gameplay
- [x] Players can aim (mouse + keyboard + touch), set power, see a preview that matches the real flight
      _(hot-seat; preview = shared `predictTrajectory`, core test "preview uses the same physics as the real shot"; phase-1 `desktop-turn.png`, `tablet-turn.png`, `phone-turn.png`)_
- [x] Projectiles follow gravity and wind; wind changes every turn and is shown _(beginTurn; HUD wind gauge; phase-1 screenshots)_
- [x] Explosions remove terrain (collision changes), damage nearby machines, knock them back
      _(phase-1 `crater-seq-*.png`, `crater-report.json`, `docs/media/phase1-heavy-bomb-crater.webm`)_
- [x] Machines fall into craters, take fall damage, die in the map hazard / off the edge
      _(core tests "units fall into craters", "falling out of the world eliminates the unit", "knockback can throw a machine into a Skyreach chasm"; phase-1 crater clip)_
- [x] Walk (slopes, walls, fuel), jump, boundaries _(core test "movement: walking climbs slopes, spends fuel; jumping lands; frozen units stay put")_
- [x] Camera: intro overview → focus active player at turn start → follows the shell after fire → holds on impact →
      pans to the next player; drag/wheel pan, F focus, Z overview, minimap click, off-screen marker; HUD never moves
      _(e2e `hotseat.spec.ts` Sunscar Dunes chase + overview assertion; `dunes-camera.json`, `desktop-overview.png`)_
- [x] All 6 maps load at their world size with parallax background; Skyreach chasms/islands collide correctly
      _(phase-3 `map-*.png`; core tests "Skyreach: chasms…", "knockback… void")_
- [x] Barrels detonate and chain; crates heal on pickup; props fall when the ground is carved _(core test "interactive props")_
- [x] All 10 weapons behave distinctly (cluster, guided, drill, lightning, fire zone, freeze, airstrike, gravity…)
      _(core test "every weapon has distinct functional behaviour"; Items On makes all 10 usable — "items: On = all 10…")_
- [x] All 8 machines: stats applied, special + ultimate with real effects
      _(core test "all 8 machines: special and ultimate each have an observable effect")_
- [x] Turn queue alternates teams, timer expires turns, eliminated players removed, match ends with a winner
      _(hot-seat: e2e "2v2 hot-seat played to victory" + vitest `hotseat.test.ts`; `desktop-report.json`)_

## Multiplayer
- [x] Create room (code `LOB-XXXX`), join by code, public room list, leave
      _(server `rooms.test.ts`; e2e `multiplayer.spec.ts`, `screens-phase2.spec.ts` quick match)_
- [x] 8 max, 4 per team, 2 min, host-only start, everyone ready _(rooms.test.ts; e2e "lobby validation")_
- [x] Machine selection saved to the seat _(Machine Select → `setMachine`; `machine-select*.png`)_
- [x] Server-authoritative: out-of-turn and forged intents rejected; clients never set HP/damage
      _(rooms.test.ts, flow.test.ts, e2e "out-of-turn + forged intents")_
- [x] Identical HP/positions/terrain hash across all clients after every action (1v1, 2v2, 3v3, 4v4)
      _(`phase-2/matrix-report.json`: 0 mismatches)_
- [x] Disconnect → indicator, turns skipped, reconnect resumes seat with full snapshot; forfeit after window
      _(flow.test.ts, rooms.test.ts, e2e disconnect test)_
- [x] Host transfer keeps settings _(rooms.test.ts; e2e "host leaves the lobby")_

## Screens (each compared with its screenshot)
- [ ] Home (+ 6 modals: 4 built, Missions/Leaderboards → Phase 4) · [x] Lobby · [x] Machine Select · [x] Battle desktop · [x] Battle tablet · [x] Battle phone
      _(battle: phase-1 screenshots vs 04*, `layout-report.json`)_
- [x] Results (real stats, MVP, XP/coins computed; persisted in Phase 4) _(phase-2 `results*.png`)_ · [ ] Profile · [ ] Inventory (equip/unequip/locked/purchase) · [ ] Friends
- [ ] Every button performs its action (or is disabled with a reason logged in DECISIONS)

## Quality
- [x] `pnpm test:core`, server and client tests green; Playwright suites green
      _(2026-11-06: core 35, server 12, client 6, Playwright 27/27 incl. the 1v1–4v4 matrix)_
- [x] No `any`; strict TS passes in all workspaces _(`pnpm typecheck`)_
- [ ] 55+ fps battlefield with 8 units; works in Chrome, Firefox, Safari, mobile Safari/Chrome
