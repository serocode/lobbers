import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { Server, type Presence } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { loadConfig } from './config.ts';
import { createApp } from './api/app.ts';

const cfg = loadConfig();
const app = createApp(cfg);

// One HTTP server: Hono answers /api/*, Colyseus wraps it for /matchmake/* and upgrades WebSockets.
const httpServer = createServer(getRequestListener(app.fetch));
const presence: Presence | undefined = cfg.REDIS_URL ? new RedisPresence(cfg.REDIS_URL) : undefined;
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  ...(cfg.REDIS_URL ? { presence, driver: new RedisDriver(cfg.REDIS_URL) } : {}),
  greet: false,
});

// Rooms (LobbyRoom, MatchRoom, PresenceRoom) are defined in Phase 2.

await gameServer.listen(cfg.PORT);
console.log(`[lobbers] server on :${cfg.PORT} (REST /api, WebSocket rooms)${cfg.REDIS_URL ? ' · redis presence' : ' · local presence'}`);
