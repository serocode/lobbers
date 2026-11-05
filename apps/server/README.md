# @lobbers/server
Node 22, Colyseus 0.16 (rooms), Hono (REST under /api), Drizzle + PostgreSQL, Redis presence/driver.
`src/rooms` LobbyRoom, MatchRoom, PresenceRoom · `src/match` MatchController (turn state machine over @lobbers/shared)
· `src/lobby` matchmaking helpers · `src/api` REST routes · `src/db` schema, migrations, seed, repositories · `src/auth` guest JWT
· `test` vitest + @colyseus/testing.
