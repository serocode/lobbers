// Reconnection tokens so a reload — or reopening a closed tab — resumes the same lobby / match seat.
// localStorage (not sessionStorage): one active game per browser profile.
export interface RoomTicket { roomId: string; token: string; code?: string }

const get = (k: string): RoomTicket | null => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? 'null') as RoomTicket | null;
    return v && typeof v.roomId === 'string' && typeof v.token === 'string' ? v : null;
  } catch { return null; }
};
const put = (k: string, v: RoomTicket | null): void => {
  try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* ignore */ }
};

export const lobbyTicket = { get: () => get('lobbers.lobby'), set: (v: RoomTicket | null) => put('lobbers.lobby', v) };
export const matchTicket = { get: () => get('lobbers.match'), set: (v: RoomTicket | null) => put('lobbers.match', v) };
