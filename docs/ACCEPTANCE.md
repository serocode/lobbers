# Definition of done — checklist

Tick only with evidence (test name, Playwright report, or screenshot path).

## Gameplay
- [x] Players can aim (mouse + keyboard + touch), set power, see a preview that matches the real flight
      _(hot-seat; preview = shared `predictTrajectory`, core test "preview uses the same physics as the real shot"; phase-1 `desktop-turn.png`, `tablet-turn.png`, `phone-turn.png`)_
- [x] Projectiles follow gravity and wind; wind changes every turn and is shown _(beginTurn; HUD wind gauge; phase-1 screenshots)_
- [x] Explosions remove terrain (collision changes), damage nearby machines, knock them back
      _(phase-1 `crater-seq-*.png`, `crater-report.json`, `docs/media/phase1-heavy-bomb-crater.webm`)_
- [ ] Machines fall into craters, take fall damage, die in the map hazard / off the edge
- [ ] Walk (slopes, walls, fuel), jump, boundaries
- [x] Camera: intro overview → focus active player at turn start → follows the shell after fire → holds on impact →
      pans to the next player; drag/wheel pan, F focus, Z overview, minimap click, off-screen marker; HUD never moves
      _(e2e `hotseat.spec.ts` Sunscar Dunes chase + overview assertion; `dunes-camera.json`, `desktop-overview.png`)_
- [ ] All 6 maps load at their world size with parallax background; Skyreach chasms/islands collide correctly
- [ ] Barrels detonate and chain; crates heal on pickup; props fall when the ground is carved
- [ ] All 10 weapons behave distinctly (cluster, guided, drill, lightning, fire zone, freeze, airstrike, gravity…)
- [ ] All 8 machines: stats applied, special + ultimate with real effects
- [x] Turn queue alternates teams, timer expires turns, eliminated players removed, match ends with a winner
      _(hot-seat: e2e "2v2 hot-seat played to victory" + vitest `hotseat.test.ts`; `desktop-report.json`)_

## Multiplayer
- [ ] Create room (code `LOB-XXXX`), join by code, public room list, leave
- [ ] 8 max, 4 per team, 2 min, host-only start, everyone ready
- [ ] Machine selection saved to the seat
- [ ] Server-authoritative: out-of-turn and forged intents rejected; clients never set HP/damage
- [ ] Identical HP/positions/terrain hash across all clients after every action (1v1, 2v2, 3v3, 4v4)
- [ ] Disconnect → indicator, turns skipped, reconnect resumes seat with full snapshot; forfeit after window
- [ ] Host transfer keeps settings

## Screens (each compared with its screenshot)
- [ ] Home (+ 6 modals) · [ ] Lobby · [ ] Machine Select · [x] Battle desktop · [x] Battle tablet · [x] Battle phone
      _(battle: phase-1 screenshots vs 04*, `layout-report.json`)_
- [ ] Results (real stats, MVP, XP/coins) · [ ] Profile · [ ] Inventory (equip/unequip/locked/purchase) · [ ] Friends
- [ ] Every button performs its action (or is disabled with a reason logged in DECISIONS)

## Quality
- [ ] `pnpm test:core`, server and client tests green; Playwright suites green
- [x] No `any`; strict TS passes in all workspaces _(`pnpm typecheck`)_
- [ ] 55+ fps battlefield with 8 units; works in Chrome, Firefox, Safari, mobile Safari/Chrome
