// Native WebRTC transport (RTCPeerConnection + RTCDataChannel) with a tiny WebSocket signaling relay.
// Same role as apps/client/src/net/p2p/peerjs.ts, but dependency-free so the engine can be proven in real
// browsers without the PeerJS cloud. Each guest opens ONE ordered, reliable data channel to the host.
import { HOST_RULES, MAX_PEER_MESSAGE_CHARS, type HostSession, type PeerClient, type PeerLink, type ClientLink } from '../../packages/shared/src/index.ts';

type Sig = { kind: 'offer' | 'answer'; sdp: string } | { kind: 'ice'; candidate: RTCIceCandidateInit };
const ICE: RTCIceServer[] = [];   // localhost: host candidates are enough. Real app: STUN + optional TURN.

class Signal {
  private handlers: Array<(from: string, d: Sig) => void> = [];
  private unavailable: Array<(id: string) => void> = [];
  private constructor(private ws: WebSocket) {
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'signal') this.handlers.forEach((h) => h(m.from, m.data));
      if (m.type === 'unavailable') this.unavailable.forEach((h) => h(m.id));
    };
  }
  static open(url: string, id: string): Promise<Signal> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'register', id }));
      ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.type === 'registered') resolve(new Signal(ws)); else if (m.type === 'id-taken') { ws.close(); reject(new Error('unavailable-id')); } };
      ws.onerror = () => reject(new Error('signal-error'));
    });
  }
  send(to: string, data: Sig): void { this.ws.send(JSON.stringify({ type: 'signal', to, data })); }
  onSignal(h: (from: string, d: Sig) => void): void { this.handlers.push(h); }
  onUnavailable(h: (id: string) => void): void { this.unavailable.push(h); }
}

export async function hostRTC(session: HostSession, signalUrl: string, code: string): Promise<void> {
  let sig: Signal | null = null;
  for (let i = 0; i < 20 && !sig; i++) { try { sig = await Signal.open(signalUrl, HOST_RULES.peerIdPrefix + code); } catch { await new Promise((r) => setTimeout(r, 500)); } }
  if (!sig) throw new Error('could not register room');
  const pcs = new Map<string, RTCPeerConnection>();
  sig.onSignal(async (from, d) => {
    let pc = pcs.get(from);
    if (d.kind === 'offer') {
      pc?.close();
      pc = new RTCPeerConnection({ iceServers: ICE });
      pcs.set(from, pc);
      pc.onicecandidate = (e) => { if (e.candidate) sig!.send(from, { kind: 'ice', candidate: e.candidate.toJSON() }); };
      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        const link: PeerLink = { send: (m) => { if (dc.readyState === 'open') dc.send(JSON.stringify(m)); }, close: () => setTimeout(() => dc.close(), 50) };
        const open = (): void => session.connect(link);
        if (dc.readyState === 'open') open(); else dc.onopen = open;
        dc.onmessage = (e) => { if (typeof e.data === 'string' && e.data.length <= MAX_PEER_MESSAGE_CHARS) session.receive(link, e.data); };
        dc.onclose = () => session.disconnect(link);
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      sig!.send(from, { kind: 'answer', sdp: ans.sdp! });
    } else if (d.kind === 'ice' && pc) await pc.addIceCandidate(d.candidate).catch(() => {});
  });
}

/** Connects to the host and keeps reconnecting (host refresh, network blips) until `stop()` or the room closes. */
export async function joinRTC(client: PeerClient, signalUrl: string, code: string): Promise<{ stop(): void }> {
  const me = 'guest-' + Math.random().toString(36).slice(2, 10);
  const sig = await Signal.open(signalUrl, me);
  const hostId = HOST_RULES.peerIdPrefix + code;
  let pc: RTCPeerConnection | null = null;
  let stopped = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const retry = (): void => { if (stopped || client.status === 'closed' || pending) return; pending = setTimeout(() => { pending = null; void connect(); }, 1000); };
  sig.onUnavailable(() => retry());
  sig.onSignal(async (_from, d) => {
    if (!pc) return;
    if (d.kind === 'answer') await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
    else if (d.kind === 'ice') await pc.addIceCandidate(d.candidate).catch(() => {});
  });
  async function connect(): Promise<void> {
    if (stopped) return;
    pc?.close();
    const p = new RTCPeerConnection({ iceServers: ICE });
    pc = p;
    const dc = p.createDataChannel('lobbers', { ordered: true });
    p.onicecandidate = (e) => { if (e.candidate) sig.send(hostId, { kind: 'ice', candidate: e.candidate.toJSON() }); };
    // ICE can stall without an error: abandon this attempt and retry.
    const stall = setTimeout(() => { if (pc === p && dc.readyState !== 'open') retry(); }, 6000);
    dc.onopen = () => { clearTimeout(stall); const link: ClientLink = { send: (m) => { if (dc.readyState === 'open') dc.send(JSON.stringify(m)); }, close: () => dc.close() }; client.attach(link); };
    dc.onmessage = (e) => client.receive(e.data);
    dc.onclose = () => { if (pc !== p) return; client.detach(); retry(); };
    const offer = await p.createOffer();
    await p.setLocalDescription(offer);
    sig.send(hostId, { kind: 'offer', sdp: offer.sdp! });
  }
  await connect();
  return { stop: () => { stopped = true; pc?.close(); } };
}
