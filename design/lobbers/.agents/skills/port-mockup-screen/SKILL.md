---
name: port-mockup-screen
description: Convert one design/mockup/*.dc.html screen into React components without changing its look, then wire it to real state. Use whenever building or editing a menu/HUD screen.
---

# Port a mockup screen to React

1. **Read the source.** Open `design/mockup/<Screen>.dc.html` (format guide: `design/mockup/README.md`),
   `design/styles/<Screen>.css`, the screenshots `design/screenshots/<nn>-<screen>*.png`, and the screen's section in
   `design/DESIGN_SPEC.md` (data sources, intents, states).
2. **Map the template to JSX.**
   - `<x-dc>` root → the screen component's root `<div>` (keep its inline size/position styles).
   - `{{hole}}` → props/state values. Values the mockup computes in `renderVals()` become selectors or small pure
     helpers in the screen folder — **game numbers come from `@lobbers/shared` config, not the mockup's literals**.
   - `<sc-if value>` → conditional rendering; `<sc-for list as>` → `.map()` with stable keys (ids, not indexes, so
     enter animations replay correctly).
   - `<dc-import name="Machine" …>` → `<MachineArt kind tint size flip aim pose paint />`, `WeaponIcon` →
     `<WeaponIcon icon color size />`, `Scene` → `<SceneBackdrop map w h />`. Build these three shared components once
     in `apps/client/src/components/art/` by porting `Machine.dc.html`, `WeaponIcon.dc.html`, `Scene.dc.html` to inline
     SVG React components (keep SMIL animations).
   - `<helmet><style>` → `apps/client/src/screens/<Screen>/<Screen>.module.css` (or the shared `components.css` for
     `.btn/.panel/.hud/.scrim/.modal/.sw/.fd/.mono`). Keep keyframes verbatim.
   - Inline `style="…"` → keep as inline style objects or move to the CSS module **with identical values**.
3. **Replace mock data with real data.** Remove every hard-coded list from `renderVals()`; read from stores fed by
   the `PeerClient` (room/match) and the local profile (`persist/`), and send intents through the `PeerClient`.
   Screens that assumed a backend (Quick Match, public rooms, global leaderboards, online friends) follow
   DESIGN_SPEC §3.9 (P2P adaptations). Buttons that only toggled local state in the mockup must
   now perform their real action (see DESIGN_SPEC "Wiring").
4. **Split.** One folder per screen: `index.tsx` (layout), sub-components per panel, `use<Screen>.ts` for derived state.
   Keep files under ~300 lines.
5. **Stage scaling.** Menus are authored at 1440×900. Wrap them in `<Stage>` which scales to fit the viewport
   (letterboxed, no reflow). Battle uses the dedicated tablet/phone layouts instead.
6. **Verify.** Run the app, open the screen at 1440×900 in Playwright, screenshot, and compare with the reference
   PNG side by side. Fix spacing/colour/type differences. Keyboard: every control reachable by Tab with the yellow
   focus ring. Put both screenshots in your walkthrough Artifact.
