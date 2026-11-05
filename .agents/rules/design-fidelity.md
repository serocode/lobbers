---
trigger: always_on
description: Preserve the approved Lobbers mockup exactly when building any UI.
---

# Design fidelity

- Before building or changing a screen, open its source `design/mockup/<Screen>.dc.html`, its CSS
  `design/styles/<Screen>.css` and its screenshot(s) in `design/screenshots/`. Port structure and inline styles
  faithfully; copy exact px values, colours, radii, borders, font sizes, copy text and z-order.
- Screen ↔ file map: Home `Main.dc.html` · Lobby `Lobby.dc.html` · Machine Select `Machines.dc.html` ·
  Battlefield `Battle.dc.html` (+ `BattleTablet`, `BattleMobile`) · Results `Results.dc.html` ·
  Profile `Profile.dc.html` · Inventory `Inventory.dc.html` · Friends `Friends.dc.html`.
- Visual language to keep: 3–4 px `#0B0F1A` outlines, hard drop shadows `0 4px 0 #0B0F1A` (press = translateY(3px)
  and `0 1px 0`), navy panels `#151B2B`, dark text on coloured fills, Lilita One for display, Fredoka for UI,
  JetBrains Mono for numbers, hexagonal FIRE button, team colours red `#F45B55` / blue `#4C9AFF`, yellow `#FFD166`
  for "you"/primary actions.
- Machine/weapon/map art comes only from `apps/client/public/assets` (exported from the mockup components). Never
  substitute emoji, icon fonts or generic illustrations. New art must be drawn in the same style (flat fills,
  2.5 px `#151B2B` strokes, white 35% highlight strokes, 18–20% black shading) — see `design/DESIGN_SPEC.md § Art style`.
- Keep every animation from the mockup (keyframes are in `design/styles/*.css`): idle bob, blink, pop-in cards,
  banner slide, damage float, screen shake, explosion layers, confetti, XP fill.
- Responsive: desktop 1440×900 is primary; tablet (1024×768) and phone landscape (844×390) layouts follow
  `BattleTablet.dc.html` / `BattleMobile.dc.html`. Menus scale to fit (letterbox the 1440×900 stage with
  `transform: scale()` on small screens) — never reflow them into a different design.
- After implementing a screen, screenshot it at the artboard size and compare side by side with the reference.
  Fix differences before moving on. Note intentional differences in `docs/DECISIONS.md`.
