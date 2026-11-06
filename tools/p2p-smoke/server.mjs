// Minimal static server + WebRTC signaling relay (stand-in for a PeerJS server) used only by the P2P smoke test.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

export function startServer({ root, port = 8790 }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
      res.end(data);
    });
  });
  const wss = new WebSocketServer({ server, path: '/signal' });
  const peers = new Map();
  wss.on('connection', (ws) => {
    let id = null;
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'register') {
        if (peers.has(m.id)) { ws.send(JSON.stringify({ type: 'id-taken' })); return; }
        id = m.id; peers.set(id, ws); ws.send(JSON.stringify({ type: 'registered', id }));
      } else if (m.type === 'signal' && id) {
        const dst = peers.get(m.to);
        if (dst) dst.send(JSON.stringify({ type: 'signal', from: id, data: m.data }));
        else ws.send(JSON.stringify({ type: 'unavailable', id: m.to }));
      }
    });
    ws.on('close', () => { if (id && peers.get(id) === ws) peers.delete(id); });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ close: () => { wss.close(); server.close(); }, port })));
}
