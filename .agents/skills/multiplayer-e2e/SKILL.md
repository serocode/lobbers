---
name: multiplayer-e2e
description: Prove real multiplayer sync with several browser contexts (1v1 to 4v4), including disconnect/reconnect and host transfer. Use before marking any multiplayer work done.
---

# Multiplayer end-to-end verification

Setup: `pnpm db:up`, start server (`pnpm dev:server`) and client (`pnpm dev:client`).
Tests live in `apps/client/e2e/` (Playwright). Each player = its own `browser.newContext()` (separate storage = separate
guest account).

1. **Room flow**: P1 creates a room (Home → Create Room) → read code from the lobby header. P2..Pn join via Join Room
   with that code. Assert every context lists the same players, teams, host crown and `n/8` count.
2. **Validation**: a 5th player switching into a full team is rejected; non-host cannot start; start blocked until all
   ready; a 9th join is refused.
3. **Match sync**: host starts → all contexts reach the battlefield. For each turn: only the active context has enabled
   controls (others show "… is taking their turn"); the active one fires via keyboard. After `actionResolved`, read
   `window.__lobbers.debug()` (expose in dev builds only) from every context and assert identical unit HP/positions,
   wind, turn number and `terrainHash` equal to the server's.
4. **Out-of-turn attack**: from a non-active context send a raw `fire` intent through the debug hook; assert
   `rejected` and no state change.
5. **Disconnect**: close the active player's page → others see the disconnected badge, the turn ends, next player
   acts. Reopen within the window with the same storage → same seat, same HP, receives a full snapshot, terrain hash
   matches. Let a second player stay away past the window → forfeits, removed from the queue.
6. **Host leaves** in the lobby → host crown moves to the longest-connected player; settings unchanged.
7. Run the matrix 1v1, 2v2, 3v3, 4v4 (play until one team is eliminated; you may use a dev-only "auto-aim" helper
   that computes a real intent with `predictTrajectory` — it still goes through the server).
8. Record results in `docs/PROGRESS.md` with screenshots from two contexts side by side.
