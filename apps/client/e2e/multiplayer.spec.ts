// Multiplayer E2E (skill `multiplayer-e2e`), peer-to-peer: one browser context per player (separate
// localStorage = separate profile), the host's tab runs the room, players connect over WebRTC through a local
// PeerServer:  pnpm peer:local  ·  apps/client/.env.local VITE_PEER_HOST=localhost … ·  pnpm dev:client
import { expect, test, type Browser } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expectNoErrors, shotsDir } from './helpers';
import {
  createRoom, expectSynced, hostSetsWindOff, joinByCode, newPlayer, playTurn, settled, snap, startMatch, type Player,
} from './online';

test.describe.configure({ mode: 'serial' });

async function room(browser: Browser, n: number): Promise<{ players: Player[]; code: string }> {
  const players: Player[] = [];
  for (let i = 0; i < n; i++) players.push(await newPlayer(browser, `Lobber${i + 1}`));
  const code = await createRoom(players[0]);
  for (const p of players.slice(1)) await joinByCode(p, code);
  for (const p of players) await expect(p.page.getByTestId('player-count')).toHaveText(`${n}/8`);
  return { players, code };
}

async function close(players: Player[]): Promise<void> { for (const p of players) await p.ctx.close(); }

async function playToVictory(players: Player[], maxTurns: number): Promise<{ turns: number; checks: number }> {
  let turns = 0;
  for (; turns < maxTurns; turns++) {
    const s = await settled(players);
    expectSynced(s);
    if (s[0].result !== null) break;
    await playTurn(players);
    await players[0].page.waitForTimeout(400);
  }
  const final = await settled(players);
  expectSynced(final);
  return { turns, checks: final[0].hash.checks };
}

const report: Record<string, { players: number; turns: number; hashChecks: number; mismatches: number; winner: string | null; seconds: number }> = {};

for (const n of [1, 2, 3, 4]) {
  test(`${n}v${n}: lobby → match to victory, identical outcomes on every client`, async ({ browser }) => {
    test.setTimeout(900_000);
    const t0 = Date.now();
    const { players } = await room(browser, n * 2);
    await hostSetsWindOff(players[0]);
    await startMatch(players);
    const r = await playToVictory(players, 120);
    const s = await Promise.all(players.map(snap));
    expect(s[0].result === 'red' || s[0].result === 'blue').toBe(true);
    expect(r.checks).toBeGreaterThan(r.turns);
    report[`${n}v${n}`] = { players: n * 2, turns: r.turns, hashChecks: r.checks, mismatches: s.reduce((a, x) => a + x.hash.mismatches, 0), winner: s[0].result, seconds: Math.round((Date.now() - t0) / 1000) };
    if (n === 2) {
      // Two contexts side by side at the end of the match (PROGRESS evidence).
      await players[0].page.screenshot({ path: `${shotsDir('phase-2')}/sync-2v2-a.png` });
      await players[3].page.screenshot({ path: `${shotsDir('phase-2')}/sync-2v2-b.png` });
    }
    await players[0].page.getByRole('button', { name: 'SEE RESULTS' }).click();
    await players[0].page.waitForURL(/\/results\//);
    await expect(players[0].page.getByText('Player Rankings')).toBeVisible();
    if (n === 2) {
      await players[0].page.waitForTimeout(2200);
      await players[0].page.screenshot({ path: `${shotsDir('phase-2')}/results.png` });
      await players[0].page.getByRole('button', { name: 'View Match Details' }).click();
      await players[0].page.waitForTimeout(900);
      await players[0].page.screenshot({ path: `${shotsDir('phase-2')}/results-details.png` });
      await players[0].page.getByRole('button', { name: 'Close' }).click();
      await players[0].page.getByRole('button', { name: 'Return to Lobby' }).click();
      await players[0].page.waitForURL(/\/lobby\/LOB-/);
      await expect(players[0].page.getByTestId('player-count')).toHaveText('4/8');
      // Rewards were credited to the host's own local profile (creditMatch) — Home shows them after the host closes
      // the room (a reload instead would resume the still-open hosted room, by design).
      await players[0].page.getByRole('button', { name: 'Leave' }).click();
      await players[0].page.getByRole('button', { name: 'CLOSE ROOM' }).click();
      await players[0].page.waitForURL((u) => u.pathname === '/');
      await expect(players[0].page.getByTestId('profile-coins')).not.toHaveText('500');
    }
    for (const p of players) expectNoErrors(p.errors);
    const file = `${shotsDir('phase-2')}/matrix-report.json`;
    const prev = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as typeof report) : {};
    writeFileSync(file, JSON.stringify({ ...prev, ...report }, null, 2));
    await close(players);
  });
}

test('lobby validation: team limit, host-only start, ready gating, 9th player refused', async ({ browser }) => {
  test.setTimeout(240_000);
  const { players, code } = await room(browser, 8);
  const [host, guest] = players;
  await expect(guest.page.getByRole('button', { name: 'START MATCH' })).toBeDisabled();
  await expect(host.page.getByRole('button', { name: 'START MATCH' })).toBeDisabled();
  await expect(host.page.getByTestId('ready-info')).toHaveText('7 not ready');
  await guest.page.getByRole('button', { name: /Switch to/ }).click();
  await expect(guest.page.getByRole('alert')).toContainText('Team full');
  const ninth = await newPlayer(browser, 'Lobber9');
  await ninth.page.getByRole('button', { name: 'Join Room' }).click();
  await ninth.page.getByPlaceholder('LOB-XXXX').fill(code);
  await ninth.page.getByRole('button', { name: `Join ${code}` }).click();
  await expect(ninth.page.getByTestId('closed-reason')).toHaveText('Room is full', { timeout: 20_000 });
  await close([...players, ninth]);
});

test('host leaves the lobby: the room closes for everyone (no host transfer in P2P)', async ({ browser }) => {
  const { players } = await room(browser, 3);
  const [host, second, third] = players;
  await host.page.getByRole('button', { name: 'Leave' }).click();
  await host.page.getByRole('button', { name: 'CLOSE ROOM' }).click();
  await host.page.waitForURL((u) => u.pathname === '/');
  await expect(second.page.getByTestId('closed-reason')).toHaveText('The host closed the room');
  await expect(third.page.getByTestId('closed-reason')).toHaveText('The host closed the room');
  await close(players);
});

test('host refreshes mid-match: the room resumes from localStorage, guests reconnect, the match finishes in sync', async ({ browser }) => {
  test.setTimeout(600_000);
  const { players } = await room(browser, 4);
  await hostSetsWindOff(players[0]);
  const matchId = await startMatch(players);
  for (let i = 0; i < 3; i++) { expectSynced(await settled(players)); await playTurn(players); await players[0].page.waitForTimeout(400); }
  const before = await settled(players);
  expectSynced(before);
  await players[0].page.reload();
  // Guests lost the host → "Reconnecting…" scrim (DESIGN_SPEC §3.8); once back, the restored host may still be paused for
  // the other guests → "Host reconnecting…" in the turn panel (often too brief to catch; captured when it shows).
  await expect(players[1].page.getByRole('alertdialog', { name: 'Reconnecting' })).toBeVisible({ timeout: 30_000 });
  await players[1].page.screenshot({ path: `${shotsDir('p2p')}/battle-guest-lost-host.png` });
  const pill = players.slice(1).map((p) => p.page.getByText('Host reconnecting…').first());
  for (let t = 0; t < 60; t++) {
    const i = (await Promise.all(pill.map((l) => l.isVisible()))).findIndex(Boolean);
    if (i >= 0) { await players[i + 1].page.screenshot({ path: `${shotsDir('p2p')}/battle-host-reconnecting.png` }); break; }
    await players[1].page.waitForTimeout(100);
  }
  await players[0].page.waitForURL(new RegExp(`/match/${matchId}`));
  await players[0].page.waitForFunction(() => !!(window as unknown as { __lobbersDev?: unknown }).__lobbersDev, null, { timeout: 40_000 });
  const after = await settled(players, 60_000);
  expectSynced(after);
  expect(after[0].hash.server).toBe(before[0].hash.server);
  expect(after[0].units).toEqual(before[0].units);
  const r = await playToVictory(players, 120);
  expect(r.checks).toBeGreaterThan(0);
  for (const p of players) expectNoErrors(p.errors);
  await close(players);
});

test('out-of-turn + forged intents are rejected; disconnect skips, reconnect resumes with a snapshot, staying away forfeits', async ({ browser }) => {
  test.setTimeout(300_000);
  const { players } = await room(browser, 4);
  await hostSetsWindOff(players[0]);
  const matchId = await startMatch(players);
  let s = await settled(players);
  const idle = players[s.findIndex((x) => !x.mine)];
  const before = await snap(idle);
  await idle.page.evaluate(() => (window as unknown as { __lobbersDev: { sendRaw(i: object): void } }).__lobbersDev.sendRaw({ t: 'fire', aim: { angle: 45, power: 80, weaponId: 'heavy-bomb' } }));
  await expect(idle.page.getByRole('alert')).toContainText('not your turn');
  // Forged / malformed messages never reach the simulation: the host's codec drops them.
  await idle.page.evaluate(() => (window as unknown as { __lobbersDev: { sendRaw(i: object): void } }).__lobbersDev.sendRaw({ t: 'fire', aim: { angle: 45, power: 80, weaponId: 'laser' } }));
  await idle.page.evaluate(() => (window as unknown as { __lobbersDev: { sendRaw(i: object): void } }).__lobbersDev.sendRaw({ t: 'damage', unitId: 'red-0', amount: 9999 }));
  await idle.page.waitForTimeout(500);
  expect((await snap(idle)).units).toEqual(before.units);

  // Active GUEST drops (the host dropping is the refresh case above): their turn ends at once, others see the badge.
  while (s.findIndex((x) => x.mine) === 0) {
    await players[0].page.evaluate(() => (window as unknown as { __lobbersDev: { sendRaw(i: object): void } }).__lobbersDev.sendRaw({ t: 'skipTurn' }));
    await players[0].page.waitForTimeout(500);
    s = await settled(players);
  }
  const activeIdx = s.findIndex((x) => x.mine);
  const dropped = players[activeIdx];
  const others = players.filter((p) => p !== dropped);
  await dropped.page.close();
  await others[0].page.waitForFunction(() => (window as unknown as { __lobbersDev: { debug(): { offline: string[] } } }).__lobbersDev.debug().offline.length === 1, null, { timeout: 30_000 });
  await expect(others[0].page.getByLabel('Disconnected').first()).toBeVisible();
  s = await settled(others);
  expect(s[0].active).not.toBe(before.active);

  // Reopen within the window (same storage): same seat, full snapshot, hashes match.
  dropped.page = await dropped.ctx.newPage();
  await dropped.page.goto(`/match/${matchId}`);
  await dropped.page.waitForFunction(() => !!(window as unknown as { __lobbersDev?: unknown }).__lobbersDev, null, { timeout: 20_000 });
  await others[0].page.waitForFunction(() => (window as unknown as { __lobbersDev: { debug(): { offline: string[] } } }).__lobbersDev.debug().offline.length === 0, null, { timeout: 40_000 });
  s = await settled(players);
  expectSynced(s);

  // Someone stays away past the window → forfeits (unit eliminated, logged).
  const quitter = players.find((p) => p !== dropped && p !== players[0]) ?? players[1];
  const rest = players.filter((p) => p !== quitter);
  await quitter.ctx.close();
  await rest[0].page.waitForFunction(() => {
    const d = (window as unknown as { __lobbersDev: { debug(): { units: Array<{ alive: boolean }> } } }).__lobbersDev.debug();
    return d.units.some((u) => !u.alive);
  }, null, { timeout: 120_000 });
  await expect(rest[0].page.getByText(/forfeited/).first()).toBeVisible();
  await close(rest);
});
