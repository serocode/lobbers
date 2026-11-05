// The colyseus.js client, authenticated with the guest JWT (rooms verify it in onAuth).
import { Client } from 'colyseus.js';
import { WS_URL } from '../config';
import { useSession } from '../../state/session';

let client: Client | null = null;

export function colyseus(): Client {
  if (!client) client = new Client(WS_URL);
  client.auth.token = useSession.getState().token;
  return client;
}

/** Turns colyseus.js matchmaking errors into player-facing copy. */
export function joinErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/locked|full/i.test(msg)) return 'That room is full or already in a match.';
  if (/not found|invalid|expired/i.test(msg)) return 'That room no longer exists.';
  if (/ECONNREFUSED|Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the Lobbers server.';
  return msg || 'Could not join the room.';
}
