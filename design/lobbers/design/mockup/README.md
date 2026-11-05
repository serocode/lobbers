# Reading the mockup files (`*.dc.html`)

These are the approved screens, exported from the Claude Design canvas. Each file is one artboard. They are
**design source, not app code** — port them to React (skill `port-mockup-screen`). They need the design runtime to run,
so view them through the screenshots in `../screenshots/` or the original canvas.

| File | Screen | Size |
|---|---|---|
| `Main.dc.html` | Home / main menu (+ Quick Match, Create Room, Join Room, Missions, Leaderboards, Settings modals) | 1440×900 |
| `Lobby.dc.html` | 8-player room (teams, slots, map, settings, chat, invite modal, start countdown) | 1440×900 |
| `Machines.dc.html` | Machine selection | 1440×900 |
| `Battle.dc.html` | Battlefield desktop (HUD, camera, minimap, props, armory, pause, victory). Tweak `map` picks 1 of 6 maps | 1440×900 |
| `BattleTablet.dc.html` | Battlefield tablet layout | 1024×768 |
| `BattleMobile.dc.html` | Battlefield phone landscape (aim pad, weapon sheet) | 844×390 |
| `Results.dc.html` | Match results (+ match details modal) | 1440×900 |
| `Profile.dc.html` | Player profile | 1440×900 |
| `Inventory.dc.html` | Inventory & customization | 1440×900 |
| `Friends.dc.html` | Friends & social (+ player profile popover) | 1440×900 |
| `Machine.dc.html` | **Component**: machine art (8 kinds; props kind, tint, paint, size, flip, aim, pose) | 240×200 |
| `WeaponIcon.dc.html` | **Component**: weapon icon (9 icons; props cat, col, size) | 128×128 |
| `Scene.dc.html` | **Component**: map backdrop + terrain (6 maps; props map, layer all/back/terrain, w, h, craters). viewBox = map world size | 2400–3000 × 1000–1100 |
| `canvas.json` | Canvas layout index (ignore for implementation) | — |

## Syntax
- `<x-dc> … </x-dc>` — the artboard's markup. The first child is the root at the artboard size.
- `<helmet><style>` — the screen's CSS (also extracted to `../styles/<Screen>.css`; Main → `Home.css`).
- `{{ path }}` — a value produced by `renderVals()` in the `<script type="text/x-dc">` class at the bottom.
- `<sc-if value="{{cond}}">` — conditional block. `<sc-for list="{{items}}" as="item">` — loop.
- `<dc-import name="Machine" kind="…">` — mounts the sibling component file `Machine.dc.html` with props.
- `onClick="{{handler}}"` — event handlers (React-style camelCase).
- `class Component extends DCLogic { renderVals() { … } }` — local state + **mock data**. The mock data shows shape
  and realistic values; in the real app it comes from the host (via `PeerClient`) or the local profile. Game numbers come from `packages/shared/src/config`.
- `<a href="Lobby.dc.html">` — navigation between screens → React Router routes (see `../DESIGN_SPEC.md § Navigation`).

The battle mockup contains a throwaway local simulation (simple physics, AI turns). **Do not port that logic**; it is
replaced by `@lobbers/shared` (the host engine). Port its visuals and interaction states only.
