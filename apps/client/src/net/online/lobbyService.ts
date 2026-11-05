// The player's current LobbyRoom: create / join by code / join by id / quick match / resume after a
// reload, the synced LobbyView store, server notices (rejections, kick), clock offset and ping.
// When the server hands out match seats, the match room is joined here and `pendingMatch` tells the
// app to navigate (all players move together).
import type { Room } from 'colyseus.js';
import { create } from 'zustand';
import type { GameMode, LobbyIntent, LobbyServerMessage, LobbyView, MapId, TimeSyncReply } from '@lobbers/shared';
import { api } from '../api';
import { useSession } from '../../state/session';
import { readLoadout } from '../../state/cosmetics';
import { colyseus, joinErrorText } from './colyseus';
import { matchService } from './matchService';
import { lobbyTicket } from './storage';

export type LobbyStatus = 'idle' | 'joining' | 'open' | 'reconnecting' | 'lost';
export interface Notice { id: number; text: string; kind: 'ok' | 'error' }

export interface LobbyStore {
  status: LobbyStatus;
  view: LobbyView | null;
  roomId: string;
  /** Server clock offset (ms) for countdowns. */
  offset: number;
  pendingMatch: string | null;
  notice: Notice | null;
  kicked: string;
}

export const useLobby = create<LobbyStore>(() => ({ status: 'idle', view: null, roomId: '', offset: 0, pendingMatch: null, notice: null, kicked: '' }));

interface Json { toJSON(): Omit<LobbyView, 'players' | 'chat'> & { players?: Record<string, LobbyView['players'][number]>; chat?: LobbyView['chat'] } }
const toView = (s: Json): LobbyView => {
  const j = s.toJSON();
  return { ...j, players: Object.values(j.players ?? {}).sort((a, b) => a.slot - b.slot), chat: j.chat ?? [] };
};

let room: Room | null = null;
let noticeSeq = 1;
const notify = (text: string, kind: Notice['kind'] = 'ok'): void => useLobby.setState({ notice: { id: noticeSeq++, text, kind } });

function attach(r: Room): void {
  room = r;
  lobbyTicket.set({ roomId: r.roomId, token: r.reconnectionToken });
  useLobby.setState({ status: 'open', roomId: r.roomId, kicked: '' });
  r.onStateChange((s: Json) => {
    const view = toView(s);
    useLobby.setState({ view });
    const t = lobbyTicket.get();
    if (view.code && t?.code !== view.code) lobbyTicket.set({ roomId: r.roomId, token: r.reconnectionToken, code: view.code });
  });
  r.onMessage('ping', (m: { t: number }) => r.send('pong', m));
  r.onMessage('time', (m: TimeSyncReply) => useLobby.setState({ offset: m.serverTime - (m.clientTime + Date.now()) / 2 }));
  r.onMessage('lobby', (m: LobbyServerMessage) => {
    switch (m.t) {
      case 'rejected': return notify(capitalise(m.reason), 'error');
      case 'kicked':
        lobbyTicket.set(null);
        useLobby.setState({ kicked: m.reason });
        return;
      case 'matchStarting': return;
      case 'matchReady':
        void matchService.join(m.matchId, m.reservation)
          .then(() => useLobby.setState({ pendingMatch: m.matchId }))
          .catch((e: unknown) => notify(`Could not join the match: ${joinErrorText(e)}`, 'error'));
    }
  });
  r.onLeave((code) => {
    if (room !== r) return;
    if (code === 4000 || code === 1000 || code === 4001) { reset(); return; }
    void resumeLoop(r.reconnectionToken);
  });
  r.send('time', { clientTime: Date.now() });
}

function reset(): void {
  room = null;
  useLobby.setState({ status: 'idle', view: null, roomId: '', pendingMatch: null });
}

async function resumeLoop(token: string): Promise<void> {
  useLobby.setState({ status: 'reconnecting' });
  for (let i = 0; i < 20; i++) {
    try { attach(await colyseus().reconnect(token)); return; } catch { await new Promise((r) => setTimeout(r, 2000)); }
  }
  lobbyTicket.set(null);
  room = null;
  useLobby.setState({ status: 'lost', view: null });
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

let queue: Promise<unknown> = Promise.resolve();

/** Joins are serialised so overlapping calls (StrictMode, double clicks) never hold two rooms. */
function enter(join: () => Promise<Room>): Promise<string> {
  const run = queue.then(() => enterNow(join), () => enterNow(join));
  queue = run.catch(() => undefined);
  return run;
}

async function enterNow(join: () => Promise<Room>): Promise<string> {
  if (room) await lobbyService.leave();
  useLobby.setState({ status: 'joining' });
  try {
    const r = await join();
    attach(r);
    // Wait for the first state so callers can navigate to /lobby/:code.
    for (let i = 0; i < 100 && !useLobby.getState().view?.code; i++) await new Promise((res) => setTimeout(res, 20));
    return useLobby.getState().view?.code ?? '';
  } catch (e) {
    useLobby.setState({ status: 'idle' });
    throw new Error(joinErrorText(e));
  }
}

export interface CreateRoomOptions { name: string; mapId: MapId; mode: GameMode; isPrivate: boolean }

export const lobbyService = {
  get room(): Room | null { return room; },
  get myId(): string { return useSession.getState().user?.id ?? ''; },

  create: (o: CreateRoomOptions): Promise<string> => enter(() => colyseus().create('lobby', { ...o, machine: useSession.getState().machine, cosmetics: readLoadout() })),
  joinById: (roomId: string): Promise<string> => enter(() => colyseus().joinById(roomId, { machine: useSession.getState().machine, cosmetics: readLoadout() })),
  async joinByCode(code: string): Promise<string> {
    const r = await api<{ roomId: string }>(`/api/rooms/code/${encodeURIComponent(code.toUpperCase())}`);
    return lobbyService.joinById(r.roomId);
  },
  /** Quick Match / Play Now: fill an open public room, else create one. */
  quick: (ranked: boolean): Promise<string> => enter(() => colyseus().joinOrCreate('lobby', { ranked, isPrivate: false, machine: useSession.getState().machine, cosmetics: readLoadout() })),

  /** After a reload: reclaim the seat with the stored token. */
  async resume(): Promise<string | null> {
    if (room) return useLobby.getState().view?.code ?? null;
    const t = lobbyTicket.get();
    if (!t) return null;
    try { return await enter(() => colyseus().reconnect(t.token)); } catch { lobbyTicket.set(null); return null; }
  },

  send(intent: LobbyIntent): void { room?.send('intent', intent); },
  consumePendingMatch(): void { useLobby.setState({ pendingMatch: null }); },
  clearNotice(): void { useLobby.setState({ notice: null }); },

  async leave(): Promise<void> {
    const r = room;
    lobbyTicket.set(null);
    reset();
    await r?.leave(true).catch(() => undefined);
  },
};
