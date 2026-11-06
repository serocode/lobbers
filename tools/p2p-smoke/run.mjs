// P2P smoke test: N real Chromium contexts play a full match over real WebRTC data channels.
// Also reloads one guest mid-match (rejoin by token) and refreshes the HOST mid-match (resume from localStorage).
// Usage: node tools/p2p-smoke/run.mjs [players=4] [map=cobalt]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const players = Number(process.argv[2] ?? 4);
const map = process.argv[3] ?? 'cobalt';
await build({ entryPoints: [path.join(here, 'page.ts')], bundle: true, format: 'iife', outfile: path.join(here, 'dist/app.js'), target: 'es2022', logLevel: 'warning' });
await import('node:fs').then((fs) => fs.copyFileSync(path.join(here, 'index.html'), path.join(here, 'dist/index.html')));
const srv = await startServer({ root: path.join(here, 'dist') });
const base = `http://localhost:${srv.port}/`;
const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const machines = ['thumper', 'mollusk', 'voltaic', 'cinder', 'sprocket', 'frostbite', 'boomba', 'whirligig'];
const pages = [];
const errors = [];
for (let i = 0; i < players; i++) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`p${i}: ${e.message}`));
  const role = i === 0 ? 'host' : 'guest';
  await page.goto(`${base}?role=${role}&players=${players}&map=${map}&name=Bot${i}&machine=${machines[i]}`);
  if (i === 0) await page.waitForFunction(() => window.__state?.().status === 'joined');
  pages.push(page);
}
const state = (p) => p.evaluate(() => window.__state());
const waitFor = async (fn, ms, what) => { const end = Date.now() + ms; for (;;) { if (await fn()) return; if (Date.now() > end) throw new Error('timeout: ' + what); await new Promise((r) => setTimeout(r, 250)); } };

const t0 = Date.now();
await waitFor(async () => (await state(pages[0])).phase === 'acting', 30_000, 'match start');
console.log(`match started over WebRTC after ${((Date.now() - t0) / 1000).toFixed(1)}s with ${players} browsers`);

// 1) guest reload mid-match → rejoins its seat with the saved token
await waitFor(async () => (await state(pages[0])).turn >= 3, 120_000, 'turn 3');
const g = pages[players - 1];
const gid = (await state(g)).id;
await g.reload();
await waitFor(async () => { const s = await state(g); return s.status === 'joined' && s.id === gid && s.phase !== null; }, 30_000, 'guest rejoin');
console.log('guest reloaded mid-match and got its seat back');

// 2) HOST refresh mid-match → HostSession.restore from localStorage, guests reconnect automatically
await waitFor(async () => (await state(pages[0])).turn >= 6 || (await state(pages[0])).ended, 180_000, 'turn 6');
if (!(await state(pages[0])).ended) {
  const before = (await state(pages[0])).hash;
  await pages[0].reload();
  await waitFor(async () => { const s = await state(pages[0]); return s.status === 'joined' && s.phase !== null && !s.paused; }, 40_000, 'host resume');
  const after = (await state(pages[0])).hash;
  console.log(`host refreshed mid-match and resumed (terrain hash ${before === after ? 'identical' : 'CHANGED'})`);
  if (before !== after) errors.push('host terrain changed across refresh');
}

await waitFor(async () => { const ss = await Promise.all(pages.map(state)); return ss.every((s) => s.ended); }, 480_000, 'match end');
const ss = await Promise.all(pages.map(state));
const res = JSON.stringify(ss[0].ended);
const allSame = ss.every((s) => JSON.stringify(s.ended) === res);
const desyncs = ss.reduce((n, s) => n + s.desyncs, 0);
const hashes = new Set(ss.map((s) => s.hash));
const rtts = ss.slice(1).flatMap((s) => s.rtt).sort((a, b) => a - b);
console.log(JSON.stringify({
  players, map, winner: ss[0].ended.winner, turns: ss[0].ended.turns, durationSec: Math.round((Date.now() - t0) / 1000),
  identicalResultOnAllPeers: allSame, terrainDesyncs: desyncs, finalTerrainHashes: hashes.size,
  rttMs: { p50: rtts[Math.floor(rtts.length / 2)], max: rtts.at(-1) }, credited: ss.map((s) => s.credited), pageErrors: errors,
}, null, 1));
await browser.close(); srv.close();
if (!allSame || desyncs || hashes.size !== 1 || errors.length) process.exit(1);
