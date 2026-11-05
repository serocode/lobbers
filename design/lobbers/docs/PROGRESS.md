# Progress

Update at the end of every phase: what works, how to verify it (commands, URLs, test names), screenshots, known gaps.

## Kit update — peer-to-peer + localStorage
- `packages/shared`: host engine (`host/`), peer session/codec/loopback/mirror (`net/`), localStorage profile
  (`persist/`), protocol v2. `npm run test:core` → 36 pass (12 new in `test/host.test.ts`).
- `tools/p2p-smoke`: 4 Chromium contexts over native WebRTC — Cobalt (32 turns) and Skyreach (40 turns) played to the
  end; guest reload and host refresh mid-match recovered; identical results, 0 terrain desyncs, profiles credited once.
- Not run in the kit environment: `apps/client/src/net/p2p/peerjs.ts` (PeerJS not installable there) — covered by the
  `multiplayer-e2e` skill in your repo.

## Migration (Colyseus → P2P)
_not started — see docs/MIGRATION.md_

## Phase 0 — Bootstrap
_not started_

## Phase 1 — Playable local game
_not started_

## Phase 2 — Multiplayer
_not started_

## Phase 3 — Content
_not started_

## Phase 4 — Persistence
_not started_

## Phase 5 — Quality
_not started_
