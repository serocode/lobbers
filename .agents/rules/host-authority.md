---
trigger: glob
globs: packages/shared/src/host/**, packages/shared/src/net/**, packages/shared/src/protocol.ts, apps/client/src/net/**, apps/client/src/state/**
description: Peer-to-peer trust model, turn safety, reconnection and host-refresh rules.
---

# Host authority (peer-to-peer)

- The **host's browser tab** runs `HostSession` (`packages/shared/src/host/session.ts`). It alone owns: turn order,
  active player, turn timer, wind, ammo/cooldowns, ability charges, all simulation, damage, HP, positions,
  eliminations and the match result. It is the only thing that calls `resolveShot` / `walk` / `jump` /
  `activateAbility` / `beginTurn` / `computeResults` during a match.
- Every player's UI — including the host's own — is a `PeerClient` (host: `connectLoopback(session, client, { local: true })`).
  React/Phaser code must never import `HostSession`, `HostMatch` or `HostLobby` (lint rule / code review).
- Inbound messages: size-capped (`MAX_PEER_MESSAGE_CHARS`), parsed by `parsePeerMessage` (drop on null), then checked by
  `rules.ts` / `lobby.ts`. Reject with `rejected {intent, reason}`; never partially apply. Identity = the link's bound
  `playerId` (from `hello`, or the rejoin token) — never a playerId inside a message.
- One actor at a time: `HostMatch` phases `waiting → acting → resolving → (next turn | ended)`; intents in any other
  phase or from another player are rejected. Resolve one action fully before accepting the next.
- Time: the host clock is authoritative (`endsAt` in host epoch ms). Peers render with `PeerClient.offset`.
  Timers live in `HostClock` (inject `ManualClock` in tests).
- Randomness (wind, damage variance, seeds, tokens) only on the host (`createRng(seed)`; seed from `crypto`).
- Disconnects: seat kept for `CONNECTION_RULES.reconnectWindowSec`, `connected=false` shown, turns skipped; forfeit after
  `maxSkippedTurnsWhileDisconnected` skips or window expiry. Active player drops → turn ends now. AFK: 3 timeouts → forfeit.
- Rejoin = same profile id + the rejoin token the host issued (`PeerClient` keeps it in localStorage per room code).
- **Host refresh**: `HostSession` persists a snapshot to localStorage on every change; on reload `resumeHostedRoom`
  re-registers the same peer id and `HostSession.restore` resumes (match paused until previous peers reconnect or
  `restoreGraceMs`). **Host leaves for good** → room closes for everyone (`closed: host closed the room`); no host
  migration in v1 (DECISIONS).
- Peers apply rewards to their OWN profile from `matchEnded` (`creditMatch`, idempotent per matchId). The host never
  writes other players' profiles.
- Trust level: friends-only hobby game. The host could cheat; don't build anti-cheat, but never let a *guest* message
  change outcomes.
