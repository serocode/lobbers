---
trigger: model_decision
description: How to test and verify Lobbers features — read when writing tests or finishing a phase.
---

# Testing and verification

- `pnpm test:core` — shared tests (node:test, no deps): physics, combat, turns, lobby rules, **the host engine**
  (whole matches over `connectLoopback` with `ManualClock`: sync, rejection, timers, AFK, disconnect/rejoin, reconnect
  window, host refresh) and the localStorage profile. Must stay green.
- `pnpm smoke:p2p` — 4 real Chromium contexts play a full match over **real WebRTC data channels** (local signaling
  relay), reload a guest mid-match, refresh the host mid-match; asserts identical results and terrain on every peer.
- Client: vitest for stores/adapters (`PeerClient` → Zustand), profile hook with a `memoryStore()`.
- Playwright multiplayer E2E (skill `multiplayer-e2e`) against the real app + a local PeerServer (`pnpm exec peerjs --port 9000`)
  so tests never depend on the public PeerJS cloud.
- Matrix before calling multiplayer done: 1v1, 2v2, 3v3, 4v4; active player drops and rejoins; guest stays away past the
  window; host refreshes mid-match; host leaves (room closes for all).
- Visual check: Playwright screenshots of each screen at 1440×900 (and tablet/phone for the battlefield), compared
  against `design/screenshots/`. Attach both images in your walkthrough.
- Storage: test first run with empty storage, corrupt `lobbers:profile`, and `setItem` throwing (quota) — the game
  must still start.
- Performance: battlefield ≥ 55 fps on a mid laptop with 8 units and 5 projectiles; terrain carve < 4 ms; host tab
  resolves a shot in < 20 ms.
