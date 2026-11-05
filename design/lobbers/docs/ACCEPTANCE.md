# Definition of done — checklist

Tick only with evidence (test name, Playwright report, or screenshot path).

## Gameplay
- [ ] Players can aim (mouse + keyboard + touch), set power, see a preview that matches the real flight
- [ ] Projectiles follow gravity and wind; wind changes every turn and is shown
- [ ] Explosions remove terrain (collision changes), damage nearby machines, knock them back
- [ ] Machines fall into craters, take fall damage, die in the map hazard / off the edge
- [ ] Walk (slopes, walls, fuel), jump, boundaries
- [ ] Camera: intro overview → focus active player at turn start → follows the shell after fire → holds on impact →
      pans to the next player; drag/wheel pan, F focus, Z overview, minimap click, off-screen marker; HUD never moves
- [ ] All 6 maps load at their world size with parallax background; Skyreach chasms/islands collide correctly
- [ ] Barrels detonate and chain; crates heal on pickup; props fall when the ground is carved
- [ ] All 10 weapons behave distinctly (cluster, guided, drill, lightning, fire zone, freeze, airstrike, gravity…)
- [ ] All 8 machines: stats applied, special + ultimate with real effects
- [ ] Turn queue alternates teams, timer expires turns, eliminated players removed, match ends with a winner

## Multiplayer
- [ ] Create room (code `LOB-XXXX`, PeerJS id registered), join by code, invite link `/?join=`, Recent rooms, leave
- [ ] Works between two real devices on different networks (Wi-Fi + mobile data); TURN configured if needed
- [ ] 8 max, 4 per team, 2 min, host-only start, everyone ready; wrong code / full / started / other tab / old version cards
- [ ] Machine selection saved to the seat
- [ ] Host-authoritative: out-of-turn and forged guest intents rejected; no UI code (host's included) sets HP/damage
- [ ] Identical HP/positions/terrain hash on every peer after every action (1v1, 2v2, 3v3, 4v4) — `npm run smoke:p2p`
- [ ] Guest disconnect → indicator, turns skipped, rejoin resumes the seat with a full snapshot; forfeit after window
- [ ] Host refresh mid-match → "Host reconnecting…", same turn resumes, same terrain hash
- [ ] Host leaves → every guest sees "The host closed the room"; no rewards credited
- [ ] Hot Seat: 2–8 local players on one screen to a winner

## Saved data (localStorage)
- [ ] First run creates a profile; reload keeps level/coins/items/history
- [ ] Rewards credited exactly once per match (reload Results → unchanged)
- [ ] Purchase / equip / unequip; equipped cosmetics visible to everyone in a match
- [ ] Export save → Import on another browser restores everything (same player id)
- [ ] Empty, corrupt and blocked storage: the game still starts (banner when it can't save)

## Screens (each compared with its screenshot)
- [ ] Home (+ 6 modals) · [ ] Lobby · [ ] Machine Select · [ ] Battle desktop · [ ] Battle tablet · [ ] Battle phone
- [ ] Results (real stats, MVP, XP/coins) · [ ] Profile · [ ] Inventory (equip/unequip/locked/purchase) · [ ] Friends
- [ ] Every button performs its action (or is disabled with a reason logged in DECISIONS)

## Quality
- [ ] `npm run test:core`, `npm run smoke:p2p`, client tests green; Playwright suites green
- [ ] Deployed on Vercel (static); deep links and refresh on `/lobby/:code` work
- [ ] No `any`; strict TS passes in all workspaces
- [ ] 55+ fps battlefield with 8 units; works in Chrome, Firefox, Safari, mobile Safari/Chrome
