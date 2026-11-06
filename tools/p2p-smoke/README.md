# P2P smoke test

Proves the real host engine (`packages/shared/src/host`) works between **real browsers over real WebRTC data
channels** — no PeerJS cloud needed. `server.mjs` is a tiny static server + signaling relay; `rtc.ts` is a
dependency-free RTCPeerConnection transport (same role as `apps/client/src/net/p2p/peerjs.ts`); `page.ts` is a
headless "app" where bots aim with `predictTrajectory` on their `WorldMirror` and send real intents.

```bash
npm run smoke:p2p              # = node tools/p2p-smoke/run.mjs 4 cobalt   (players, map)
```
What it checks: 4 Chromium contexts (separate localStorage = separate profiles) join over WebRTC → full match →
a guest reloads mid-match and gets its seat back (rejoin token) → the HOST refreshes mid-match and resumes from
localStorage → every peer ends with the identical `matchEnded`, zero terrain desyncs, one final terrain hash, and
each profile credited once. Prints round-trip times (localhost ≈ 1 ms; real friends ≈ 20–80 ms).

Kit verification run (Chromium, 4 browsers): Cobalt Crags 32 turns / 162 s and Skyreach Isles 40 turns — identical
results on all peers, 0 desyncs, guest reload + host refresh both recovered.
Needs: `npm install` at the root (esbuild, ws, playwright) and `npx playwright install chromium`.
