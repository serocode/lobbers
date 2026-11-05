> **Kit note (P2P switch):** the server-authoritative backend, database, accounts and matchmaking requirements in this
> brief are superseded for this hobby build — see `docs/DECISIONS.md` ("P2P switch") and `docs/ARCHITECTURE.md`.
> Everything else (gameplay, screens, 4v4 rules, sync, reconnection) still applies, with the host's browser as the authority.

# Implement the Existing Multiplayer Artillery Game Design

Act as a senior game developer, frontend architect, game physics engineer, and multiplayer systems engineer.

The complete UI/UX mockup for this game has already been created.

Your task is to transform the existing mockup into a fully functional browser-based multiplayer artillery game inspired by Gunbound and Worms.

**CRITICAL: Do not redesign the existing interface. Implement the game using the design that already exists in the project.**

The existing mockup is the visual source of truth.

---

# 1. First: Understand the Existing Project

Before writing code:

1. Inspect the entire project structure.
2. Identify the existing framework, libraries, and dependencies.
3. Examine all existing pages, components, layouts, assets, and styles.
4. Understand the navigation and screen transitions.
5. Identify which elements are already interactive and which are placeholders.
6. Identify the existing game battlefield implementation, if any.
7. Review the current state management architecture.

Do not replace working components unnecessarily.

Do not introduce another framework or rebuild the application from scratch.

Prepare an implementation plan based on the existing codebase.

# 2. Preserve the Existing Design

The existing design must remain visually consistent.

Preserve:
- Colors.
- Typography.
- Spacing.
- Layout.
- Button styles.
- Cards.
- Panels.
- Character illustrations.
- Battlefield artwork.
- HUD positioning.
- Animations.
- Responsive behavior.
- Navigation.

Do not simplify the design to make implementation easier.

Do not replace custom illustrations with emojis or generic icons.

Do not remove visual details.

You may improve implementation quality, but any visual changes must be intentional and consistent with the existing design.

# 3. Implement the Actual Battlefield

The battlefield must become a playable 2D artillery game.

Use the existing battlefield design as the foundation.

Implement:

### Game world
- 2D side-view terrain.
- Player positioning.
- Destructible terrain.
- Terrain collision.
- Gravity.
- Projectile physics.
- Explosions.
- Knockback.
- Falling.
- Environmental hazards.

Use a suitable rendering engine such as Phaser 3 if the existing project does not already have an appropriate game engine.

Keep the game canvas separate from the HTML/CSS HUD.

### Terrain destruction

Implement actual terrain deformation.

When a projectile explodes:
- Calculate the explosion radius.
- Remove terrain inside the affected area.
- Create a crater.
- Apply damage to nearby players.
- Apply knockback.
- Recalculate affected collision geometry.

Terrain must remain destructible throughout the match.

Do not simulate destruction using only visual overlays.

# 4. Implement Aiming and Shooting

Players must be able to control their shots.

Implement:

- Aim angle from 0–180 degrees.
- Adjustable shooting power.
- Wind direction.
- Wind strength.
- Gravity.
- Projectile trajectory.
- Projectile collision.
- Explosion radius.
- Damage calculation.

Controls:

Desktop:
- Mouse aiming.
- Keyboard angle adjustments.
- Keyboard power adjustments.
- Mouse or keyboard firing.

Mobile:
- Touch aiming.
- Touch-friendly angle and power sliders.
- Large fire button.

### Trajectory preview

Display a predicted projectile trajectory.

The preview must use the same physics parameters as the actual projectile.

Update the trajectory dynamically whenever:
- Angle changes.
- Power changes.
- Wind changes.
- Weapon changes.

# 5. Implement the Turn-Based System

Support up to eight players.

Team configuration:

- Red Team: 1–4 players.
- Blue Team: 1–4 players.
- Maximum: 8 players.

Implement:
- Turn queue.
- Alternating team turns.
- Current player identification.
- Turn countdown.
- Turn expiration.
- Player elimination.
- Automatic turn advancement.
- Match completion.

A player must only be able to control the game during their turn.

When a player is eliminated, remove them from the remaining turn queue.

The match ends when one team has no surviving players.

# 6. Implement Player Movement

Allow players to move during their turn.

Implement:
- Left and right movement.
- Jumping.
- Ground detection.
- Terrain collision.
- Movement boundaries.
- Falling.
- Knockback.
- Environmental damage.

Prevent players from moving through terrain or outside the playable battlefield.

# 7. Implement Weapons

Implement functional weapons rather than decorative weapon selectors.

Start with these weapons:

1. Standard Rocket.
2. Heavy Bomb.
3. Cluster Bomb.
4. Guided Missile.
5. Piercing Drill.
6. Lightning Strike.
7. Fire Bomb.
8. Ice Bomb.
9. Airstrike.
10. Gravity Bomb.

Each weapon must define:
- Damage.
- Projectile speed.
- Explosion radius.
- Explosion behavior.
- Terrain destruction.
- Special effects.
- Ammunition.
- Cooldown.

Create a modular weapon system so additional weapons can be introduced without modifying the core game engine.

# 8. Implement Battle Machines

Implement the eight existing battle machines from the mockup.

Each machine must have:
- Unique statistics.
- Health.
- Attack.
- Defense.
- Mobility.
- Primary attack.
- Special ability.
- Ultimate ability.

Machine abilities must have actual gameplay effects.

Keep machine attributes configurable through centralized data definitions.

Do not hardcode machine behavior throughout unrelated components.

# 9. Implement the Multiplayer Lobby

Make the existing lobby functional.

Implement:

- Create room.
- Join room.
- Leave room.
- Room code generation.
- Public and private rooms.
- Player list.
- Team assignment.
- Ready status.
- Host identification.
- Machine selection.
- Match settings.
- Start match.

Validate:
- Maximum eight players.
- Maximum four players per team.
- Minimum two players.
- Only the host can start a match.
- Players must be ready before the match starts.

# 10. Multiplayer Architecture

Implement actual multiplayer, not simulated multiplayer.

Use a server-authoritative architecture.

Recommended approach:
- Colyseus for room-based multiplayer.
- WebSockets for real-time communication.
- Node.js backend.
- PostgreSQL for persistent player data.
- Redis where necessary for room coordination.

The server must control:
- Turn order.
- Player actions.
- Projectile firing.
- Damage.
- Player health.
- Elimination.
- Match results.

Clients should send player intentions rather than authoritative game-state changes.

Example:

Client sends:
- Selected weapon.
- Aim angle.
- Shooting power.
- Movement action.

Server validates the action, executes the simulation, and broadcasts the resulting state.

All players must see the same battlefield and combat outcomes.

Do not trust client-side damage calculations or player health updates.

# 11. Handle Disconnections

Implement robust multiplayer recovery.

When a player disconnects:
- Preserve their match state.
- Display a disconnected indicator.
- Allow a configurable reconnection window.
- Resume their previous player session after reconnecting.

When the host disconnects:
- Transfer room ownership to another eligible connected player.
- Preserve room settings and match state.

When a player does not reconnect:
- Apply the configured AFK/disconnection rules.

Do not allow disconnected players to corrupt turn progression.

# 12. Implement the Remaining Screens

Connect every existing mockup screen to actual application state.

### Main Menu
- Display actual player profile data.
- Create and join rooms.
- Navigate to other sections.

### Machine Selection
- Load machine definitions.
- Select machines.
- Display actual statistics.
- Save selections.

### Inventory
- Display available items.
- Equip and unequip cosmetics.
- Show locked items.

### Player Profile
- Display player statistics.
- Display match history.
- Display achievements.

### Friends
- Show online and offline status.
- Send room invitations.
- Join friends' rooms.

### Match Results
- Calculate actual match statistics.
- Display winning team.
- Identify MVP.
- Calculate experience and rewards.

Every existing button must perform its intended action.

# 13. State Management and Architecture

Keep the code modular and maintainable.

Separate:

- Game rendering.
- Physics simulation.
- Terrain management.
- Combat.
- Weapons.
- Battle machines.
- Turn management.
- Multiplayer communication.
- Lobby management.
- Player profiles.
- Inventory.
- UI components.

Use centralized game configuration and typed data structures.

Avoid:
- Giant components.
- Duplicated business logic.
- Hardcoded game data in UI components.
- Unnecessary global state.
- Direct DOM manipulation when framework state is appropriate.
- `any` types.
- Fake API implementations presented as real functionality.

Maintain clear boundaries between client state and server-authoritative state.

# 14. Development and Testing

Implement incrementally.

### Phase 1: Playable local game
- Battlefield rendering.
- Player positioning.
- Aiming.
- Shooting.
- Physics.
- Explosions.
- Destructible terrain.
- Health.
- Turn progression.
- Match victory.

### Phase 2: Multiplayer
- Room creation.
- Room joining.
- Team assignment.
- Player synchronization.
- Turn synchronization.
- Server-authoritative combat.
- Reconnection.

### Phase 3: Content integration
- Battle machines.
- Weapons.
- Maps.
- Abilities.
- Animations.
- Sound.

### Phase 4: Persistent features
- Player accounts.
- Statistics.
- Inventory.
- Progression.
- Match history.
- Leaderboards.

### Phase 5: Quality assurance
- Multiplayer testing.
- Physics testing.
- Responsive testing.
- Performance optimization.
- Error handling.
- Security validation.

Test with multiple browser windows to verify that actual multiplayer synchronization works.

Test matches with:
- 1v1.
- 2v2.
- 3v3.
- 4v4.

# 15. Important Implementation Rules

1. Never sacrifice the existing UI design for implementation convenience.
2. Never replace existing artwork without a good reason.
3. Never leave buttons as decorative placeholders.
4. Never simulate actual multiplayer using local frontend state.
5. Never trust client-side combat outcomes.
6. Never allow multiple players to act simultaneously unless the game rules explicitly permit it.
7. Never allow eliminated players to continue participating.
8. Keep physics consistent across all clients.
9. Make the game usable on modern desktop and mobile browsers.
10. Ensure every implemented feature is testable.

# 16. Definition of Done

The implementation is not complete until:

- Players can create and join rooms.
- Up to eight players can join a match.
- Players can form two teams.
- Players can select battle machines.
- Players can take turns.
- Players can aim and fire projectiles.
- Projectiles follow actual physics.
- Explosions deform terrain.
- Players receive damage.
- Players can be eliminated.
- Weapons have distinct functional behavior.
- Match results are calculated correctly.
- Players can reconnect.
- The interface remains consistent with the original mockup.

**Final objective: Turn the existing UI/UX mockup into a genuinely playable, multiplayer browser artillery game.**

Work with the existing codebase, preserve the approved visual design, and prioritize a complete, stable gameplay loop before expanding secondary features.

Do not merely describe the implementation plan. Execute it, test it, and verify each phase before proceeding.