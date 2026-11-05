# Migration: Colyseus + Postgres (kit v1, Phases 0–2 done) → peer-to-peer + localStorage

For a repo that already followed the previous kit through Phase 2 (and possibly part of Phase 3). Goal: same game,
same screens, **no backend** — the room host's tab is the authority, players connect over WebRTC (PeerJS), saved data
lives in localStorage, the site is static on Vercel. Battle rendering, HUD, screens and content work are kept.

Do it on a branch (`git switch -c p2p-migration`) and in this order; each step ends green before the next.

## 1 · Bring in the new shared code (merge, don't overwrite blindly)
Your `packages/shared` may have changed since the kit. Copy these from the kit and merge with your edits:

| File | Kit change |
|---|---|
| `src/host/clock.ts`, `src/host/lobby.ts`, `src/host/match.ts`, `src/host/session.ts` | **new** — authoritative lobby + match + session that run in the host's tab |
| `src/net/codec.ts`, `src/net/client.ts`, `src/net/loopback.ts`, `src/net/mirror.ts` | **new** — message validation, peer session state, in-memory link, local world mirror |
| `src/persist/store.ts`, `src/persist/profile.ts` | **new** — localStorage profile (replaces the DB) |
| `src/protocol.ts` | `PROTOCOL_VERSION`, `PeerProfile`, `SessionIntent`, `forfeit` intent, `LobbyView`, `MatchView`, `HostMessage`, `matchId`/`props` on match messages, `shots`/`hits` on `PlayerResult` |
| `src/config/match.ts` | `HOST_RULES` |
| `src/lobby.ts` | optional display fields on `LobbyPlayer` (level, rating, title, cosmetics) |
| `src/sim/events.ts`, `src/sim/combat.ts` | `'forfeit'` damage cause; no kill credit on forfeit |
| `src/sim/world.ts`, `src/rules.ts` | Items On = every weapon (`createUnit(…, fullArsenal)`), `canUseWeapon` checks the unit's ammo table |
| `src/rewards.ts` | `shots`, `hits` in results |
| `src/index.ts` | exports for the new modules |
| `test/host.test.ts` | **new** — 12 tests: lobby over the wire, full matches over loopback, rejection, timers/AFK, disconnect/rejoin, reconnect window, host refresh, profile |

If your Phase 2 `MatchController` (apps/server) has behaviour the kit's `HostMatch` lacks (e.g. capture-the-hill
scoring, best-of-3 rounds, emote relay), **port it into `HostMatch`** with a test — don't keep two engines.
Check: `npm run test:core` green (kit: 36 tests) and `tsc` clean.

## 2 · Transport + client state
1. `npm i peerjs@^1.5 -w @lobbers/client`; remove `colyseus.js`.
2. Add `apps/client/src/net/p2p/peerjs.ts` from the kit (`createRoom`, `resumeHostedRoom`, `joinRoom`, `p2pConfigFromEnv`).
3. Replace the Colyseus client layer. Your Phase 2 `NetMatchController` (same interface as Phase 1's
   `LocalMatchController`) becomes `P2PMatchController` over a `PeerClient`:
   - Colyseus `room.state` listeners → `client.on('lobbyState' | 'matchState', …)` into the same Zustand stores
     (`LobbyView` / `MatchView` carry the same fields the schema had).
   - `room.onMessage('matchStarted' | 'turnStarted' | 'actionResolved' | 'aimUpdate' | 'matchEnded' | 'rejected')`
     → `client.on(…)` — **message names and payloads are unchanged**, so `BattleScene` and the HUD keep working.
   - `room.send(intent)` → `client.send(intent)`. Send `{ t: 'loaded' }` when the battle scene is ready.
   - Terrain mirror → `new WorldMirror(matchStarted)` + `mirror.applyAction(msg)` (also feeds the preview).
   - Server time offset → `client.hostNow()` / `client.turnMsLeft()`.
4. Phase 1 hot-seat: replace `LocalMatchController` with `HostSession` + one loopback `PeerClient` per seat
   (DESIGN_SPEC §3.9 Hot Seat). One engine for online and local.
5. App start: if `localStorage['lobbers:hostRoom']` exists → `resumeHostedRoom(code)` (host refresh); if the URL has
   `?join=LOB-XXXX` → Join flow.
Check: two browser windows on your machine can create/join a room and play (local PeerServer:
`npx peerjs --port 9000`, `.env.local` with `VITE_PEER_HOST=localhost …`).

## 3 · Persistence: REST + Postgres → localStorage
| Old (kit v1) | New |
|---|---|
| `POST /api/auth/guest` → JWT | first-run modal → `createProfile(name, crypto.randomUUID(), now)` (DESIGN_SPEC §3.7) |
| `GET /api/me`, `/profile/:id` | `loadProfile(safeStore(localStorage))` in a `useProfile()` store |
| `/api/me/inventory`, `/catalog`, `/store/purchase`, `/me/equip` | `config/cosmetics.ts` + `purchase()` / `equip()` → `saveProfile()` |
| match persistence + rewards on the server | each peer: `creditMatch(profile, matchEnded, lobbyProfiles)` on `matchEnded` |
| `/api/profile/:id/matches`, achievements | `profile.history`, `profile.progress` |
| friends, requests, presence (`PresenceRoom`) | `profile.recentPlayers` + `starPlayer()`; share links for invites (§3.9) |
| leaderboards | `localLeaderboard(profile)` (Friends tab; Global disabled) |
| missions | local daily missions in `profile.progress` |
Existing dev data in Postgres doesn't need migrating (hobby project). Check: reload keeps your level/coins/items;
corrupt or blocked storage still lets you play (banner).

## 4 · Screens that assumed a server
Apply DESIGN_SPEC §2.1 / §2.2 / §2.5–2.8 / §3.7–3.9: PLAY NOW → host a room; Quick Match tile → Hot Seat; Join Room's
public list → Recent rooms; Friends → Starred / Recent players; Home "Friends Online" → "Your Crew"; Settings → Export /
Import / Reset save; Lobby ping = P2P RTT; host Leave = close room; new `closed` reason cards; "Host reconnecting…".
Log every visible change in `docs/DECISIONS.md` (already pre-filled under "P2P switch").

## 5 · Delete the backend
Remove `apps/server`, `docker-compose.yml`, the Postgres/Redis/JWT env vars, server scripts and server tests (their
behaviour is now covered by `test/host.test.ts` + `smoke:p2p` — port any extra cases first). Update `AGENTS.md` and the
rules if your repo customised them (kit versions: `.agents/rules/host-authority.md`, `architecture.md`, `testing.md`).

## 6 · Deploy (free)
1. `vercel.json` from the kit (static build of `apps/client`, SPA rewrite).
2. Vercel → New Project → import the repo → framework "Other" (the json sets build/output) → Deploy. Hobby plan is free
   for non-commercial use.
3. Optional env vars on Vercel: `VITE_ICE_SERVERS` (add a TURN server if some friends can't connect),
   `VITE_PEER_HOST…` (only if you self-host PeerServer).
4. Test with two real devices on different networks (e.g. laptop on Wi-Fi + phone on mobile data).

## 7 · Verify, then continue Phase 3
`npm run test:core` · `npm run smoke:p2p` · skill `multiplayer-e2e` matrix (1v1–4v4, guest drop/rejoin, host refresh,
host leave) · screenshots vs `design/screenshots` · update `docs/PROGRESS.md` and `docs/ACCEPTANCE.md`. Then resume
Phase 3 where you left off — content work (machines, weapons, maps, cosmetics, sound) is unaffected, except cosmetics
now travel in the `hello` profile (`PeerProfile.cosmetics`) instead of being loaded from the DB.
