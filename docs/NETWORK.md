# Network design (Colyseus 0.16)

Types: `packages/shared/src/protocol.ts`. Validate every inbound message with zod at the room boundary.

## Rooms
| Room | Created by | Joined by | Purpose |
|---|---|---|---|
| `lobby` | Create Room / matchmaker | code (`filterBy(['code'])`), public list, friend join, invite | seats, teams, machines, ready, settings, chat |
| `match` | `lobby` on start (`matchMaker.createRoom('match', {seats, settings, seed})`, then send each client a seat reservation) | reserved seats only | the game |
| `presence` | one shared room (or per-user) | every signed-in client | friends online/offline/in-match status, invites |

Auth: client calls `POST /api/auth/guest` → JWT; pass it in `joinOptions`; rooms verify in `onAuth` and use the user id
as `playerId` (never trust a client-sent id).

## Lobby state (`@colyseus/schema`)
`LobbyState { code, name, isPrivate, hostId, settings: SettingsSchema, players: MapSchema<LobbyPlayerSchema>, chat: ArraySchema<ChatLine>(last 20), phase: 'open'|'starting' }`
Intents: `setTeam`, `setMachine`, `setReady`, `updateSettings` (host), `kick` (host), `startMatch` (host), `chat`.
Server checks with `lobby.ts` and responds with `rejected {intent, reason}` on failure.
On start: `phase='starting'`, broadcast `matchStarting {countdown:3}`, create match room, send reservations, clients
consume them and navigate to `/match/:id`.

## Match state
Schema (small, frequently changing): `MatchState { phase, turnNumber, activeUnitId, endsAt, wind, shotsLeft, offline: MapSchema<number> (playerId → reconnect deadline) }`.
Unit HP/positions are NOT in the schema: they arrive as `actionResolved.units` snapshots so the HUD changes in step with the
replayed animation (DECISIONS, Phase 2). All server messages use the room message type `s` with a `ServerMessage` body.
Messages (large or event-like): `matchStarted`, `turnStarted`, `actionResolved`, `aimUpdate`, `matchEnded`, `rejected`,
`resyncTerrain`.
Intents (room message type `intent`): `aim` (≤10/s, cosmetic, relayed), `move {dir, ticks≤10}`, `jump`, `selectWeapon`,
`useAbility {slot}`, `fire {aim}`, `skipTurn`, `forfeit`. The state machine is `MatchFlow` in `packages/shared/src/match/flow.ts`.
Lobby: intents under `intent`; server notices under `lobby` (`matchStarting`, `matchReady {matchId, reservation}`, `kicked`,
`rejected`); `ping`/`pong` every 3 s for the slot ping; `time` for clock sync (both rooms). Match rooms are created only by a
lobby (HMAC key) and accept reserved seats or the same account rejoining.

## Reconnection
- `onLeave(client, consented)`: if not consented → `unit.connected=false`, broadcast; `await this.allowReconnection(client,
  CONNECTION_RULES.reconnectWindowSec)`. If it was their turn → end it now.
- On success: `connected=true`, send `matchStarted` snapshot (terrain RLE + hash + units + settings) and the current
  `turnStarted`. Client keeps `room.reconnectionToken` in sessionStorage and calls `client.reconnect(token)` on load.
- On timeout or after `maxSkippedTurnsWhileDisconnected` skipped turns → forfeit (unit eliminated, logged; counts as a
  loss; no rewards).
- Lobby: host leaving → `transferHost` (longest-connected); settings are preserved. If the room empties it disposes.
- AFK: `maxConsecutiveTimeouts` expired turns → forfeit.

## Time
Server sends `serverTime` on join and in `turnStarted`; client computes `offset = serverTime - Date.now()` (median of 3
pings) and renders `endsAt - (Date.now() + offset)`.

## Security checklist
JWT on every room/API; zod schemas; clamp numbers (`clampAngle`, `clampPower`, move ticks); rate-limit chat (2/s) and
aim (10/s); max message size; chat length 140 and profanity filter hook; never accept unit ids from clients —
derive from `playerId`; purchases and mission claims are server-side transactions.
