---
trigger: model_decision
description: How to test and verify Lobbers features — read when writing tests or finishing a phase.
---

# Testing and verification

- `pnpm test:core` — shared physics/combat/turn/lobby tests (node:test, no deps). Must stay green.
- Server: vitest + `@colyseus/testing` — boot rooms in-process, connect N fake clients, assert: room code, team limits,
  host-only start, ready gating, turn rotation, rejection of out-of-turn intents, damage only from server, reconnection
  inside the window, host transfer, forfeit after window.
- Client: vitest for stores/adapters; Playwright for flows. Multiplayer E2E opens 2–8 browser contexts against a local
  server and checks every context sees the same HP, positions and terrain hash after each shot (skill `multiplayer-e2e`).
- Matrix to run before calling multiplayer done: 1v1, 2v2, 3v3, 4v4; disconnect+reconnect the active player; host leaves.
- Visual check: Playwright screenshots of each screen at 1440×900 (and tablet/phone for the battlefield), compared
  against `design/screenshots/`. Attach both images in your walkthrough.
- Performance: battlefield ≥ 55 fps on a mid laptop with 8 units and 5 projectiles; terrain carve < 4 ms.
