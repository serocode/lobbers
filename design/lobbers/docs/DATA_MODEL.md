# Saved data (localStorage) — `packages/shared/src/persist/*`

No database, no accounts. Each browser holds its own player. All access goes through `safeStore(window.localStorage)`
(never throws) and the pure functions in `persist/profile.ts`.

| Key | Written by | Contents |
|---|---|---|
| `lobbers:profile` | the player's own app | `LocalProfile` v1 (below) |
| `lobbers:profile:corrupt` | `loadProfile` | the raw value of an unreadable profile (kept for support; first-run shows again) |
| `lobbers:rejoin:<code>` | `PeerClient` | rejoin token for that room (removed on `closed`) |
| `lobbers:host:<code>` | `HostSession` (host only) | room + match snapshot for host-refresh resume (≤ 10 min old) |
| `lobbers:hostRoom` | transport (host only) | the code you are currently hosting (resume on reload) |
| `lobbers:recentRooms` | app | last 4 `{code, hostName, at}` for Join Room → Recent rooms |

## `LocalProfile` (v1)
| Field | Meaning |
|---|---|
| `id` | `crypto.randomUUID()` at first run — your player id in every room |
| `name` | 3–16 chars (`cleanName`) |
| `level`, `xp`, `rating` | progression; `applyXp` + `RATING` (win +25 / loss −20, floor 0) |
| `coins`, `gems` | currency (starts 500 coins) |
| `favoriteMachine` | default machine in lobbies |
| `owned`, `equipped` | item ids (`config/cosmetics.ts`); `equipped` slot → item id (`trail`, `explosion`, `title`, `emote1..4`, `skin:<machine>`, `avatar`) |
| `settings` | music, sfx, screenShake, trajectoryPreview, cameraFollowsShots |
| `stats` | matches, wins, losses, draws, damage, eliminations, assists, MVPs, shots, hits, per-machine matches/wins |
| `history` | last 30 `MatchHistoryEntry` (Results revisits, Profile history, Recent Activity) |
| `recentPlayers` | last 50 people you finished a match with (last-known name/level/rating/title, matches together, `starred`) |
| `credited` | last 60 match ids already paid out — `creditMatch` is idempotent |
| `progress` | missions / achievements progress by definition id `{value, claimedAt, resetAt}` |

Starter inventory: `STARTER_ITEMS` (Thumper, Sprocket, Mollusk, Voltaic, Cinder + default trail/explosion/title/emote).
Item ids must match `config/cosmetics.ts` — create it from `design/mockup/Inventory.dc.html` `data()` (names,
rarities, colours, prices, requirements) if your repo doesn't have it yet.

## Rules
- **Rewards**: when `matchEnded` arrives, each peer calls `creditMatch(profile, msg, lobbyProfiles)` → `saveProfile`.
  The host never writes anyone else's data.
- **Purchases / equip**: `purchase(profile, item)` / `equip(profile, slot, id)` → `saveProfile`. Requirements (level,
  wins…) are checked in the Inventory screen from `profile.stats` before calling `purchase`.
- **Friends** = `recentPlayers` you starred (`starPlayer`). **Leaderboard** = `localLeaderboard(profile)`.
- **Backup / new device**: Settings → Export save (`exportProfile` → `LOBBERS1:<checksum>:<base64>`), Import save
  (`importProfile` validates checksum + version). Same id → your friends' Recent players lists still match you.
- **Migrations**: bump `PROFILE_VERSION` and add an upgrade step in `migrate()`; never break old saves.
- **Size**: a full profile is a few tens of KB; the host snapshot ~10–20 KB for a 4v4 (terrain RLE). Both far under the ~5 MB
  per-origin quota. On `setItem` failure the game keeps running (no save) and shows the storage banner.
