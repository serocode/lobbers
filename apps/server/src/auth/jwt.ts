import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

/** Claims carried by a guest session token. The user id is the player's identity in every room. */
export const SessionClaims = z.object({ sub: z.string().min(1), name: z.string().min(1), guest: z.literal(true) });
export type Session = z.infer<typeof SessionClaims>;

const key = (secret: string): Uint8Array => new TextEncoder().encode(secret);

export async function signSession(s: Session, secret: string, ttl = '30d'): Promise<string> {
  return new SignJWT({ name: s.name, guest: s.guest }).setProtectedHeader({ alg: 'HS256' }).setSubject(s.sub).setIssuedAt().setExpirationTime(ttl).sign(key(secret));
}

/** Returns the session or null for any invalid / expired / tampered token. */
export async function verifySession(token: string, secret: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    const parsed = SessionClaims.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
