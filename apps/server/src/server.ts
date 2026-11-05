// Builds the HTTP + Colyseus server (used by index.ts and the room tests).
import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { LocalPresence, Server, matchMaker, type Presence } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { ROOM_LIMITS, type MapId, type GameMode, type PublicRoomInfo } from '@lobbers/shared';
import type { ServerConfig } from './config.ts';
import { createApp, type RoomDirectory } from './api/app.ts';
import { configureRoomAuth } from './auth/roomAuth.ts';
import { roomIdForCode } from './lobby/codes.ts';
import { LobbyRoom } from './rooms/LobbyRoom.ts';
import { MatchRoom } from './rooms/MatchRoom.ts';
import { configureRooms } from './rooms/roomSettings.ts';

interface LobbyMeta { code?: string; name?: string; mode?: GameMode; mapId?: MapId; hostName?: string; ranked?: boolean }

export function createGameServer(cfg: ServerConfig): Server {
  configureRoomAuth(cfg.JWT_SECRET);
  configureRooms({ reconnectWindowSec: cfg.RECONNECT_WINDOW_SEC });
  const presence: Presence = cfg.REDIS_URL ? new RedisPresence(cfg.REDIS_URL) : new LocalPresence();

  const rooms: RoomDirectory = {
    async listPublic() {
      const list = await matchMaker.query({ name: 'lobby' });
      return list
        .filter((r) => !r.private && !r.locked && r.clients < ROOM_LIMITS.maxPlayers)
        .map((r): PublicRoomInfo => {
          const m = (r.metadata ?? {}) as LobbyMeta;
          return { roomId: r.roomId, code: m.code ?? '', name: m.name ?? 'Open room', mode: m.mode ?? 'team-deathmatch', mapId: m.mapId ?? 'cobalt', players: r.clients, maxPlayers: ROOM_LIMITS.maxPlayers, hostName: m.hostName ?? '', ranked: !!m.ranked };
        })
        .sort((a, b) => b.players - a.players)
        .slice(0, 20);
    },
    findByCode: (code) => roomIdForCode(presence, code),
  };

  const app = createApp(cfg, Date.now(), rooms);
  // One HTTP server: Hono answers /api/*, Colyseus wraps it for /matchmake/* and upgrades WebSockets.
  const httpServer = createServer(getRequestListener(app.fetch));
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    presence,
    ...(cfg.REDIS_URL ? { driver: new RedisDriver(cfg.REDIS_URL) } : {}),
    greet: false,
  });
  gameServer.define('lobby', LobbyRoom).filterBy(['ranked']);
  gameServer.define('match', MatchRoom);
  return gameServer;
}
