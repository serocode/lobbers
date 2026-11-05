# Persistent data (PostgreSQL via Drizzle) — `apps/server/src/db/schema.ts`

| Table | Key columns |
|---|---|
| `users` | id uuid pk, display_name (unique, 3–16), device_token_hash, created_at, last_seen_at |
| `profiles` | user_id pk/fk, level int, xp int, coins int, gems int, rating int (SR), rank_tier text, title_item_id, favorite_machine, season_id |
| `items` (catalog, seeded from `packages/shared/src/config/cosmetics.ts`) | id text pk, category (machine, machine_skin, weapon_skin, trail, explosion, avatar, emote, title), rarity, name, description, data jsonb (kind/paint/colour/text), price_coins, price_gems, requirement jsonb |
| `user_items` | user_id, item_id, acquired_at, source — pk(user_id, item_id) |
| `loadouts` | user_id pk, machine_skin_by_machine jsonb, trail, explosion, avatar, emote, title, default_machine |
| `matches` | id uuid, mode, map_id, settings jsonb, seed bigint, winner, turns, started_at, ended_at, action_log jsonb (compressed) |
| `match_players` | match_id, user_id, team, slot, machine, damage_dealt, damage_received, eliminations, assists, shots, hits, xp, coins, mvp, survived, forfeited |
| `friendships` | user_id, friend_id, created_at (two rows per friendship) |
| `friend_requests` | id, from_user, to_user, status (pending/accepted/declined), created_at |
| `missions` / `user_missions` | daily mission definitions; progress, claimed_at, reset_at |
| `achievements` / `user_achievements` | definitions with target; progress, unlocked_at |
| `seasons` | id, name, starts_at, ends_at |

Rules: currency changes only inside transactions in server code (purchase, mission claim, match rewards). Leaderboards
= `profiles` ordered by rating (global) or filtered by friendships (friends); cache top 100 in Redis for 60 s.
Seed data (catalog items, missions, achievements, starter inventory: Thumper, Sprocket, Mollusk, Voltaic, Cinder +
default trail/explosion/title/emote) lives in `apps/server/src/db/seed.ts`; the mockup's Inventory/Profile screens list
the starting catalog to reproduce.

> `config/cosmetics.ts` is not written yet — create it from `design/mockup/Inventory.dc.html` `data()` (names,
> rarities, colours, requirements) and keep it the single source for the seed.
