// Owns the current online match room: joins it from the lobby's seat reservation, resumes it after a
// reload (reconnection token), and leaves it when the player is done.
import type { SeatReservation } from 'colyseus.js';
import { useSession } from '../../state/session';
import { colyseus } from './colyseus';
import { NetMatchController, useMatchLink } from './NetMatchController';
import { matchTicket } from './storage';

let current: NetMatchController | null = null;

function adopt(c: NetMatchController): NetMatchController {
  current = c;
  useMatchLink.setState({ status: 'connected', deadline: 0, generation: 0 });
  return c;
}

export const matchService = {
  get current(): NetMatchController | null { return current; },

  async join(matchId: string, reservation: unknown): Promise<NetMatchController> {
    if (current?.matchId === matchId) return current;
    if (current) await current.close();
    const room = await colyseus().consumeSeatReservation(reservation as SeatReservation);
    return adopt(new NetMatchController(room, matchId, useSession.getState().user?.id ?? ''));
  },

  /** After a reload: rejoin with the stored token. Null when the seat is gone. */
  async resume(matchId: string): Promise<NetMatchController | null> {
    if (current?.matchId === matchId) return current;
    const userId = useSession.getState().user?.id ?? '';
    const t = matchTicket.get();
    if (t && t.roomId === matchId) {
      try { return adopt(new NetMatchController(await colyseus().reconnect(t.token), matchId, userId)); } catch { matchTicket.set(null); }
    }
    // No (valid) token, e.g. a reopened tab: the room re-seats the same account inside the window.
    try { return adopt(new NetMatchController(await colyseus().joinById(matchId), matchId, userId)); } catch { return null; }
  },

  async leave(): Promise<void> {
    const c = current;
    current = null;
    await c?.close();
  },
};
