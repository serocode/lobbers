import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { ROOM_LIMITS, SEASON, type PublicRoomInfo } from '@lobbers/shared';
import type { ServerConfig } from '../config.ts';
import { signSession, verifySession } from '../auth/jwt.ts';
import { getArchivedMatch } from '../match/archive.ts';

/** First-run name rule (DESIGN_SPEC §3.7): 3–16 chars, letters/digits/._ */
export const PlayerName = z.string().trim().regex(/^[A-Za-z0-9._]{3,16}$/, 'Name must be 3–16 letters, digits, dots or underscores');
const GuestBody = z.object({ name: PlayerName });
const RoomCode = z.string().trim().toUpperCase().regex(new RegExp(`^${ROOM_LIMITS.codePrefix}[${ROOM_LIMITS.codeAlphabet}]{${ROOM_LIMITS.codeLength}}$`));

/** Room lookups backed by the Colyseus matchmaker (injected so the REST app stays unit-testable). */
export interface RoomDirectory {
  listPublic(): Promise<PublicRoomInfo[]>;
  findByCode(code: string): Promise<string | null>;
}

const noRooms: RoomDirectory = { listPublic: async () => [], findByCode: async () => null };

export function createApp(cfg: Pick<ServerConfig, 'JWT_SECRET' | 'CORS_ORIGIN'>, startedAt = Date.now(), rooms: RoomDirectory = noRooms): Hono {
  const app = new Hono();
  app.use('/api/*', cors({ origin: cfg.CORS_ORIGIN.split(','), allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'OPTIONS'] }));

  app.get('/api/health', (c) => c.json({ ok: true, service: 'lobbers', uptimeSec: Math.round((Date.now() - startedAt) / 1000), time: new Date().toISOString() }));

  /** Creates a guest identity and returns a signed session token (DB-backed accounts arrive in Phase 4). */
  app.post('/api/auth/guest', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = GuestBody.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, 400);
    const user = { id: randomUUID(), name: parsed.data.name };
    const token = await signSession({ sub: user.id, name: user.name, guest: true }, cfg.JWT_SECRET);
    return c.json({ token, user }, 201);
  });

  /** Echoes the session behind a bearer token — lets clients validate a stored token on launch. */
  app.get('/api/auth/session', async (c) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const s = token ? await verifySession(token, cfg.JWT_SECRET) : null;
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    return c.json({ user: { id: s.sub, name: s.name, guest: s.guest } });
  });

  app.get('/api/season', (c) => c.json(SEASON));

  /** "Open rooms near you": public lobbies that are not full and not mid-match. */
  app.get('/api/rooms', async (c) => c.json({ rooms: await rooms.listPublic() }));

  /** Join by code: LOB-XXXX → room id (private rooms are hidden from matchmaking). */
  app.get('/api/rooms/code/:code', async (c) => {
    const code = RoomCode.safeParse(c.req.param('code'));
    if (!code.success) return c.json({ error: 'Codes look like LOB-7Q4K' }, 400);
    const roomId = await rooms.findByCode(code.data);
    return roomId ? c.json({ roomId, code: code.data }) : c.json({ error: `No room with code ${code.data}` }, 404);
  });

  /** A finished match's results (in memory until Phase 4 persists matches). */
  app.get('/api/matches/:id', (c) => {
    const m = getArchivedMatch(c.req.param('id'));
    return m ? c.json({ match: m }) : c.json({ error: 'match not found' }, 404);
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  return app;
}
