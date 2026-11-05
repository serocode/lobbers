# Architecture

```
┌──────────────────────── apps/client (Vite + React + TS) ─────────────────────────┐
│  screens/*  ← ported from design/mockup (React DOM)      hud/* (battle HUD, React) │
│        │  read                     ▲ events                     │ intents        │
│        ▼                           │                            ▼                │
│  state/ (Zustand: session, lobby, matchView, settings) ◄──── net/ (colyseus.js)   │
│        │ snapshot + event queue                                   ▲              │
│        ▼                                                          │ WebSocket    │
│  game/ (Phaser 3: BattleScene renders terrain/units/FX; replays server events)    │
│        uses @lobbers/shared for predictTrajectory + Terrain mirror ONLY           │
└──────────────────────────────────────────────────────────────────┼──────────────┘
                                                                   │
┌──────────────────────── apps/server (Node 22) ──────────────────────┼─────────────┐
│  Colyseus: LobbyRoom ── startMatch ──► MatchRoom ── MatchController (state machine)│
│      PresenceRoom (friends online, invites)        uses @lobbers/shared sim       │
│  Hono REST /api: auth(guest JWT) · me · profile · inventory · store · friends ·   │
│                  missions · leaderboards · matches                                │
│  Drizzle ORM ─► PostgreSQL        @colyseus/redis-presence + driver ─► Redis      │
└───────────────────────────────────────────────────────────────────────────────────┘
                     packages/shared: config · sim · rules · lobby · rewards · protocol
```

## Authority split
| Concern | Server | Client |
|---|---|---|
| Turn order, timer, wind, phase | owns (`advanceTurn`, `beginTurn`, `endsAt`) | displays |
| Aim angle/power, weapon choice | validates on fire | local input, preview, throttled `aimUpdate` for others |
| Projectile flight, collisions, explosions, terrain carve | `resolveShot` | replays `tracks` + `events`; mirrors carve on its `Terrain` copy |
| Damage, HP, knockback, falls, eliminations | owns | animates; snaps to snapshot |
| Abilities, ammo, cooldowns, ultimate charge | owns | displays |
| Match result, XP, coins, stats persistence | owns (`computeResults`, DB) | displays |
| Cosmetics equipped | DB (validated ownership) | renders |

## MatchController (server)
```
waiting ──(all clients loaded or 10 s)──► turnStart(beginTurn → broadcast turnStarted)
acting  ──intent fire/move/jump/ability──► validate → resolve → broadcast actionResolved → (fire ⇒ resolving)
        ──timer expires / active disconnects / skipTurn──► turnEnd
resolving ──(durationTicks/60 + grace)──► turnEnd
turnEnd ──endTurn; matchWinner?──► ended (computeResults, persist, broadcast matchEnded) | turnStart(next)
```
- Movement is allowed during `acting` until a shot is fired (`shotsLeft` from `TURN_RULES` + ability extraShots).
- One intent at a time; the room processes messages sequentially (Colyseus does), and the controller rejects anything
  while `resolving`.
- Store the seeded `Rng` state and an action log per match (enables replays and debugging desyncs).

## Client rendering contract
- `matchStarted`: build `Terrain.decodeRLE`, check `hash()`; spawn sprites from `units`.
- `actionResolved`: enqueue; the scene plays tracks/events by tick (60 Hz), applying `carve` to the local terrain mirror
  and texture; at the end snap units to the snapshot and compare `terrainHash`. On mismatch request
  `resyncTerrain` (server re-sends RLE) and log it.
- `turnStarted`: banner, timer from `endsAt` (correct with a server time offset measured at connect).

## Scaling
Colyseus with Redis presence/driver lets multiple server processes share room listings and matchmaking. Rooms are
in-memory; a crash ends the match (acceptable for v1; log it). Persist only completed matches and profile changes.
