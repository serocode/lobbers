# Lobbers — Design specification for implementation

This document tells you **what each mockup screen is made of, what real data drives it, and what every control must
do**. Exact pixel values, colours and copy live in the `.dc.html` source — when this spec and the source disagree on a
visual detail, the source wins. When they disagree on behaviour, this spec wins.

---------------------------------------------------------------------------------------------------------------------

## 0. Global system

### Stage
- Every menu screen is authored on a **1440×900** stage. Render it in a `<Stage>` wrapper that scales uniformly to fit
  the window (`min(vw/1440, vh/900)`), centred, letterboxed with `#101522`. Never reflow menus.
- The battlefield has three real layouts: desktop 1440×900 (`Battle.dc.html`), tablet 1024×768
  (`BattleTablet.dc.html`), phone landscape 844×390 (`BattleMobile.dc.html`). Pick by viewport: width ≥ 1200 →
  desktop; ≥ 900 → tablet; else phone (and show a "rotate your phone" card in portrait using the panel style).
  Each layout is also stage-scaled to fit its class of viewport.
- The battlefield **world is bigger than the screen** (2400–3000 × 1000–1100 depending on the map). The field area
  (1440×750 desktop, 1024×560 tablet, 844×390 phone) is a **camera viewport** onto it — see §2.4 Camera.

### Type
| Role | Font | Typical sizes |
|---|---|---|
| Display: logo, screen titles, banners, big CTA labels, names on cards | Lilita One 400 | 150 (logo), 64 (banner), 40–52 (titles), 20–34 |
| UI text | Fredoka 400–700 | 11–17 (labels 11–13 at 700, letter-spacing 1.5–2 px, uppercase) |
| Numbers: timers, HP, ammo, codes, stats | JetBrains Mono 500/700, tabular | 10–30 |
Display text on art uses `-webkit-text-stroke: 4–10px #0B0F1A; paint-order: stroke fill;` + `text-shadow: 0 Npx 0 #0B0F1A`.

### Colour
See `tokens/tokens.css`. Rules: dark text (`#101522`) on every coloured fill (red/blue/yellow/green/orange/pink);
off-white on navy; team red `#F45B55` vs blue `#4C9AFF`; **yellow `#FFD166` marks "you", selection and primary CTA**;
green `#5ACB91` = ready / success / HP of your team / XP; rarity common/rare/epic/legendary =
`#A9B3CC/#4C9AFF/#B07CF2/#FFD166`.

### Components (build once in `apps/client/src/components/`)
| Component | Source class | Notes |
|---|---|---|
| `Button` | `.btn` (+ `.dark` for coloured fills) | 3 px ink border, radius 10, `0 4px 0` shadow; hover: brightness 1.12, −2 px, `0 6px 0`; active: +3 px, `0 1px 0`; disabled: grayscale .8 brightness .6; focus: 3 px yellow ring offset 2. Variants: default `#232B42`, primary `#FFD166`, success `#5ACB91`, info `#4C9AFF`, danger `#3A2230`. Also renders as `<a>` (router link). |
| `PlayButton` | Home `.play` + `.shine` | 104 px tall, 4 px border, `0 7px 0`, sweeping shine 3.2 s. |
| `FireButton` | Battle `.fire` | Hexagon clip-path 176×118, red face, darker lip, pulse while it's your turn, press sinks the face 5 px. |
| `Panel` / `HudPanel` | `.panel` / `.hud` | Navy, 3 px border, radius 12, `0 5px 0` shadow (+ inset highlight). HUD is 86% opaque. |
| `Modal` | `.scrim` + `.modal` | Scrim `rgba(8,11,20,.78)`, panel pops in (0.32 s overshoot). Close button 44×44 with X icon. Esc closes. Focus trap. |
| `Toast` | `.toast` | Bottom-centre (menus) / header (social). Green check icon. Auto-hide 2–2.2 s. Errors use red X icon. |
| `Switch` | `.sw` | 52×30 toggle. |
| `Segmented` / `Tab` / `Chip` | `.seg`, `.tab`, `.cat`, `.chip` | Selected = filled (off-white or blue) with dark text. |
| `Meter` | inline bars | Track `#0E1320` with ink border; fill colour by meaning; animated `width` transitions 0.6 s. |
| `TimerRing` | Battle/Machines | SVG ring r=24 (battle) / r=16, stroke-dashoffset per second; colour green → yellow ≤10 s → red ≤5 s with pulse. |
| `MachineArt` | `Machine.dc.html` | Inline SVG; props `kind, tint (team), paint (skin), size, flip, aim (0–90 in art space), pose idle/victory/wreck`. |
| `WeaponIcon` | `WeaponIcon.dc.html` | Props `icon` (Explosive, Cluster, Guided, Electric, Fire, Ice, Special, Drill, Gravity), `color`, `size`. |
| `SceneBackdrop` | `Scene.dc.html` | Used in menus (Home background, lobby map preview, create-room thumbnails, friends room card). |
| `Avatar` | many | Machine art in a rounded square (team-dark ground) or hexagon frame (profile). |

### Icons
Inline stroke SVG only (paths are in the mockups: house, tank, crate, flag, trophy, gear, chevrons, copy, people,
crown, skull, lock, star, bolt…). Never emoji or icon fonts.

### Motion (keep all; keyframes in `styles/*.css`)
Idle bob 2.4–2.6 s · SMIL blink on machines · card pop `cubic-bezier(.2,1.8,.4,1)` · modal pop 0.32 s · toast rise ·
turn banner slide/skew 1.6 s · elimination ribbon 2.2 s · damage numbers rise 1.4 s · screen shake 0.45 s · explosion
layers 0.35–1 s · lobby join pop · ready pulse · countdown 3-2-1 punch · XP bar fill 1.2–1.6 s · confetti · sunburst
rotation 60 s · radar sweep · featured-machine swap. Respect `prefers-reduced-motion`: disable shake, shine, confetti,
sunburst rotation, idle bob; keep state changes.

### Art style (for any new art)
Flat fills, `#151B2B` strokes 2.5 px (machines, 120×100 viewBox) / 3 px (icons, 64×64), round joins, white highlight
strokes at 35–55%, shading with black at 18–20%, team colour on one stripe/flag/scarf element, chunky proportions,
small expressive eyes with a 4–5 s blink.

---------------------------------------------------------------------------------------------------------------------

## 1. Navigation & routes

| Route | Screen | Entry points |
|---|---|---|
| `/` | Home | app start, Leave/Home buttons |
| `/lobby/:code` | Lobby | Play Now / Create Room (you host), Join Room (code), invite link `/?join=LOB-XXXX`, Recent rooms |
| `/lobby/:code/machine` | Machine Select | Lobby "Change Machine", nav "Machines" (outside a room → `/machines` browse mode, Lock In saves the default machine) |
| `/match/:matchId` | Battlefield | host `matchStarted` (auto-navigate all players) · `/hotseat` local pass-and-play (§3.9) |
| `/results/:matchId` | Results | host `matchEnded`; revisits read the local match history. Pause menu "Skip to results" is dev only |
| `/profile` | Profile (yours, from localStorage) | Home profile card, Results "My Profile" (other players: popover only, §3.9) |
| `/inventory` | Inventory | nav "Inventory", Lobby "Customize", Machine Select "Skins for X" (opens Machine Skins tab filtered) |
| `/friends` | Friends & Social | Home "See all", Lobby "Invite Friends" (modal stays in lobby) |
Missions, Leaderboards and Settings are modals on Home (keep them as modals). **Vercel**: every route is an SPA route
(`vercel.json` rewrites to `index.html`) so invite links and refreshes on `/lobby/:code` work.

---------------------------------------------------------------------------------------------------------------------

## 2. Screens

Each section: **Regions** (from the mockup) → **Data** → **Actions** → **Replace mockup-only behaviour**.

### 2.1 Home — `Main.dc.html` (`screenshots/01-home*.png`)
**Regions** — full-bleed `SceneBackdrop` (cobalt, 1440×900) with two looping lobbed shells + pops; dark angled
legibility panel x 0–740; season chip (36, 56); logo "LOBBERS" (LOB yellow / BERS off-white, 150 px, −3°, dotted arc +
shell above) and red ribbon "4 v 4 ARTILLERY MAYHEM"; CTA stack at (56, 430) w 470: PLAY NOW + 3 tiles (Quick Match
blue, Create Room green, Join Room red); featured machine stage at (640, 236) 420×540 with ◀ ▶; bottom nav (24, 800)
1012×80 six items; right panel (1060, 24) 356×856: profile card, Recent Activity, Friends Online.
**Data** — the local profile (`loadProfile`: name, title, level, xp, `REWARDS.xpForLevel`, rating, coins, gems,
favourite machine), Recent Activity = last 4 `profile.history` entries, the right-hand friends panel = starred + recent
players (`profile.recentPlayers`, §3.9), season chip from a static `config/season.ts`. Featured machine list = `MACHINE_LIST`.
**Actions** — PLAY NOW → opens Create Room prefilled (you host; sub-label "Host a room for your friends"). Quick Match
tile → **Hot Seat** (§3.9). Create Room modal → room name, map (6 thumbnails), mode → `createRoom()` (PeerJS) →
navigate to `/lobby/:code`; the private switch is removed (every room is private — joined by code or link).
Join Room modal → code input (`LOB-XXXX`, uppercase, validated) → `joinRoom(code)`; the "Open rooms near you" list
becomes **Recent rooms** (last 4 codes you hosted/joined, from localStorage; Join tries them and shows "Room closed"
if the host is gone). Missions modal → local daily missions (`profile.progress`, reset at local midnight; progress is
updated by `creditMatch` results), Claim adds coins to the local profile. Leaderboards → Friends tab =
`localLeaderboard(profile)`; Global tab disabled with tooltip "Needs a server — not in this version". Settings →
`profile.settings` (volumes, screen shake, trajectory preview, camera follows shots, damage numbers, quality) +
**Export save / Import save / Reset** (§3.9). Friend row button: Invite = share/copy the room link when you are in a
room; Join/Watch are removed (no presence without a server). Profile card → Profile.
**Replace** — mock activity/friends/leaders/missions arrays, fake matchmaking timer.

### 2.2 Lobby — `Lobby.dc.html` (`02-lobby*.png`)
**Regions** — header: Leave, room name + "{mode} · Private room · Host: {name}", room code + Copy, player
count n/8, "P2P · {ping} ms" (round-trip to the host from `PeerClient` pings; the host shows "You are hosting"). Team Red column x 24 / Team Blue x 1016 (w 400): chamfered team band (count, avg level) + 4
slots (136 px). Centre (444, 104) w 552: map preview (Scene) with "MAP i / 3", size chip, VS badge, ◀ ▶; map name +
description; 6 setting buttons (Mode, Turn Timer, Wind, Items, Friendly Fire, Rounds); chat panel. Footer: Change
Machine, Customize, Invite Friends, Copy Room Code, Switch to {Team}, "{n} not ready", READY UP / READY!, START MATCH.
**Slot states** — filled (portrait with team stripes + bob, name, YOU chip, host crown, title, machine · role, READY /
NOT READY pill, LV, ping bars + ms), empty (dashed "Open slot · Click to invite a friend" → opens Invite modal
pre-targeted), connecting (spinner "Connecting…"), **disconnected** (see §3.4).
**Data** — `PeerClient.lobby` (`LobbyView` from the host): players (id, name, title, level, rating, team, slot, machine,
ready, connected, isHost, cosmetics), settings, code, chat (last 5 visible), phase.
**Actions** — all are intents (`protocol.ts LobbyIntent`): setTeam (Switch), setMachine (from Machine Select),
setReady, updateSettings (host only: map ◀ ▶ and setting buttons cycle `SETTING_OPTIONS`; non-hosts see them
read-only with tooltip "Only the host can change this"), chat (Enter/Send, quick "gl hf"), kick (host: X on slot hover
— addition, §3.6), startMatch (host only; enabled when `validateStart` passes, otherwise the reason shows as the
footer info text). Copy Room Code copies `LOB-XXXX`; Invite Friends opens the share sheet (`navigator.share`) with
`https://<site>/?join=LOB-XXXX`, falling back to copy. Leave → guests: `leave` → Home; **host: confirm "Close the room
for everyone?"** → `room.close()`. Countdown overlay (3-2-1 + DEPLOYING! bar) is driven by the host's `matchStarting`
broadcast; all peers navigate together on `matchStarted`.
**Validation (host engine)** — 8 max, 4 per team, 2 min, host-only start, all non-host players ready (`HostLobby`).

### 2.3 Machine Select — `Machines.dc.html` (`03-*.png`)
**Regions** — header: Lobby back, "CHOOSE YOUR MACHINE", TEAM chip, Random, LOCK-IN ring timer. 4×2 card grid
(x 24, w 824, cards 318 tall, number keys 1–8, SELECTED / "Picked by X" badges, mini stat bars). Detail panel (872,
108) 544×668: striped stage in machine colour, spotlight cone, rotating dashed ring, pedestal, big machine (drop-in +
bob + flash), role, name, description, 4 stat bars (HEALTH shows max HP), 3 weapon chips, SPECIAL box. Footer: TEAM
PICKS (teammates' live picks), composition hint, "Skins for X", LOCK IN → BACK TO LOBBY.
**Data** — `MACHINE_LIST` (stats, derived max HP, loadout first 3 weapons, special) + teammates' machines from the
lobby view. Lock-in timer: not used (no ranked queue).
**Actions** — select (click/keys 1–8), Random, LOCK IN → `setMachine` intent, then back to lobby. Duplicate machines
on a team are allowed (badge "Picked by X" is informational). Add the **Ultimate** line under SPECIAL in the same box
style with the purple accent `#B07CF2` (addition, §3.2).

### 2.4 Battlefield — `Battle.dc.html` (desktop), `BattleTablet.dc.html`, `BattleMobile.dc.html` (`04*.png`)
The most important screen. **Phaser canvas = the field area (0,0)–(1440,750) on desktop**, a camera onto a world of
`map.width × map.height`; **React HUD** is everything else (it never scrolls with the camera).
**Camera (Gunbound-style; numbers in `packages/shared/src/config/camera.ts`, screenshots `04-battle`, `04c`, `04d`,
`04e`, `04h`)**
1. *Match intro* — whole-map overview (fit zoom) for `introOverviewMs`, then fly in to the first active machine.
2. *Turn start* — pan (`panMs`, ease) to centre the active machine, `focusAboveUnit` px above its feet so the sky it
   shoots into is visible. Applies to your turn and to other players' turns (spectators watch who is aiming).
3. *Fire* — when the shot is released the camera **follows the projectile** (lerp `followLerp`) wherever it goes,
   including off the visible area; multiple projectiles (cluster, airstrike) → follow the lead/average.
4. *Impact* — stop on the explosion, shake, **hold** `holdOnImpactMs` (barrel chains and falls play out here), then
   step 2 for the next player.
5. *Free look* — drag on the field (after `dragThresholdPx`) or mouse wheel pans; hint chip bottom-left "Drag to look
   around · F focus · Z overview". Buttons bottom-left of the field: **Focus** (F) and **Overview** (Z, toggles fit
   zoom; pressed state yellow, chip "Overview · Z to zoom back in"). Free look never changes aim. Any new turn or
   shot snaps back to the automatic camera. Pause-menu switch "Camera follows shots" (off = stay put on fire).
6. *Minimap* — top-right, under the log button, 260 px wide (height from the map aspect): terrain silhouette,
   team-coloured dots (active pulses), shell dot while flying, a yellow viewport rectangle. Click = pan there.
7. *Off-screen marker* — when the active machine is outside the view, a yellow arrow + name pinned to the nearest
   edge (`edgeMarkerInset`) pointing at it.
8. *Parallax* — background SVG scrolls at `parallaxBack` (0.6); terrain, props, machines, shells at 1.
**Maps (6)** — Cobalt Crags 2400×1000, Ember Basin 2800×1000 (lava), Glacier Rift 2600×1050 (icy water), Sunscar
Dunes 3000×1000 (longest shots), Skyreach Isles 2800×1100 (three floating islands with chasms → void), Glowcap Hollow
2600×1000 (glowing mushrooms). Previews `screenshots/c3-scene-<map>.png`; art in `assets/maps/`.
**Interactive props** — explosive barrels (red, hazard stripe): any blast reaching them detonates them (damage 130,
radius 54, chain to other barrels after a short delay, credited to the shooter); repair crates (wooden, green cross):
driving over one heals +150 and removes it; blasts destroy crates. Props sit on the terrain and fall when the ground
under them is carved. Knockback can throw machines into craters, chasms and the hazard.
**World layer** — see skill `battlefield-renderer`: backdrop, destructible terrain, decorations, machines (team tint,
facing, barrel at aim), name tag + HP bar per unit (yellow border = you, red/blue = teams), bouncing yellow arrow over
the active unit, wrecks for eliminated units, projectiles + trails, explosions, bolts, burn zones, frozen overlay,
floating damage numbers, trajectory preview (own turn only), camera shake.
**Top HUD** — pause (14, 14); Team Red panel (80, 12) 452×100: RED chip, "n/4 alive", team HP bar + "hp / max", 4
member chips (portrait, name or "You", HP bar, HP number / OUT, skull when eliminated, pulsing yellow border when
active); Current Turn panel (546, 12) 348×100: portrait, TURN n, active name in team colour, status line, TimerRing;
Team Blue panel mirrored (908, 12); combat-log toggle (right 14). Kill feed under it (right 14, top 126). Combat log
panel (right 14, top 488) 300×246, newest first, team-coloured bullets.
**Overlays** — turn banner ("YOUR TURN" yellow / "{NAME}" team colour, sub "Turn n · wind w → · 30 seconds"),
elimination ribbon (red slab with wreck portrait, "{NAME} ELIMINATED"), hurt vignette when you take damage, waiting
chip above the controls ("{name} is taking their turn…").
**Controls deck** (0, 750) 1440×150 — player card (portrait aims with you, HP, fuel + move buttons); weapon block
(current weapon button → Armory, DMG/RAD/ammo, key W; 4 quick slots with keys 1–4 and ammo); angle dial; power meter
(drag, ticks, last-shot marker, − / +, "last shot n"); wind (arrow direction & colour by strength, 6 bars, value);
special button (charges/cooldown number); FIRE. All disabled when it is not your turn or the action is resolving.
Kill feed sits under the minimap (`top = 120 + minimapHeight + 16`); combat log bottom-right above the deck
(bottom 166, max-height 214).
**Armory modal** — 1120×640: tabs `ARMORY_TABS` with counts; 4-column weapon cards (icon, category, name, DMG, RAD,
AMMO, CD, selected yellow, COOLDOWN · n TURNS / OUT OF AMMO overlays); right detail pane (big icon, category, name,
description, damage/radius bars, ammo, cooldown, EQUIP / EQUIPPED / UNAVAILABLE). Hover/focus previews the weapon;
click equips and closes. The info line reads "Items: On — full arsenal this match": with the **Items** room setting
On, all 10 weapons are listed (the mockup shows this); with Items Off only the active unit's loadout
(`MACHINES[kind].loadout`) is listed.
**Pause menu** — RESUME, Trajectory preview switch, Screen shake switch, Camera follows shots switch, ~~Skip to match results~~ (dev only),
"Surrender & return home" → confirm dialog → `forfeit` intent (unit eliminated, counts as a loss). For the HOST the
dialog says the room stays open until the match ends (the host's tab keeps running the match while they spectate).
**Victory/defeat overlay** — "VICTORY!" / "DEFEAT" + winners in victory pose; SEE RESULTS, Play again (host → new
lobby with the same players; others: "Waiting for host"), Back to lobby.
**Data** — `PeerClient.match` (`MatchView`: units, active unit, turn number, phase, endsAt, wind, connected, paused) +
`matchStarted` / `actionResolved` / `turnStarted` / `aimUpdate` messages, and a `WorldMirror` for terrain + preview. Other players' live aim (barrel angle, weapon) arrives via
`aimUpdate` (throttled 10 Hz) so spectators see the barrel move.
**Actions → intents** — aim (mouse/keys/drag), move (hold ←/→ sends `move` every 100 ms with ticks=6), jump (J or
button), selectWeapon, useAbility (special / ultimate), fire, skipTurn (not in mockup; Esc menu "End turn" — optional).
**Tablet** (Sunscar Dunes in the mockup, zoom 0.8) and **Phone** (Glowcap Hollow, zoom 0.55) use the same camera
rules, with drag-to-pan and a Focus button; the phone aim pad does not pan (it stops propagation).
**Tablet** — compact team strips + turn pill at top; 6 big weapon buttons row; move buttons, angle stepper, big power
slider, wind, FIRE. **Phone** — mini team portraits + "YOUR TURN · timer · wind" pill; ◀ ▶ + 3 big weapon buttons +
More (bottom sheet); drag-to-aim pad (angle + power) with readout; round FIRE 88 px.

### 2.5 Results — `Results.dc.html` (`05*.png`)
**Regions** — rotating sunburst + confetti (winner team colour), "VICTORY!" (or "DEFEAT" in blue for the losing
viewer — the headline is from the viewer's perspective, the ribbon says "TEAM X WINS"), meta line (mode · map · turns ·
duration), podium (winners in victory pose, MVP crown, 1–4 by score), MVP card (name, highlight line, damage, elims,
accuracy), defeated team row (wreck pose), Player Rankings table (sortable: DMG, RECV, ELIM, AST, ACC, XP, COIN; you
highlighted), Your Rewards (XP bar animates from old to new, level-up burst if `applyXp` gains a level, +XP, +coins
count-up, mission progress), footer: PLAY AGAIN, Return to Lobby, Return Home, My Profile, View Match Details (per-turn
damage chart, weapon usage cards).
**Data** — `MatchEndedMsg` (host-computed with `computeResults`). On arrival each peer runs `creditMatch` on its own
profile (idempotent) and the Rewards panel animates from the returned `xpGained / coinsGained / levelsGained`.
Revisits (`/results/:matchId` from history) read `profile.history`. The MVP highlight line is computed on each peer
from the `actionResolved` events it played (biggest single hit / final blow); on revisits show the stored summary.

### 2.6 Profile — `Profile.dc.html` (`06-profile.png`)
Identity card (hex avatar with equipped skin, level badge, rank shield + SR, name, title, member since, XP bar,
Change title → title picker from owned titles, Customize → Inventory), equipped cosmetics list, career stats (win-rate
ring, matches, wins, losses, accuracy, favourite machine = most played), match history (All / Wins / Losses tabs,
paginated 8 per page, row → Results of that match), achievements (12 tiles; locked show progress; click shows detail).
**Data** — the local profile: `stats`, `history` (last 30, paginated 8), `equipped`, `progress` (achievements).
Only your own profile exists; other players get the popover card (§3.9).

### 2.7 Inventory — `Inventory.dc.html` (`07*.png`)
Category rail (8 categories with owned/total), total collection meter, items grid (preview by type: machine/skin/avatar
→ `MachineArt` with `paint`; weapon skin → `WeaponIcon`; trail → animated dashed arc; explosion → pulsing starburst;
emote → speech bubble; title → nameplate), filters All/Owned/Locked, rarity strip, EQUIPPED / lock badges, preview
pane with description, source/unlock requirement, action button: EQUIP / EQUIPPED / UNLOCK · {price} / NOT ENOUGH
{currency} / LOCKED.
**Data** — `config/cosmetics.ts` (catalog: ids, names, rarities, prices, requirements — from Inventory.dc.html) +
`profile.owned` / `profile.equipped`.
**Actions** — `equip(profile, slot, itemId)` / `equip(profile, slot, null)` (add an "Unequip" secondary button for
non-default slots — trails, explosions, titles, emotes fall back to defaults), `purchase(profile, item)` (checks balance;
requirements checked against `profile.stats`/level). Save with `saveProfile`. Equipped cosmetics travel in your
`hello` profile, so everyone renders them in matches.

### 2.8 Friends & Social — `Friends.dc.html` (`08*.png`)
Header add-friend input + Add; tabs Online / Offline / Requests / Recent players with counts; rows with avatar +
presence dot (green online, yellow in match, grey offline), name, level, title, status line; actions: Join room (friend
in a joinable lobby), Invite (you are in a room), Accept/Decline (requests), Add friend / Request sent / Friends
(recent), Message (offline — out of scope: disabled with tooltip unless chat is built), profile popover. Right: Your
Room card (name, mode, map, code, 8 mini slots, pending invites with live status, Invite all online, Copy invite link,
OPEN LOBBY). When not in a room the card shows "Create a room to invite friends" + Create Room.
**Data** — `profile.recentPlayers` (everyone you've finished a match with: last-known name, level, rating, title,
matches together, starred). No presence, requests or messages (no server) — see §3.9 for the adapted tabs and actions.

---------------------------------------------------------------------------------------------------------------------

## 3. Additions required by the brief (not in the mockup) — build exactly like this

### 3.1 Angle 0–180°
The dial path already spans a full upper semicircle (`M8 58 A52 52 0 0 1 112 58`). Use it for 0–180: yellow arc from
the right end (0°) counter-clockwise to the needle; needle length 48. Range input `min 0 max 180`. Facing is derived
from the angle (≤ 90 faces right). Label stays "ANGLE ↑↓". The value text shows `n°`.

### 3.2 Ultimate ability button
Special column becomes 172 px wide (shrink POWER block 270 → 230 and WIND 112 → 100). Two 64 px circles side by
side: SPECIAL (orange `#F28C38`, star) and ULTIMATE (purple `#B07CF2`, crown/burst icon) with a charge ring (SVG circle
r 34, 5 px stroke `#FFD166` dasharray by `charge/100`), label under each (11 px 700): name / "RECHARGING n" / "ARMED".
Ready ultimate pulses with the existing `.pulse` keyframe. Machine Select SPECIAL box gains an ULTIMATE row (purple).

### 3.3 Jump
Player-card move row: `← · FUEL meter · → · ⤒` (jump button 40×32, chevron-up icon, key J). Disabled when frozen,
airborne or fuel < 12.

### 3.4 Disconnected state
- Lobby slot: ping bars → pill "RECONNECTING m:ss" (`#2A3045` ground, `#C9D1E0` text, `.wait` pulse); portrait
  grayscale 0.7.
- HUD member chip: opacity .55 + 18 px badge top-right (grey circle, wifi-off stroke icon).
- Unit name tag: grey tag "OFFLINE m:ss" in JetBrains Mono 11 px.
- Kill feed / combat log: "{name} disconnected", "{name} reconnected", "{name} forfeited".

### 3.5 Status effects on units
16 px circles left of the name tag: frozen (cyan `#9FE3FF`, snowflake), shield (purple `#B07CF2`, shield), burning
(orange `#FF6B3D`, flame), unlimited fuel (green, bolt). Frozen units also get an ice overlay sprite.

### 3.6 Lobby host tools
Host sees a 28×28 X button on other players' slot hover → confirm → kick. Public/Private toggle in the header subtitle
(click when host). Room settings show a lock icon for non-hosts.

### 3.7 First-run name & local profile
On first launch (no `lobbers:profile`) show a modal in the Create Room style: "Pick your lobber name" (3–16 chars,
`cleanName`), starter machine pick (the 5 owned starters as small cards), CTA "LET'S LOB", and a small secondary link
"I have a save code" → Import save. Creates `createProfile(name, crypto.randomUUID(), Date.now())` and saves it.
If storage is unavailable show a yellow banner on Home: "Progress can't be saved in this browser (private mode?)" and
keep the profile in memory for the session.

### 3.8 Errors and connection
Rejected intents → red toast with the host's reason. Guest lost the host → full-screen scrim card "Reconnecting…"
(radar sweep from the Quick Match modal) with the `reconnectWindowSec` countdown and "Leave match".
Host refreshed (match `paused`) → turn panel status line "Host reconnecting…" (yellow, `.wait` pulse), timer ring
frozen, controls disabled; no scrim. `closed` reasons → one card in the modal style with a single "Back to Home" button:
"Room not found" (bad code / host gone before you joined), "Room is full", "This match already started",
"You're already in this room in another tab", "A newer version is out — refresh the page" (version mismatch),
"The host closed the room", "You were removed by the host".

### 3.9 Peer-to-peer adaptations (no server) — build exactly like this
- **Hot Seat** (Home tile that was Quick Match; blue, same size; icon = two overlapping controllers drawn in the
  mockup's stroke style; label "Hot Seat", sub "Pass & play on one screen"). Opens a modal like Create Room: map,
  mode, 2–8 local players (name + machine each). Runs a `HostSession` with no network: every seat is a `PeerClient` over
  `connectLoopback`, and the battle HUD controls whichever seat is active (turn banner "PASS TO {NAME}"). No rewards.
- **Friends screen** tabs: "Starred" / "Recent players" (Requests and Online/Offline tabs removed). Row: avatar, name,
  LV, title, "played n× · last {date}"; actions: ☆ Star / ★ Starred (`starPlayer`), Invite (only when you're in a room:
  share/copy link). The add-friend input becomes "Join by code" (same input style, validates `LOB-XXXX`). Right "Your
  Room" card unchanged except "Invite all online" → "Share invite link". Profile popover shows what you know (last
  name, level, rating, matches together) — no "View full profile".
- **Home right panel** "Friends Online" → "Your Crew" (starred first, then recent; max 5) with the same row style;
  no presence dots (use the level badge in that spot).
- **Settings modal** gains a "Save data" group (panel style rows): Export save (shows the `exportProfile` code in a
  mono text area + Copy), Import save (paste → `importProfile` → confirm "Replace this device's progress?"), Reset
  progress (red, confirm). Plus "Connection: STUN only / TURN configured" read-only line from env.
- **Lobby** host leaving = room closes (no host transfer). Kick stays (§3.6).

---------------------------------------------------------------------------------------------------------------------

## 4. Content mapping mockup → shared config

| Mockup | Implementation |
|---|---|
| 10 weapons in `Battle.dc.html` (same ids as the brief) | `config/weapons.ts` (Armory is data-driven) |
| Machine stats/descriptions | `config/machines.ts` (same ratings; HP = health × 100 + 100) |
| Specials | same names/effects in config; ultimates added |
| 6 maps (`MAPS` in Scene/Battle), spawns, props | `config/maps.ts` (same shapes, palettes, spawns, props) |
| Camera behaviour | `config/camera.ts` |
| Mock players/levels/currency/history | localStorage profile (`persist/profile.ts`, see `docs/DATA_MODEL.md`) |
| Mock AI turns | real players over WebRTC (bots out of scope; Hot Seat for local play) |
