# Lobbers

Turn-based 4v4 artillery for the browser — Gunbound/Worms-style. Peer-to-peer multiplayer (the room host's browser is
the authority, WebRTC via PeerJS), progress saved in localStorage, no backend — deploys free as static files on Vercel.

- New here? Read **START_HERE.md**. Building with an AI agent? Use **PROMPTS.md**; the agent brief is **AGENTS.md**.
- Mid-build on the old Colyseus/Postgres kit? → **docs/MIGRATION.md** (prompt **M**).
- Design source: `design/` · Game core + host engine: `packages/shared` · Client: `apps/client` · Docs: `docs/`

```bash
npm install
npm run test:core        # physics, rules, host engine (whole matches, reconnects, host refresh), saved profile — 36 tests
npm run smoke:p2p        # 4 real browsers play a match over WebRTC (needs Playwright's Chromium)
npm run dev:client       # Vite on :5173 (uses the free PeerJS cloud signaling server)
npm run peer:local       # optional local signaling server on :9000 (see .env.example)
npm run build            # static build → apps/client/dist (Vercel uses vercel.json)
```
