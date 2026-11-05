import { loadConfig } from './config.ts';
import { createGameServer } from './server.ts';

const cfg = loadConfig();
const gameServer = createGameServer(cfg);
await gameServer.listen(cfg.PORT);
console.log(`[lobbers] server on :${cfg.PORT} (REST /api, WebSocket rooms: lobby, match)${cfg.REDIS_URL ? ' · redis presence' : ' · local presence'}`);
