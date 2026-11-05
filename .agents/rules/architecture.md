---
trigger: always_on
description: Module boundaries and code standards for the Lobbers monorepo.
---

# Architecture boundaries

```
packages/shared   config/ (data)  sim/ (physics, terrain, combat, weapons, abilities, turns)  rules.ts  lobby.ts  rewards.ts  protocol.ts
apps/server       rooms/ (Colyseus LobbyRoom, MatchRoom)  match/ (MatchController: turn loop over shared sim)
                  lobby/  api/ (Hono REST: auth, profile, inventory, friends, leaderboards)  db/ (Drizzle schema + repos)  auth/
apps/client       app/ (router, providers)  screens/ (one folder per mockup screen)  components/ (Button, Panel, Modal, Toast…)
                  hud/ (battle HUD in React)  game/ (Phaser: scenes/, render/ — draws state, never decides it)
                  net/ (Colyseus client, message handlers, reconnection)  state/ (Zustand stores: session, lobby, match view)
```

- `game/` (Phaser) reads match state and plays server events. It must not import React; React HUD must not import Phaser.
  They meet through a typed event bus / store in `state/`.
- Only `packages/shared/src/config` holds tunable game numbers. UI reads them; server reads them.
- Weapons and abilities are data + registered behaviours (`sim/behaviors.ts`). Adding a weapon must not require editing
  `shot.ts`, rooms or UI components.
- Server state that must sync goes in Colyseus `@colyseus/schema` classes mirroring shared types; big payloads
  (terrain RLE, shot tracks/events) go as messages (`protocol.ts`).
- TypeScript strict, no `any`, no non-null assertions on network data (validate with zod at the server edge).
- Prefer pure functions + small modules; React components ≤ ~300 lines; no direct DOM manipulation where React state works.
