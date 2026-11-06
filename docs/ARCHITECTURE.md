# Architecture (peer-to-peer, no backend)

```
        Vercel (static files only: index.html, JS, art)                PeerJS signaling (cloud or self-hosted)
                         │  served once                                  │ only introduces browsers (WebSocket)
                         ▼                                               ▼
┌──────────────── HOST's browser tab ────────────────┐      ┌──────────── GUEST's browser tab (×1–7) ────────────┐
│ screens/ hud/ game/ ← state/ (Zustand) ← PeerClient │      │ screens/ hud/ game/ ← state/ (Zustand) ← PeerClient │
│                                         ▲ loopback  │      │                                         ▲           │
│                                         ▼           │      │                                         │           │
│ net/p2p/peerjs.ts ── HostSession ─┬─ HostLobby      │ WebRTC data channel (JSON, ordered, reliable) │           │
│   (PeerJS peer id                 └─ HostMatch ─────┼──────┼──── net/p2p/peerjs.ts (joinRoom) ───────┘           │
│    lobbers-v2-LOB-XXXX)              uses shared sim│      │                                                    │
│ localStorage: lobbers:profile · lobbers:host:<code> │      │ localStorage: lobbers:profile · lobbers:rejoin:<c> │
└─────────────────────────────────────────────────────┘      └────────────────────────────────────────────────────┘
                     packages/shared: config · sim · rules · lobby · rewards · protocol · host · net · persist
```

- **Star topology.** Every guest has exactly one data channel, to the host. Guests never talk to each other.
- **The host's own UI is a peer too.** It talks to its `HostSession` through `connectLoopback(…, { local: true })`, so
  the React/Phaser code is identical for host and guests (and for Hot Seat, where every seat is a loopback peer).
- **No server code at all.** Vercel serves static files; the PeerJS server only relays WebRTC offers/answers; TURN
  (optional) only relays packets for players whose networks block direct connections.

## Authority split
| Concern | Host engine (`HostSession` in the host's tab) | Every peer's UI (incl. host's) |
|---|---|---|
| Turn order, timer, wind, phase | owns (`HostMatch`: `advanceTurn`, `beginTurn`, `endsAt`) | displays (`MatchView`, clock offset) |
| Aim angle/power, weapon choice | validates on fire | local input, preview on `WorldMirror`, throttled `aim` |
| Projectile flight, collisions, explosions, terrain carve | `resolveShot` | replays `tracks` + `events`; carves its `WorldMirror` |
| Damage, HP, knockback, falls, eliminations | owns | animates; snaps to the snapshot |
| Abilities, ammo, cooldowns, ultimate charge | owns | displays |
| Lobby (seats, teams, ready, settings, chat, kick, start) | owns (`HostLobby`) | sends `LobbyIntent`s |
| Match result | `computeResults` → `matchEnded` | displays; **credits its own profile** (`creditMatch`) |
| Profile, inventory, coins, history, friends | — | own localStorage only (`persist/profile.ts`) |
| Cosmetics equipped | relays them in `LobbyView` / unit names | renders everyone's |

## HostMatch (state machine — `packages/shared/src/host/match.ts`)
```
waiting ──(all peers sent `loaded` | HOST_RULES.loadTimeoutMs)──► acting (turnStarted, timer = endsAt)
acting  ──fire/move/jump/ability──► validate → resolve → actionResolved
        ──fire (no shots left) / active unit died──► resolving ──(anim ticks/60 + resolveGraceSec)──► next turn | ended
        ──timer / skipTurn / active player disconnects──► next turn (AFK counter on timeouts)
paused  (after a host refresh) ──(previous peers back | restoreGraceMs)──► resume the same turn
ended   ──► computeResults → matchEnded → room back to the lobby (Play again)
```
- One intent at a time; anything outside `acting` or from another player is rejected with a reason.
- Every state change calls `onChange` → `HostSession` writes a snapshot (`lobbers:host:<code>`) so an F5 on the host
  resumes the match (same terrain mask, RNG state, turn, timers) — tested in `test/host.test.ts` and the smoke test.

## Peer rendering contract (unchanged from the Colyseus version)
- `matchStarted`: `new WorldMirror(msg)` → Phaser terrain texture from `mirror.world.terrain`; spawn sprites from `units`.
- `actionResolved`: enqueue; the scene plays tracks/events by tick (60 Hz); `mirror.applyAction(msg)` carves and
  returns `false` on a terrain-hash mismatch (log + request a resync by reconnecting: the host re-sends `matchStarted`).
- `turnStarted` / `matchState`: banner, timer from `endsAt` using `client.hostNow()`; `paused` → "Host reconnecting…".

## Client wiring (`apps/client/src/net`)
- `net/p2p/peerjs.ts` — `createRoom` / `resumeHostedRoom` / `joinRoom` over PeerJS (env: `VITE_PEER_*`, `VITE_ICE_SERVERS`).
- `net/p2p/roomService.ts` — the current room (`useLobby` store + `lobbyService`): host / join / resume after F5, one
  in-flight attempt at a time (React StrictMode mounts twice), closed-room reasons, pending match navigation.
- `net/p2p/MatchFeed.ts` — the `MatchTransport` the battle screen consumes, over the room's `PeerClient`. It keeps the
  match messages since the last `matchStarted` (seeded from the client's state, so a host F5 or a remount replays) and
  bumps `generation` on a resync.
- `net/local/HotSeat.ts` — Hot Seat: a `HostSession` with no network; every seat is a loopback `PeerClient`; intents go
  through the active seat's client.

## Limits (accepted for a friends-only hobby game — see DECISIONS)
- The host can cheat (their tab is the authority). Guests cannot.
- Host closes the tab for good → the room ends for everyone (no host migration). A refresh is fine.
- Saved progress is per browser; Export/Import save moves it. Coins can be edited in devtools — it's a hobby game.
- No matchmaking, public room list, global leaderboard, presence or invites-by-push (no server). Replaced by room
  codes, share links, Recent rooms, Recent players, local leaderboard (DESIGN_SPEC §3.9).
