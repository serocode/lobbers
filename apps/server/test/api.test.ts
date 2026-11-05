import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { verifySession } from '../src/auth/jwt.ts';

const cfg = { JWT_SECRET: 'test-secret-at-least-16-chars', CORS_ORIGIN: 'http://localhost:5173' };

describe('REST bootstrap', () => {
  it('health check answers', async () => {
    const res = await createApp(cfg).request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'lobbers' });
  });

  it('guest auth issues a verifiable token', async () => {
    const app = createApp(cfg);
    const res = await app.request('/api/auth/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Kaboomerang' }) });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string; user: { id: string; name: string } };
    expect(body.user.name).toBe('Kaboomerang');
    const s = await verifySession(body.token, cfg.JWT_SECRET);
    expect(s?.sub).toBe(body.user.id);
    const me = await app.request('/api/auth/session', { headers: { Authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(200);
  });

  it('rejects invalid names and forged tokens', async () => {
    const app = createApp(cfg);
    for (const name of ['ab', 'way-too-long-name-here', 'has space', '<script>']) {
      const res = await app.request('/api/auth/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      expect(res.status).toBe(400);
    }
    expect(await verifySession('not.a.token', cfg.JWT_SECRET)).toBeNull();
    const res = await app.request('/api/auth/session', { headers: { Authorization: 'Bearer forged' } });
    expect(res.status).toBe(401);
  });
});
