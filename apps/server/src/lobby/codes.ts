// Room code → roomId registry in Colyseus presence (Redis when REDIS_URL is set, so codes resolve
// across processes). Private rooms are hidden from matchmaking, so "join by code" goes through here.
import type { Presence } from '@colyseus/core';
import { createRng, generateRoomCode } from '@lobbers/shared';

const KEY = 'lobbers:room-codes';

export async function claimRoomCode(presence: Presence, roomId: string): Promise<string> {
  const rng = createRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode(rng);
    if (!(await presence.hget(KEY, code))) {
      await presence.hset(KEY, code, roomId);
      return code;
    }
  }
  throw new Error('could not allocate a room code');
}

export async function releaseRoomCode(presence: Presence, code: string): Promise<void> {
  if (code) await presence.hdel(KEY, code);
}

export async function roomIdForCode(presence: Presence, code: string): Promise<string | null> {
  return (await presence.hget(KEY, code.toUpperCase())) || null;
}
