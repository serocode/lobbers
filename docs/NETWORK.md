# Network design (WebRTC via PeerJS)

Types: `packages/shared/src/protocol.ts` (`PROTOCOL_VERSION = 3`). Validation: `packages/shared/src/net/codec.ts`.
Transport: `apps/client/src/net/p2p/peerjs.ts` (the only file that imports `peerjs`).

## Rooms = PeerJS ids
| Thing | Value |
|---|---|
| Room code | `LOB-XXXX` (`generateRoomCode`, alphabet without ambiguous characters) |
| Host peer id | `HOST_RULES.peerIdPrefix + code` → `lobbers-v2-LOB-7Q4K` (taken → new code, up to 5 tries) |
| Guest peer id | random (PeerJS assigns) |
| Data channel | `peer.connect(hostId, { reliable: true, serialization: 'json' })`, payload = JSON string, ≤ `MAX_PEER_MESSAGE_CHARS` |
| Invite link | `https://<your-vercel-app>/?join=LOB-7Q4K` → first-run if needed → Join |

Signaling: PeerJS cloud server by default (free, no account). For tests / independence run `pnpm exec peerjs --port 9000`
and set `VITE_PEER_HOST/PORT/PATH/SECURE`. ICE: STUN by default; add TURN in `VITE_ICE_SERVERS` for players on
networks that block direct connections (often some mobile data / strict NAT). Game traffic is tiny (≈ 1–30 KB per
shot), so a free TURN allowance goes far.

## Session flow
```
guest                                  host (HostSession)
  ── open data channel ───────────────►  connect(link)
  ── hello {v, profile, rejoinToken?} ►  version check → rejoin (token) | lobby.join(profile)
  ◄─ welcome {playerId, rejoinToken, hostTime, code, protocol}
  ◄─ lobbyState {LobbyView}              (again after every lobby change)
  ── ping {clientTime, rtt?} every 2 s ►  (liveness: no message for 8 s → treated as disconnected; rtt → slot ping)
  ◄─ pong {clientTime, hostTime}         (PeerClient.offset = median of last 5 samples; PeerClient.rtt)
  ── LobbyIntent … ───────────────────►  HostLobby.handle → lobbyState | rejected {intent, reason}
  ◄─ matchStarting {countdown, matchId}  (host pressed Start, 3 s)
  ◄─ matchStarted {terrainRLE, units, props, cosmetics, …}   (cosmetics = each unit's resolved loadout)
  ── loaded ──────────────────────────►  first turn when everyone loaded (or 10 s)
  ◄─ matchState {MatchView}              (after every change: turn, phase, connected, paused, reconnectUntil)
  ◄─ turnStarted {…, burnZones} · actionResolved · aimUpdate · emote {unitId, emoteId}
  ── MatchIntent (aim/move/jump/selectWeapon/useAbility/fire/skipTurn/forfeit/emote) ► HostMatch.handle
  ◄─ matchEnded {MatchEndedMsg + mvpHighlight + details}  → peer runs creditMatch on its own profile → room reopens
                                         (the Results tally is host-computed and survives a host refresh: DECISIONS)
  ◄─ closed {reason}                     kicked · room full · match in progress · already joined · version mismatch ·
                                         host closed the room · bad hello
```
The host's own UI receives exactly the same messages through the loopback link.

**Bots (v5).** Host-only `addBot {team, difficulty, machine?}` seats a bot (`bot-<n>`, always ready) and `setBot {playerId,
difficulty}` re-tunes it; `kick` removes it. The host's tab then runs a `PeerClient` + `BotDriver` for that seat over an
in-memory link bound with `connectBot` (no hello/token), so the bot receives the same messages as everyone and sends
ordinary MatchIntents. Lobby players and match results carry `bot`. Bots are re-attached when the host restores a
snapshot. A remote hello with a `bot-` id is closed with `bad hello`.

## Reconnection
- **Guest drops** (network, reload): host marks `connected=false`, broadcasts `matchState`, skips their turns
  (`advanceTurn(…, canAct)`); if it was their turn it ends now. The guest's `joinRoom` retries every 1.5 s; on
  `hello` with the saved `rejoinToken` (localStorage `lobbers:rejoin:<code>`) the host re-binds the seat and sends a
  full sync (`matchStarted` with the current terrain, `matchState`, current `turnStarted`). Window =
  `CONNECTION_RULES.reconnectWindowSec`; after that, or after `maxSkippedTurnsWhileDisconnected` skips → forfeit.
- **Lobby**: a guest who drops before the match is simply removed; they re-join with the code.
- **Host refresh (F5)**: `HostSession` has been writing `lobbers:host:<code>` on every change. On load the app sees
  `lobbers:hostRoom` and calls `resumeHostedRoom(code)` → re-registers the same peer id (retry while the signaling
  server frees it) → `HostSession.restore` → match `paused` until the previous peers are back (or 15 s), then the same
  turn continues with at least 10 s on the clock. Guests just keep retrying.
- **Host leaves for good**: guests retry for the reconnect window, then show "The host closed the room". An explicit
  Leave by the host sends `closed` immediately.
- AFK: `maxConsecutiveTimeouts` expired turns → forfeit.

## Time
Host epoch ms is the reference. `endsAt` comes from the host; peers render `endsAt − client.hostNow()`.

## Security checklist (friends-only, but no guest can break a match)
`parsePeerMessage` on every inbound message (shape, enums, clamps, name/chat cleaning, size cap); identity from the
link binding, never from message fields; host-only lobby actions checked against the bound player; one actor at a
time; chat 2/s and 140 chars; aim relay ≤ 10/s; move ticks ≤ 10; rejoin tokens are random (crypto) and per room; bot seats can only be bound from inside the host's tab.
The host itself is trusted (documented limitation).
