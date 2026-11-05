// Room authentication. Colyseus calls the static `onAuth(token)` of a room class, so the JWT secret
// lives here (set once at boot). The verified user id is the player's identity in every room;
// client-sent ids are never trusted.
import { createHmac } from 'node:crypto';
import { verifySession } from './jwt.ts';

export interface RoomAuth { userId: string; name: string }

let secret = '';

export function configureRoomAuth(jwtSecret: string): void { secret = jwtSecret; }

export async function authenticate(token: unknown): Promise<RoomAuth> {
  if (!secret) throw new Error('room auth not configured');
  if (typeof token !== 'string' || !token) throw new Error('sign in first');
  const s = await verifySession(token, secret);
  if (!s) throw new Error('session expired — sign in again');
  return { userId: s.sub, name: s.name };
}

/** Key the LobbyRoom passes when it creates a MatchRoom, so clients can't create match rooms directly. */
export function internalRoomKey(): string {
  if (!secret) throw new Error('room auth not configured');
  return createHmac('sha256', secret).update('lobbers:match-room').digest('hex');
}

export function isRoomAuth(v: unknown): v is RoomAuth {
  return typeof v === 'object' && v !== null && typeof (v as RoomAuth).userId === 'string' && typeof (v as RoomAuth).name === 'string';
}
