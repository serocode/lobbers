---
name: multiplayer-e2e
description: Prove real peer-to-peer multiplayer sync with several browser contexts (1v1 to 4v4) over WebRTC, including disconnect/rejoin, host refresh and host leaving. Use before marking any multiplayer work done.
---

# Multiplayer end-to-end verification (P2P)

Setup (no public services in tests):
1. Local signaling: `npx peerjs --port 9000 --path /` (PeerServer). Run the client with
   `VITE_PEER_HOST=localhost VITE_PEER_PORT=9000 VITE_PEER_SECURE=false VITE_ICE_SERVERS=[] npm run dev:client`.
2. Playwright: launch Chromium with `--disable-features=WebRtcHideLocalIpsWithMdns` so localhost ICE candidates work.
   Each player = its own `browser.newContext()` (separate localStorage = separate profile).
3. Engine-only sanity check first: `npm run smoke:p2p` (tools/p2p-smoke) must pass.

Steps (tests in `apps/client/e2e/`):
1. **Room flow**: P1 first-run (name) → Home → Create Room → read the code `LOB-XXXX` from the lobby header.
   P2..Pn: Join Room with that code (also test the invite link `/?join=LOB-XXXX`). Every context lists the same players,
   teams, host crown and `n/8`.
2. **Validation**: 5th player into a full team rejected; non-host cannot start or change settings; start blocked until
   everyone ready; 9th join → "Room is full" screen; wrong code → "Room not found".
3. **Match sync**: host starts → countdown → every context reaches the battlefield. For each turn only the active
   context has enabled controls (others "… is taking their turn"); the active one fires via keyboard. After each
   `actionResolved`, read `window.__lobbers.debug()` (dev builds only) from every context and assert identical unit
   HP/positions, wind, turn number and terrain hash (= the host's `HostMatch.world.terrain.hash()`).
4. **Out-of-turn**: from a non-active context send a raw `fire` through the debug hook → `rejected`, no state change.
5. **Disconnect**: close the active guest's page → others see the disconnected badge, the turn passes. Reopen with the
   same context (same localStorage → same profile + rejoin token) within the window → same seat, same HP, full snapshot,
   terrain hash matches. Keep another guest away past the window → forfeits.
6. **Host refresh**: reload the host page mid-match → "Host reconnecting…" pill on guests (match `paused`) → resumes
   on the same turn with the same terrain hash; guests reconnect automatically.
7. **Host leaves**: host presses Leave (or closes the tab and does not return) → every guest gets the "Host closed the
   room" screen and returns Home; no rewards credited.
8. **Rewards**: after `matchEnded` each context's `lobbers:profile` has the match once (reload the Results page → still
   once), XP/coins match the Results screen.
9. Matrix 1v1, 2v2, 3v3, 4v4 (a dev-only auto-aim helper may compute intents with `predictTrajectory` on the
   `WorldMirror` — they still go through the host). Record results + two contexts' screenshots in `docs/PROGRESS.md`.
