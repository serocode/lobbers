# Lobbers

Turn-based 4v4 artillery for the browser — Gunbound/Worms-style. Peer-to-peer multiplayer (the room host's browser is
the authority, WebRTC via PeerJS), progress saved in localStorage, no backend — deploys free as static files on Vercel.

- The agent brief is **AGENTS.md**; progress and how to verify each feature: **docs/PROGRESS.md**.
- Design source: `design/` · Game core + host engine: `packages/shared` · Client: `apps/client` · Docs: `docs/`

```bash
pnpm install
pnpm test:core          # physics, rules, host engine (whole matches, reconnects, host refresh), saved profile
pnpm smoke:p2p          # 4 real browsers play a match over WebRTC (needs Playwright's Chromium)
pnpm dev:client         # Vite on :5173 (uses the free PeerJS cloud signaling server)
pnpm peer:local         # optional local signaling server on :9000 (see .env.example)
pnpm build              # static build → apps/client/dist (Vercel uses vercel.json)
```
