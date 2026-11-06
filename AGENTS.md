# Lobbers — agent brief (always on)

Lobbers is a turn-based 4v4 artillery game (Gunbound / Worms style) for the browser. A complete, approved
UI/UX mockup already exists. Your job is to turn it into a real multiplayer game **without redesigning it**.
It is a hobby game for friends: **peer-to-peer** (the room host's browser is the authority, players connect over
WebRTC) with **all saved data in localStorage** and **no backend** — the whole app is static files on Vercel.
The full brief is `docs/BRIEF.md` (its server/database requirements are superseded — see `docs/DECISIONS.md`
"P2P switch"); the phase plan is `docs/IMPLEMENTATION_PLAN.md`.
The migration from Colyseus + Postgres is done (record in `docs/PROGRESS.md`, "P2P migration").

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
| Host authority (lobby + match engine that runs in the host's tab) | `packages/shared/src/host/*` (tested) |
| Peer session, message validation, local world mirror | `packages/shared/src/net/*` |
| Saved data (profile, inventory, history, friends) | `packages/shared/src/persist/*`, `docs/DATA_MODEL.md` |
| WebRTC transport (PeerJS) | `apps/client/src/net/p2p/peerjs.ts` |

## Stack (decided — do not swap)
- **Monorepo, pnpm workspaces** (`pnpm-workspace.yaml`, `packageManager` pinned in the root `package.json`; switched from
  npm at the owner's request — see DECISIONS). `packages/shared` (TypeScript, no deps), `apps/client`. **No server app.**
- **Client:** Vite + React 18 + TypeScript, React Router, Zustand for client UI state. **Phaser 3** renders the battlefield
  only (terrain, machines, projectiles, FX) inside a canvas; **all HUD/menus are React DOM** layered on top.
  The battlefield world is larger than the screen; the Phaser camera follows the Gunbound rules in
  `packages/shared/src/config/camera.ts` + DESIGN_SPEC §2.4 (focus active player → follow shell → hold → next player).
- **Multiplayer:** **PeerJS** (WebRTC data channels; free PeerJS cloud signaling by default, STUN + optional TURN
  via env). The host's tab runs `HostSession` from `@lobbers/shared`; every player's UI — including the host's, over a
  loopback link — uses `PeerClient`. Room code `LOB-XXXX` = PeerJS id `lobbers-v2-LOB-XXXX`.
- **Persistence:** `localStorage` only (`persist/profile.ts`, one versioned key + export/import save code). No accounts,
  no database, no REST API.
- **Hosting:** Vercel (static Vite build, SPA rewrite in `vercel.json`).
- Fonts via `@fontsource/*` (self-hosted), not the Google Fonts CDN.

## Non-negotiables
1. **The mockup is the design.** Match layout, spacing, colours, type, copy, borders, hard shadows, hover/press states and
   animations. Port each screen from its `.dc.html`; compare against its screenshot. No emoji, no generic icon packs, no
   gradients/glass that aren't in the mockup. Any addition (e.g. ultimate button, jump button, 0–180° dial) follows
   `design/DESIGN_SPEC.md § Additions` exactly.
2. **Host-authoritative.** Peers send intents (`PeerMessage`); only `HostSession` (in the host's tab) validates
   (`net/codec.ts`, `rules.ts`, `lobby.ts`), simulates (`HostMatch` → `resolveShot`, `walk`, `jump`, `activateAbility`,
   `beginTurn`) and broadcasts outcomes. UI code — **including the host's own UI** — never computes damage, HP,
   eliminations, wind or turn order and never touches `HostSession` directly; it goes through its `PeerClient` like
   everyone else. Peers may run `predictTrajectory` on their `WorldMirror` for the preview line only.
3. **One physics implementation.** Everything imports the same `@lobbers/shared`. Don't fork or re-implement
   physics in Phaser (Phaser Arcade/Matter physics must not drive gameplay).
4. **Real terrain destruction.** The terrain bitmask in `Terrain` is the collision geometry. Render it to a Phaser
   CanvasTexture and erase circles on `carve` events (keep a `WorldMirror`). Compare every `terrainHash` with the host's.
5. **No fake functionality.** No simulated multiplayer, no mock APIs presented as real, no decorative buttons. If
   something is out of scope, leave it visibly disabled with a reason and log it in `docs/DECISIONS.md`.
6. **Typed, modular, small files.** No `any`. No giant components (>300 lines → split). No game numbers in UI code.
7. **Every feature is testable.** Shared logic → node tests (`HostSession` + `connectLoopback` + `ManualClock` run whole
   matches in-process). UI flows → Playwright, including multi-context WebRTC multiplayer (skill `multiplayer-e2e`).
8. **localStorage can fail or vanish.** Always go through `safeStore`; the game must still start (first-run flow) when
   storage is empty, corrupt, full or blocked. Offer Export/Import save in Settings.

## Working agreement
- Work phase by phase (`docs/IMPLEMENTATION_PLAN.md`); don't start a phase until the previous one's checks pass.
- Before a phase: produce a short plan Artifact. After it: run tests, take screenshots, compare with
  `design/screenshots`, and update `docs/PROGRESS.md` (what works, how to verify, known gaps).
- Record any deviation from the mockup or brief, with the reason, in `docs/DECISIONS.md`.
- Run `pnpm test:core` after any change to `packages/shared`; `pnpm smoke:p2p` after changes to `host/`, `net/` or the transport.
