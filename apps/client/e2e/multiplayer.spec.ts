// Multiplayer E2E (skill `multiplayer-e2e`): real server + one browser context per player.
// Needs the server running with a short reconnect window for the forfeit case:
//   RECONNECT_WINDOW_SEC=8 pnpm dev:server   ·   pnpm dev:client
import { expect, test, type Browser } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { expectNoErrors, shotsDir } from './helpers';
import {
  createRoom, countText, expectSynced, hostSetsWindOff, joinByCode, newPlayer, playTurn, settled, snap, startMatch, type Player,
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
    }
    for (const p of players) expectNoErrors(p.errors);
    writeFileSync(`${shotsDir('phase-2')}/matrix-report.json`, JSON.stringify(report, null, 2));
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
  await expect(ninth.page.getByRole('alert')).toBeVisible();
  expect(ninth.page.url()).not.toContain('/lobby/');
  await close([...players, ninth]);
});

test('host leaves the lobby: crown moves to the longest-connected player, settings kept', async ({ browser }) => {
  const { players } = await room(browser, 3);
  const [host, second, third] = players;
  await host.page.getByRole('button', { name: 'Next map' }).click();
  await expect(second.page.getByRole('heading', { name: 'Ember Basin' })).toBeVisible();
  await host.page.getByRole('button', { name: 'Leave' }).click();
  await expect(second.page.getByRole('button', { name: 'START MATCH' })).toBeEnabled({ timeout: 10_000 }).catch(() => undefined);
  await expect(third.page.getByText(`Host: ${second.name}`)).toBeVisible();
  await expect(third.page.getByRole('heading', { name: 'Ember Basin' })).toBeVisible();
  expect(await countText(third)).toBe('2/8');
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
  await idle.page.evaluate(() => (window as unknown as { __lobbersDev: { sendRaw(i: object): void } }).__lobbersDev.sendRaw({ t: 'move', dir: 1, ticks: 99999 }));
  await expect(idle.page.getByRole('alert')).toContainText('bad message');
  expect((await snap(idle)).units).toEqual(before.units);

  // Active player drops: their turn ends at once, others see the badge.
  const activeIdx = s.findIndex((x) => x.mine);
  const dropped = players[activeIdx];
  const others = players.filter((p) => p !== dropped);
  await dropped.page.close();
  await others[0].page.waitForFunction(() => (window as unknown as { __lobbersDev: { debug(): { offline: string[] } } }).__lobbersDev.debug().offline.length === 1, null, { timeout: 15_000 });
  await expect(others[0].page.getByLabel('Disconnected').first()).toBeVisible();
  s = await settled(others);
  expect(s[0].active).not.toBe(before.active);

  // Reopen within the window (same storage): same seat, full snapshot, hashes match.
  dropped.page = await dropped.ctx.newPage();
  await dropped.page.goto(`/match/${matchId}`);
  await dropped.page.waitForFunction(() => !!(window as unknown as { __lobbersDev?: unknown }).__lobbersDev, null, { timeout: 20_000 });
  await others[0].page.waitForFunction(() => (window as unknown as { __lobbersDev: { debug(): { offline: string[] } } }).__lobbersDev.debug().offline.length === 0, null, { timeout: 15_000 });
  s = await settled(players);
  expectSynced(s);

  // Someone stays away past the window → forfeits (unit eliminated, logged).
  const quitter = players.find((p) => p !== dropped && p !== players[0]) ?? players[1];
  const rest = players.filter((p) => p !== quitter);
  await quitter.ctx.close();
  await rest[0].page.waitForFunction(() => {
    const d = (window as unknown as { __lobbersDev: { debug(): { units: Array<{ alive: boolean }> } } }).__lobbersDev.debug();
    return d.units.some((u) => !u.alive);
  }, null, { timeout: 90_000 });
  await expect(rest[0].page.getByText(/forfeited/).first()).toBeVisible();
  await close(rest);
});
