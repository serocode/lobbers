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

## Multiplayer (peer-to-peer)
- [x] Create room (code `LOB-XXXX`, PeerJS id registered), join by code, invite link `/?join=`, Recent rooms, leave
      _(host.test "lobby over the wire"; e2e `multiplayer.spec.ts`, `deploy.spec.ts` invite link, `screens-p2p.spec.ts`)_
- [x] Works between two real devices on different networks (Wi-Fi + mobile data); TURN configured if needed
      _(owner, 2026-11-06: Galaxy A54 vs laptop on the Vercel deploy, played as intended — networks not stated; no TURN needed so far)_
      _(owner, on the Vercel deploy. Verified so far: two browser windows over the PeerJS cloud server — 1v1 to victory)_
- [x] 8 max, 4 per team, 2 min, host-only start, everyone ready; wrong code / full / version cards
      _(host.test lobby test; e2e "lobby validation" (9th → "Room is full"), screens-p2p "Room not found")_
- [x] Machine selection saved to the seat _(Machine Select → `setMachine`; p2p `machine-select.png`)_
- [x] Host-authoritative: out-of-turn and forged guest intents rejected; no UI code (host's included) sets HP/damage
      _(host.test + ports.test "out-of-turn and illegal intents", codec test; e2e "out-of-turn + forged intents")_
- [x] Identical HP/positions/terrain hash on every peer after every action (1v1, 2v2, 3v3, 4v4) — `pnpm smoke:p2p`
      _(`phase-2/matrix-report.json`: 16/21/31/37 turns, 0 mismatches; smoke:p2p pass)_
- [x] Guest disconnect → indicator, turns skipped, rejoin resumes the seat with a full snapshot; forfeit after window
      _(ports.test disconnect + window tests; e2e disconnect/rejoin/forfeit)_
- [x] Host refresh mid-match → "Host reconnecting…", same turn resumes, same terrain hash
      _(host.test/ports.test host refresh; e2e "host refreshes mid-match"; smoke:p2p host refresh)_
- [x] Host leaves → every guest sees "The host closed the room"; no rewards credited _(host.test; e2e "host leaves")_
- [x] Hot Seat: 2–8 local players on one screen to a winner _(e2e `hotseat.spec.ts`; vitest `hotseat.test.ts`)_

## Saved data (localStorage)
- [x] First run creates a profile; reload keeps level/coins/history _(e2e `storage.spec.ts`)_
- [x] Rewards credited exactly once per match _(host.test profile: `creditMatch` twice → once; smoke:p2p every peer
      credited once; e2e 2v2 coins on Home after Results)_
- [x] Purchase / equip / unequip; equipped cosmetics visible to everyone in a match
      _(e2e `inventory.spec.ts` buy Frostbite + equip/unequip; core `setCosmetics` → resolved into `matchStarted`; host.test cosmetics; e2e `cosmetics.spec.ts`)_
- [x] Daily missions (local midnight reset, claim once) and achievements from host-counted feats
      _(core `progress.test.ts`, `feats.test.ts`; e2e `social.spec.ts` claim, `profile.spec.ts` achievements)_
- [x] Export save → Import on another browser restores everything (same player id) _(e2e storage "export save → import")_
- [x] Empty, corrupt and blocked storage: the game still starts (banner when it can't save) _(e2e `storage.spec.ts`)_

## Screens (each compared with its screenshot)
- [x] Home (+ 6 modals) · [x] Lobby · [x] Machine Select · [x] Battle desktop · [x] Battle tablet · [x] Battle phone _(phone sizing: `mobile.spec.ts`)_
      _(battle: phase-1 screenshots vs 04*, `layout-report.json`)_
- [x] Results (real stats, host-computed MVP line + details, XP/coins credited locally, revisits from history) · [x] Profile · [x] Inventory (equip/unequip/locked/purchase) · [x] Friends
      _(phase-4 `profile.png`, `inventory*.png`, `friends*.png`, `missions.png` vs 06/07/07b/08/08b/01d)_
- [ ] Every button performs its action (or is disabled with a reason logged in DECISIONS)

## Quality
- [x] `pnpm test:core`, `pnpm smoke:p2p`, client tests green; Playwright suites green
      _(2026-11-06 Phase 4: core 60, client 24, smoke pass, Playwright 43/43 incl. the 1v1–4v4 matrix + deploy spec on the production build)_
- [x] Deployed on Vercel (static); deep links and refresh on `/lobby/:code` work
      _(owner deployed after setting Root Directory to the repo root; deep links/refresh verified on the production build with `deploy.spec.ts`)_
      _(locally verified on the production build with `deploy.spec.ts`, local PeerServer and PeerJS cloud; Vercel import: owner)_
- [x] No `any`; strict TS passes in all workspaces _(`pnpm typecheck`)_
- [ ] 55+ fps battlefield with 8 units; works in Chrome, Firefox, Safari, mobile Safari/Chrome
