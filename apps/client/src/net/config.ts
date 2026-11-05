// Where the Lobbers server lives. VITE_SERVER_URL may be ws(s):// or http(s):// (see .env.example);
// VITE_API_URL (…/api) overrides the REST base. Default: same host, port 2567.
const env = import.meta.env as { VITE_SERVER_URL?: string; VITE_API_URL?: string };
const strip = (u: string): string => u.replace(/\/+$/, '');

const base = env.VITE_SERVER_URL ? strip(env.VITE_SERVER_URL).replace(/^ws(s?):/, 'http$1:') : `${location.protocol}//${location.hostname}:2567`;

/** REST origin (paths add `/api/...`). */
export const SERVER_URL = env.VITE_API_URL ? strip(env.VITE_API_URL).replace(/\/api$/, '') : base;
/** Colyseus WebSocket endpoint. */
export const WS_URL = base.replace(/^http/, 'ws');
