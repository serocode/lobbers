// PeerJS transport for @lobbers/shared's HostSession / PeerClient.
// The ONLY file that knows about PeerJS. Everything else talks HostMessage / PeerMessage.
//
//   Host tab:   createRoom()  → registers peer id "lobbers-v2-LOB-XXXX" on the signaling server, runs HostSession,
//                               and connects the host's own UI through a loopback link.
//   Guest tab:  joinRoom(code) → connects a WebRTC data channel to that id, with auto-reconnect.
//
// npm i peerjs@^1.5   (signaling: the free PeerJS cloud server by default, or your own `npx peerjs --port 9000`)
import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import {
  CONNECTION_RULES, HOST_RULES, MAX_PEER_MESSAGE_CHARS, HostSession, PeerClient, connectLoopback, generateRoomCode, createRng, realClock, safeStore,
  type ClientLink, type HostSessionOptions, type KeyValueStore, type MatchSettings, type PeerLink, type PeerProfile,
} from '@lobbers/shared';

// ---------------------------------------------------------------- config (Vite env, see .env.example)
export interface P2PConfig { peer: PeerOptions }

export function p2pConfigFromEnv(env: Record<string, string | undefined> = import.meta.env): P2PConfig {
  const iceServers: RTCIceServer[] = (() => {
    try { return env.VITE_ICE_SERVERS ? JSON.parse(env.VITE_ICE_SERVERS) as RTCIceServer[] : DEFAULT_ICE; } catch { return DEFAULT_ICE; }
  })();
  const peer: PeerOptions = { config: { iceServers }, debug: env.DEV ? 1 : 0 };
  if (env.VITE_PEER_HOST) {                       // self-hosted PeerServer; omit to use the PeerJS cloud server
    peer.host = env.VITE_PEER_HOST;
    peer.port = Number(env.VITE_PEER_PORT ?? 443);
    peer.path = env.VITE_PEER_PATH ?? '/';
    peer.secure = (env.VITE_PEER_SECURE ?? 'true') === 'true';
    if (env.VITE_PEER_KEY) peer.key = env.VITE_PEER_KEY;
  }
  return { peer };
}

/** STUN only. Add a TURN entry via VITE_ICE_SERVERS for players behind strict NATs (some mobile data networks). */
const env = import.meta.env;
const DEFAULT_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export const peerIdFor = (code: string): string => HOST_RULES.peerIdPrefix + code;

const randomSource = (): (() => number) => {
  const buf = new Uint32Array(1);
  return () => { crypto.getRandomValues(buf); return buf[0] / 2 ** 32; };
};

function openPeer(id: string | undefined, cfg: P2PConfig): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, cfg.peer) : new Peer(cfg.peer);
    const onErr = (err: { type?: string }): void => { peer.destroy(); reject(err); };
    peer.once('open', () => { peer.off('error', onErr); resolve(peer); });
    peer.once('error', onErr);
  });
}

// ---------------------------------------------------------------- host
export interface HostedRoom {
  code: string;
  session: HostSession;
  /** The host's own PeerClient — the UI uses it exactly like a guest's. */
  client: PeerClient;
  close(): void;
}

/** Wires a PeerJS peer to a HostSession: every incoming data connection becomes a PeerLink. */
function serve(peer: Peer, session: HostSession): void {
  peer.on('connection', (conn: DataConnection) => {
    const link: PeerLink = {
      send: (m) => { if (conn.open) conn.send(JSON.stringify(m)); },
      close: () => { setTimeout(() => conn.close(), 50); },      // let a final `closed {reason}` flush
    };
    conn.on('open', () => session.connect(link));
    conn.on('data', (d) => { if (typeof d === 'string' && d.length <= MAX_PEER_MESSAGE_CHARS) session.receive(link, d); });
    conn.on('close', () => { if (env.DEV) console.info('[p2p] host: link closed', conn.peer); session.disconnect(link); });
    conn.on('error', (e) => { if (env.DEV) console.info('[p2p] host: link error', conn.peer, (e as { type?: string }).type); session.disconnect(link); });
  });
  // Lost the signaling server (not the players): existing data channels keep working; re-register for new joins.
  peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1000); });
}

export async function createRoom(opts: {
  profile: PeerProfile; roomName: string; settings?: MatchSettings; cfg?: P2PConfig; storage?: Storage | null;
}): Promise<HostedRoom> {
  const cfg = opts.cfg ?? p2pConfigFromEnv();
  const store = safeStore(opts.storage ?? globalThis.localStorage);
  const random = randomSource();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode(createRng(Math.floor(random() * 2 ** 31)));
    let peer: Peer;
    try { peer = await openPeer(peerIdFor(code), cfg); }
    catch (e) { if ((e as { type?: string }).type === 'unavailable-id') continue; throw e; }
    return host(peer, code, { code, roomName: opts.roomName, host: opts.profile, settings: opts.settings, clock: realClock, store, random }, store);
  }
  throw new Error('Could not get a room code — try again');
}

/**
 * Host page reload (F5 mid-match): call on startup when `localStorage` has `lobbers:hostRoom` = code.
 * Re-registers the same peer id (retrying while the signaling server releases the old one) and resumes.
 */
export async function resumeHostedRoom(opts: { code: string; profile: PeerProfile; cfg?: P2PConfig; storage?: Storage | null }): Promise<HostedRoom | null> {
  const cfg = opts.cfg ?? p2pConfigFromEnv();
  const store = safeStore(opts.storage ?? globalThis.localStorage);
  const session = HostSession.restore({ code: opts.code, roomName: '', host: opts.profile, clock: realClock, store, random: randomSource() });
  if (!session) return null;
  const deadline = Date.now() + 20_000;
  for (;;) {
    try { const peer = await openPeer(peerIdFor(opts.code), cfg); return hostExisting(peer, opts.code, session, store); }
    catch (e) {
      if ((e as { type?: string }).type !== 'unavailable-id' || Date.now() > deadline) { session.close(); return null; }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

function host(peer: Peer, code: string, so: HostSessionOptions, store: KeyValueStore): HostedRoom {
  return hostExisting(peer, code, new HostSession(so), store);
}

function hostExisting(peer: Peer, code: string, session: HostSession, store: KeyValueStore): HostedRoom {
  serve(peer, session);
  store.setItem('lobbers:hostRoom', code);
  const client = new PeerClient({ code, profile: hostProfile(session), clock: realClock, tokenStore: store });
  connectLoopback(session, client, { local: true });
  const unload = (): void => { /* keep the snapshot: a refresh resumes; an explicit Leave calls close() */ };
  globalThis.addEventListener?.('pagehide', unload);
  return {
    code, session, client,
    close: () => { store.removeItem('lobbers:hostRoom'); session.close(); peer.destroy(); globalThis.removeEventListener?.('pagehide', unload); },
  };
}

function hostProfile(session: HostSession): PeerProfile {
  const p = session.lobby.players.find((x) => x.isHost)!;
  return { id: p.id, name: p.name, level: p.level ?? 1, rating: p.rating ?? 1000, title: p.title ?? null, avatar: null, favoriteMachine: p.machine, cosmetics: p.cosmetics ?? {} };
}

// ---------------------------------------------------------------- guest
export interface JoinedRoom {
  client: PeerClient;
  /** 'connecting' | 'joined' | 'reconnecting' | 'closed' | 'not-found' */
  state(): string;
  leave(): void;
}

export async function joinRoom(opts: { code: string; profile: PeerProfile; cfg?: P2PConfig; storage?: Storage | null }): Promise<JoinedRoom> {
  const cfg = opts.cfg ?? p2pConfigFromEnv();
  const store = safeStore(opts.storage ?? globalThis.localStorage);
  const client = new PeerClient({ code: opts.code, profile: opts.profile, clock: realClock, tokenStore: store });
  const peer = await openPeer(undefined, cfg);
  let left = false;
  let notFound = false;
  let everJoined = false;
  let lostAt = 0;
  let conn: DataConnection | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = (): void => {
    retryTimer = null;
    if (left || client.status === 'closed') return;
    const prev = conn;
    const c = peer.connect(peerIdFor(opts.code), { reliable: true, serialization: 'json' });
    conn = c;
    prev?.close();                                   // events from a stale connection are ignored below
    // ICE can stall without an error (strict NAT, no TURN): give up on this attempt and try again.
    const stall = setTimeout(() => { if (conn === c && !c.open) { conn = null; c.close(); client.detach(); retry(); } }, 10_000);
    c.on('open', () => {
      clearTimeout(stall);
      if (conn !== c) return;
      lostAt = 0;
      const link: ClientLink = { send: (m) => { if (c.open) c.send(JSON.stringify(m)); }, close: () => c.close() };
      client.attach(link);
    });
    c.on('data', (d) => { if (conn === c && typeof d === 'string') client.receive(d); });
    const lost = (why: string) => (e?: unknown): void => { if (env.DEV) console.info('[p2p] guest link', why, (e as { type?: string })?.type ?? '', conn === c ? 'current' : 'stale'); if (conn !== c) return; client.detach(); retry(); };
    c.on('close', lost('close'));
    c.on('error', lost('error'));
  };

  /** One pending reconnect at a time (close + error + peer-unavailable can all fire for the same loss). */
  const retry = (): void => {
    if (left || client.status === 'closed' || retryTimer !== null) return;
    lostAt ||= Date.now();
    if (Date.now() - lostAt > CONNECTION_RULES.reconnectWindowSec * 1000) { client.status = 'closed'; return; }
    retryTimer = setTimeout(connect, 1500);
  };

  client.on('welcome', () => { everJoined = true; });
  peer.on('error', (err: { type?: string }) => {
    if (env.DEV) console.info('[p2p] guest peer error', err.type);
    // Host id not registered: wrong code before we ever joined; afterwards it's the host refreshing — keep retrying.
    if (err.type === 'peer-unavailable') { if (!everJoined) { notFound = true; client.status = 'closed'; } else retry(); }
  });
  peer.on('disconnected', () => { if (!peer.destroyed && !left) setTimeout(() => peer.reconnect(), 1000); });
  connect();

  return {
    client,
    state: () => (notFound ? 'not-found' : client.status),
    leave: () => { left = true; client.send({ t: 'leave' }); setTimeout(() => { conn?.close(); peer.destroy(); }, 100); store.removeItem(PeerClient.tokenKey(opts.code)); },
  };
}

/** Settings → "Connection: STUN only / TURN configured" (read-only, from VITE_ICE_SERVERS). */
export function connectionLabel(cfg: P2PConfig = p2pConfigFromEnv()): string {
  const servers: RTCIceServer[] = (cfg.peer.config as RTCConfiguration | undefined)?.iceServers ?? [];
  const turn = servers.some((s: RTCIceServer) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u: string) => u.startsWith('turn')));
  return turn ? 'TURN configured' : 'STUN only';
}
