---
trigger: always_on
description: Module boundaries and code standards for the Lobbers monorepo.
---

# Architecture boundaries

```
packages/shared   config/ (data)  sim/ (physics, terrain, combat, weapons, abilities, turns)  rules.ts  lobby.ts  rewards.ts
                  protocol.ts (wire types)  host/ (HostSession, HostLobby, HostMatch, clocks — the authority)
                  net/ (PeerClient, codec, loopback, WorldMirror)  persist/ (KeyValueStore, LocalProfile)
apps/client       app/ (router, providers)  screens/ (one folder per mockup screen)  components/ (Button, Panel, Modal, Toast…)
                  hud/ (battle HUD in React)  game/ (Phaser: scenes/, render/ — draws state, never decides it)
                  net/p2p/ (PeerJS transport: createRoom, resumeHostedRoom, joinRoom)  state/ (Zustand stores fed by PeerClient)
                  persist/ (profile store hook over localStorage)
```

- `game/` (Phaser) reads match state and plays `actionResolved` events. It must not import React; React HUD must not
  import Phaser. They meet through a typed event bus / store in `state/`.
- UI talks to the network **only** through a `PeerClient` (`state/` subscribes with `client.on`). Only `net/p2p/` imports
  `peerjs`. Only `net/p2p/` creates a `HostSession`.
- Only `packages/shared/src/config` holds tunable game numbers. UI reads them; the host engine reads them.
- Weapons and abilities are data + registered behaviours (`sim/behaviors.ts`). Adding a weapon must not require editing
  `shot.ts`, the host engine or UI components.
- Saved data goes through `persist/profile.ts` pure functions (`creditMatch`, `purchase`, `equip`, …) + `safeStore`.
  No other module reads or writes `localStorage` keys directly (except the transport's rejoin/host-room keys).
- TypeScript strict, no `any`, no non-null assertions on network data (it is validated by `parsePeerMessage` on the host;
  peers trust only the host's messages).
- Prefer pure functions + small modules; React components ≤ ~300 lines; no direct DOM manipulation where React state works.
