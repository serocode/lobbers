# Lobbers — agent brief (always on)

Lobbers is a turn-based 4v4 artillery game (Gunbound / Worms style) for the browser. A complete, approved
UI/UX mockup already exists. Your job is to turn it into a real, server-authoritative multiplayer game
**without redesigning it**. The full brief is `docs/BRIEF.md`; the phase plan is `docs/IMPLEMENTATION_PLAN.md`.

## Sources of truth (read before touching UI)
| What | Where |
|---|---|
| Visual design, exact px/colours/copy/states | `design/mockup/*.dc.html` (how to read them: `design/mockup/README.md`) |
| What each screen must look like | `design/screenshots/*.png` (substitute fonts — layout reference) |
| Per-screen behaviour + data wiring | `design/DESIGN_SPEC.md` |
| Colours, type, borders, shadows | `design/tokens/tokens.css`, `design/tokens/components.css`, `design/styles/<Screen>.css` |
| Game art (machines, barrels, weapon icons, map backdrops) | `apps/client/public/assets/**` (barrel pivots: `apps/client/public/assets/machines/rig.json`) |
| Game data (machines, weapons, maps, physics, rewards) | `packages/shared/src/config/*` — never duplicate these numbers elsewhere |
| Physics / terrain / combat / turns / lobby rules | `packages/shared/src/sim/*`, `rules.ts`, `lobby.ts` (tested: `pnpm test:core`) |
| Wire protocol | `packages/shared/src/protocol.ts`, `docs/NETWORK.md` |

## Stack (decided — do not swap)
- **Monorepo, pnpm workspaces** (`pnpm-workspace.yaml`; switched from npm at the owner's request — see DECISIONS). `packages/shared` (TypeScript, no deps), `apps/client`, `apps/server`.
- **Client:** Vite + React 18 + TypeScript, React Router, Zustand for client UI state. **Phaser 3** renders the battlefield
  only (terrain, machines, projectiles, FX) inside a canvas; **all HUD/menus are React DOM** layered on top.
  The battlefield world is larger than the screen; the Phaser camera follows the Gunbound rules in
  `packages/shared/src/config/camera.ts` + DESIGN_SPEC §2.4 (focus active player → follow shell → hold → next player).
- **Server:** Node 22 + **Colyseus 0.16** rooms (`LobbyRoom`, `MatchRoom`), Hono for REST (`/api/*`), **PostgreSQL via
  Drizzle**, Redis presence/driver for multi-process room coordination.
- Fonts via `@fontsource/*` (self-hosted), not the Google Fonts CDN.

## Non-negotiables
1. **The mockup is the design.** Match layout, spacing, colours, type, copy, borders, hard shadows, hover/press states and
   animations. Port each screen from its `.dc.html`; compare against its screenshot. No emoji, no generic icon packs, no
   gradients/glass that aren't in the mockup. Any addition (e.g. ultimate button, jump button, 0–180° dial) follows
   `design/DESIGN_SPEC.md § Additions` exactly.
2. **Server-authoritative.** Clients send intents (`ClientIntent`); the server validates (`rules.ts`), simulates
   (`resolveShot`, `walk`, `jump`, `activateAbility`, `beginTurn`) and broadcasts outcomes. Clients never compute damage,
   HP, eliminations, wind or turn order. The client may run `predictTrajectory` for the preview line only.
3. **One physics implementation.** Server and client import the same `@lobbers/shared`. Don't fork or re-implement
   physics in Phaser (Phaser Arcade/Matter physics must not drive gameplay).
4. **Real terrain destruction.** The terrain bitmask in `Terrain` is the collision geometry. Render it to a Phaser
   CanvasTexture and erase circles on `carve` events. Verify per-turn `terrainHash` against the server.
5. **No fake functionality.** No simulated multiplayer, no mock APIs presented as real, no decorative buttons. If
   something is out of scope, leave it visibly disabled with a reason and log it in `docs/DECISIONS.md`.
6. **Typed, modular, small files.** No `any`. No giant components (>300 lines → split). No game numbers in UI code.
7. **Every feature is testable.** Shared logic → node/vitest tests. Rooms → `@colyseus/testing`. UI flows →
   Playwright, including multi-window multiplayer (see skill `multiplayer-e2e`).

## Working agreement
- Work phase by phase (`docs/IMPLEMENTATION_PLAN.md`); don't start a phase until the previous one's checks pass.
- Before a phase: produce a short plan Artifact. After it: run tests, take screenshots, compare with
  `design/screenshots`, and update `docs/PROGRESS.md` (what works, how to verify, known gaps).
- Record any deviation from the mockup or brief, with the reason, in `docs/DECISIONS.md`.
- Run `pnpm test:core` after any change to `packages/shared`.
