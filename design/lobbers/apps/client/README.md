# @lobbers/client
Vite + React 18 + TypeScript. Phaser 3 renders only the battlefield world; menus and HUD are React. Static build → Vercel.
`src/app` router/providers/Stage · `src/screens/<Screen>` one folder per mockup screen · `src/components` shared UI + art
· `src/hud` battle HUD · `src/game` Phaser scenes/renderers (draw only) · `src/net/p2p` PeerJS transport (host + join)
· `src/state` Zustand stores fed by `PeerClient` · `src/persist` profile hook over localStorage · `public/assets` exported art
· `e2e` Playwright (multi-context WebRTC multiplayer against `npm run peer:local`).
