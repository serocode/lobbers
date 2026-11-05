---
trigger: glob
globs: apps/server/**, packages/shared/**, apps/client/src/net/**
description: Multiplayer trust model, turn safety and reconnection rules.
---

# Server authority

- The server owns: turn order, active player, turn timer, wind, ammo/cooldowns, ability charges, all simulation,
  damage, HP, positions, eliminations, match result, rewards, and persistence of stats.
- Accept only `ClientIntent` messages. Validate shape with zod, then game legality with `rules.ts`
  (`checkActor`, `validateFire`, `canUseWeapon`) and `lobby.ts` (`validateStart`, `canSwitchTeam`…). Reject with a
  `rejected` message and a reason; never partially apply.
- Exactly one actor at a time: a `MatchController` state machine `waiting → acting → resolving → (next turn | ended)`.
  Intents arriving in any other phase or from another player are rejected. Resolve one action fully before accepting
  the next (queue nothing).
- Turn timer runs on the server (`endsAt` epoch ms broadcast). On expiry: end the turn; count a timeout for AFK rules.
- Randomness (wind, damage variance) uses the match's seeded `Rng` on the server only.
- Disconnects: keep the seat (`allowReconnection(client, CONNECTION_RULES.reconnectWindowSec)`), mark
  `connected=false`, show the indicator, skip that player's turns via `advanceTurn(…, canAct)`. After
  `maxSkippedTurnsWhileDisconnected` skips or window expiry → forfeit (unit eliminated with cause `hazard`/forfeit,
  logged). If the active player drops mid-turn, end their turn immediately. Host leaves → `transferHost`.
- On reconnect send a full snapshot: `matchStarted` (terrain RLE + hash + units + settings) and the current turn.
- Rate-limit chat and aim updates; cap move ticks per message; clamp all numbers.
