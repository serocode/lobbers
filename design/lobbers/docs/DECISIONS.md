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
