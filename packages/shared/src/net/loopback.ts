import type { HostSession, PeerLink } from '../host/session.ts';
import type { ClientLink, PeerClient } from './client.ts';

/**
 * In-memory transport between a PeerClient and a HostSession. Messages are JSON-encoded and delivered
 * asynchronously (microtasks), exactly like a data channel. Uses:
 *  - the HOST's own UI (`local: true` binds it to the host seat),
 *  - hot-seat / offline play (Phase 1's LocalMatchController becomes HostSession + loopback),
 *  - unit tests (many peers in one process).
 */
export function connectLoopback(session: HostSession, client: PeerClient, opts: { local?: boolean } = {}): { drop(): void } {
  let open = true;
  let closing = false;
  const hostSide: PeerLink = {
    send: (msg) => { if (!open || closing) return; const s = JSON.stringify(msg); queueMicrotask(() => { if (open) client.receive(s); }); },
    // Like a data channel: messages already sent (e.g. `closed {reason}`) are delivered before the close.
    close: () => { if (!open || closing) return; closing = true; queueMicrotask(() => { open = false; client.detach(); }); },
  };
  const clientSide: ClientLink = {
    send: (msg) => { if (!open) return; const s = JSON.stringify(msg); queueMicrotask(() => { if (open) session.receive(hostSide, s); }); },
    close: () => drop(),
  };
  const drop = (): void => {
    if (!open) return;
    open = false;
    session.disconnect(hostSide);
    client.detach();
  };
  if (opts.local) session.connectLocal(hostSide); else session.connect(hostSide);
  client.attach(clientSide);
  return { drop };
}
