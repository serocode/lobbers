# Lobbers

Turn-based 4v4 artillery for the browser — Gunbound/Worms-style, server-authoritative multiplayer.

- New here? Read **START_HERE.md**. Building with an AI agent? Use **PROMPTS.md**; the agent brief is **AGENTS.md**.
- Design source: `design/` · Game core: `packages/shared` · Client: `apps/client` · Server: `apps/server` · Docs: `docs/`

```bash
pnpm install
pnpm test:core          # shared physics/rules tests
pnpm test               # shared + server (vitest) + client (vitest)
pnpm typecheck          # every workspace
pnpm db:up              # Postgres + Redis (Docker; needed from Phase 4)
pnpm dev:server         # Colyseus + REST on :2567
pnpm dev:client         # Vite on :5173 → /dev/kit, hot-seat match from there
pnpm e2e                # Playwright (starts Vite if needed)
```
Package manager: **pnpm 10** (`packageManager` in package.json). Build scripts allowed for esbuild/msgpackr only.
