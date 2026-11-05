// Typed REST helpers. Errors carry the server's message so panels can show it inline (DESIGN_SPEC §3.8).
import { SERVER_URL } from './config';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  } catch {
    throw new ApiError('Can’t reach the Lobbers server. Check your connection and try again.', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : `Server error (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}
