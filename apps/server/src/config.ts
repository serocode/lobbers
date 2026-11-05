import { z } from 'zod';
import { CONNECTION_RULES } from '@lobbers/shared';

const Env = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(2567),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  RECONNECT_WINDOW_SEC: z.coerce.number().int().min(5).max(600).default(CONNECTION_RULES.reconnectWindowSec),
  REDIS_URL: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerConfig = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const cfg = Env.parse(env);
  if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.startsWith('dev-only')) throw new Error('JWT_SECRET must be set in production');
  return cfg;
}
