// The player's current room over PeerJS: host a room (this tab runs
// HostSession; our own UI is a loopback PeerClient), join one by code, resume a hosted room after a refresh.
// Feeds the `useLobby` store from the PeerClient; the match side goes through `MatchFeed`.
import { create } from 'zustand';
import {
  rememberRoom, type CloseReason, type LobbyIntent, type LobbyView, type MatchSettings, type PeerClient,
} from '@lobbers/shared';
import { myId, myPeerProfile, store as profileStore, useProfile } from '../../state/profile';
import { MatchFeed } from './MatchFeed';
import { createRoom, joinRoom, resumeHostedRoom, type HostedRoom, type JoinedRoom } from './peerjs';

export type RoomStatus = 'idle' | 'connecting' | 'joined' | 'reconnecting' | 'closed' | 'not-found';
export interface Notice { id: number; text: string; kind: 'ok' | 'error' }

export interface LobbyStore {
  status: RoomStatus;
  code: string;
  hosting: boolean;
  view: LobbyView | null;
  /** Round trip to the host (ms); 0 while hosting. */
  rtt: number;
  /** Local ms when the 3-2-1 countdown ends (0 = none). */
  countdownEndsAt: number;
  /** Match id the room just started (the app navigates to /match/:id). */
  pendingMatch: string | null;
  closedReason: CloseReason | 'not-found' | 'lost' | null;
  notice: Notice | null;
}

const initial: LobbyStore = { status: 'idle', code: '', hosting: false, view: null, rtt: 0, countdownEndsAt: 0, pendingMatch: null, closedReason: null, notice: null };
export const useLobby = create<LobbyStore>(() => ({ ...initial }));

type Handle = { kind: 'host'; room: HostedRoom } | { kind: 'guest'; room: JoinedRoom };
let handle: Handle | null = null;
let feed: MatchFeed | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let offs: Array<() => void> = [];
let noticeSeq = 1;
/** One join/host in flight at a time: a second call (StrictMode effects, double clicks) gets the same promise,
 *  otherwise two Peer objects would hold the same seat and keep replacing each other's link. */
let inflight: { key: string; p: Promise<string> } | null = null;
const once = (key: string, run: () => Promise<string>): Promise<string> => {
  if (inflight?.key === key) return inflight.p;
  const p = run().finally(() => { if (inflight?.p === p) inflight = null; });
  inflight = { key, p };
  return p;
};
const HOST_ROOM_KEY = 'lobbers:hostRoom';

/** "LOB-7Q4K-2" → "LOB-7Q4K" */
export const codeOfMatch = (matchId: string): string => matchId.replace(/-\d+$/, '');
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const notify = (text: string, kind: Notice['kind'] = 'ok'): void => useLobby.setState({ notice: { id: noticeSeq++, text, kind } });

function wire(h: Handle, code: string): void {
  handle = h;
  const client = h.room.client;
  feed = new MatchFeed(client);
  useLobby.setState({ ...initial, status: client.lobby ? 'joined' : 'connecting', code, hosting: h.kind === 'host', view: client.lobby });
  offs = [
    client.on('lobbyState', (m) => { if (m.t === 'lobbyState') useLobby.setState({ view: m.data, status: 'joined' }); }),
    client.on('matchStarting', (m) => { if (m.t === 'matchStarting') useLobby.setState({ countdownEndsAt: Date.now() + m.countdown * 1000 }); }),
    client.on('matchStarted', (m) => { if (m.t === 'matchStarted') useLobby.setState({ pendingMatch: m.data.matchId, countdownEndsAt: 0 }); }),
    client.on('rejected', (m) => { if (m.t === 'rejected' && !feedIntent(m.intent)) notify(capital(m.reason), 'error'); }),
    client.on('closed', (m) => { if (m.t === 'closed') useLobby.setState({ status: 'closed', closedReason: m.reason }); }),
    // Inventory changes while you're in a lobby reach the host (they are resolved into the match at start).
    useProfile.subscribe((next, prev) => {
      if (!next.profile || !prev.profile || next.profile.equipped === prev.profile.equipped) return;
      if (useLobby.getState().view?.phase !== 'open') return;
      const peer = myPeerProfile();
      if (peer) client.send({ t: 'setCosmetics', cosmetics: peer.cosmetics, title: peer.title });
    }),
  ];
  const view = (): void => {
    const st = h.kind === 'guest' ? h.room.state() : client.status;
    const status: RoomStatus = st === 'not-found' ? 'not-found' : (st as RoomStatus);
    const patch: Partial<LobbyStore> = { status, rtt: h.kind === 'host' ? 0 : client.rtt ?? 0 };
    if (status === 'not-found') patch.closedReason = 'not-found';
    if (status === 'closed' && !useLobby.getState().closedReason) patch.closedReason = 'lost';
    if (status !== useLobby.getState().status || patch.rtt !== useLobby.getState().rtt) useLobby.setState(patch);
  };
  view();
  poll = setInterval(view, 400);
}

const feedIntent = (t: string): boolean => ['aim', 'move', 'jump', 'selectWeapon', 'useAbility', 'fire', 'skipTurn', 'forfeit', 'emote', 'loaded'].includes(t);

function unwire(): void {
  for (const o of offs) o();
  offs = [];
  if (poll) clearInterval(poll);
  poll = null;
  feed?.close();
  feed = null;
  handle = null;
}

function remember(code: string, name: string, hosted: boolean): void {
  useProfile.getState().update((p) => rememberRoom(p, { code, name, at: Date.now(), hosted }));
}

export interface HostOptions { roomName: string; settings: MatchSettings }

export const lobbyService = {
  get client(): PeerClient | null { return handle?.room.client ?? null; },
  get feed(): MatchFeed | null { return feed; },
  get myId(): string { return myId(); },
  /** This tab hosted `code` before a reload (it is resumed at app start — never join your own room). */
  hostsCode(code: string): boolean { return profileStore.getItem(HOST_ROOM_KEY) === code; },

  /** You host: this tab runs the room. Returns the room code. */
  host(o: HostOptions): Promise<string> { return once('host', () => lobbyService.hostNow(o)); },

  async hostNow(o: HostOptions): Promise<string> {
    const profile = myPeerProfile();
    if (!profile) throw new Error('Pick a name first');
    await lobbyService.leave();
    useLobby.setState({ ...initial, status: 'connecting', hosting: true });
    try {
      const room = await createRoom({ profile, roomName: o.roomName, settings: o.settings });
      wire({ kind: 'host', room }, room.code);
      remember(room.code, o.roomName, true);
      return room.code;
    } catch (e) {
      useLobby.setState({ ...initial });
      throw new Error(peerErrorText(e));
    }
  },

  /** Join (or rejoin with the stored token) the room behind a code. */
  join(code: string): Promise<string> { return once(`join:${code.toUpperCase()}`, () => lobbyService.joinNow(code)); },

  async joinNow(code: string): Promise<string> {
    const c = code.toUpperCase();
    if (handle && useLobby.getState().code === c) return c;
    const profile = myPeerProfile();
    if (!profile) throw new Error('Pick a name first');
    await lobbyService.leave();
    useLobby.setState({ ...initial, status: 'connecting', code: c });
    try {
      const room = await joinRoom({ code: c, profile });
      wire({ kind: 'guest', room }, c);
      return c;
    } catch (e) {
      useLobby.setState({ ...initial });
      throw new Error(peerErrorText(e));
    }
  },

  /** App start after a host refresh: resume the room this tab was hosting (match included). */
  resumeHosted(): Promise<string | null> { return once('resume', async () => (await lobbyService.resumeHostedNow()) ?? '').then((c) => c || null); },

  async resumeHostedNow(): Promise<string | null> {
    const code = profileStore.getItem(HOST_ROOM_KEY);
    const profile = myPeerProfile();
    if (!code || !profile || handle) return handle ? useLobby.getState().code : null;
    useLobby.setState({ ...initial, status: 'connecting', code, hosting: true });
    const room = await resumeHostedRoom({ code, profile }).catch(() => null);
    if (!room) { profileStore.removeItem(HOST_ROOM_KEY); useLobby.setState({ ...initial }); return null; }
    wire({ kind: 'host', room }, code);
    return code;
  },

  /** Remember the room's display name once the first lobby view arrives (Recent rooms). */
  noteRoomName(name: string): void { const s = useLobby.getState(); if (s.code && !s.hosting) remember(s.code, name, false); },

  send(intent: LobbyIntent): void { handle?.room.client.send(intent); },
  consumePendingMatch(): void { useLobby.setState({ pendingMatch: null }); },
  clearNotice(): void { useLobby.setState({ notice: null }); },
  clearClosed(): void { useLobby.setState({ ...initial }); },

  /** Guests: leave the room. Host: close it for everyone. */
  async leave(): Promise<void> {
    const h = handle;
    if (!h) return;
    unwire();
    if (h.kind === 'host') h.room.close(); else h.room.leave();
    useLobby.setState({ ...initial });
  },
};

/** PeerJS errors → player-facing copy. */
export function peerErrorText(e: unknown): string {
  const type = typeof e === 'object' && e !== null ? (e as { type?: unknown }).type : undefined;
  if (type === 'browser-incompatible') return 'This browser can’t do peer-to-peer (WebRTC).';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') return 'Can’t reach the connection server. Check your internet and try again.';
  if (type === 'unavailable-id') return 'That room code is taken — try again.';
  return e instanceof Error && e.message ? e.message : 'Could not connect.';
}

/** DESIGN_SPEC §3.8: the one-line card copy for every way a room can end for you. */
export function closedText(r: LobbyStore['closedReason']): string {
  switch (r) {
    case 'not-found': return 'Room not found';
    case 'room full': return 'Room is full';
    case 'match in progress': return 'This match already started';
    case 'already joined': return 'You’re already in this room in another tab';
    case 'version mismatch': return 'A newer version is out — refresh the page';
    case 'host closed the room': return 'The host closed the room';
    case 'kicked': return 'You were removed by the host';
    case 'lost': return 'Lost the connection to the host';
    case 'bad hello': return 'Couldn’t join that room';
    default: return 'The room closed';
  }
}
