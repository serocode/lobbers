# @lobbers/client
Vite + React 18 + TypeScript. Phaser 3 renders only the battlefield world; menus and HUD are React.
`src/app` router/providers/Stage · `src/screens/<Screen>` one folder per mockup screen · `src/components` shared UI + art
· `src/hud` battle HUD · `src/game` Phaser scenes/renderers (draw only) · `src/net` Colyseus client · `src/state` Zustand stores
· `public/assets` exported art · `e2e` Playwright (incl. multi-context multiplayer).
