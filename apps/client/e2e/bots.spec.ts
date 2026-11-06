// Bots (DESIGN_SPEC §3.11): the host fills open lobby slots with bots that play through the real host engine, and
// Hot Seat seats can be bots (solo practice). Online part needs the local PeerServer (see multiplayer.spec.ts).
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { expectNoErrors, probe, shotsDir, waitForMyTurn } from './helpers';
import { createRoom, expectSynced, hostSetsWindOff, joinByCode, newPlayer, playTurn, settled, startMatch } from './online';

const OUT = shotsDir('bots');
test.describe.configure({ mode: 'serial' });

test('online: host adds bots to both teams, guest sees them, 2v2 with bots played to victory', async ({ browser }) => {
  test.setTimeout(900_000);
  const host = await newPlayer(browser, 'Hosty');
  const guest = await newPlayer(browser, 'Guesty');
  const code = await createRoom(host);
  await joinByCode(guest, code);
  // Guests can't add bots; the host can.
  await expect(guest.page.getByTestId('add-bot-red')).toHaveCount(0);
  await host.page.getByTestId('add-bot-red').first().click();
  await host.page.getByTestId('add-bot-blue').first().click();
  for (const p of [host, guest]) await expect(p.page.getByTestId('player-count')).toHaveText('4/8');
  // Difficulty: Normal → Hard on the red bot; everyone sees it.
  const redBot = host.page.locator('section[aria-label="Team Red"] [data-testid^="bot-difficulty-"]');
  await expect(redBot).toHaveText('NORMAL');
  await redBot.click();
  await expect(redBot).toHaveText('HARD');
  await expect(guest.page.locator('section[aria-label="Team Red"]').getByText('HARD')).toBeVisible();
  await expect(guest.page.locator('section[aria-label="Team Blue"]').getByText('BOT', { exact: true })).toBeVisible();
  await expect(host.page.getByTestId('ready-info')).not.toHaveText(/3 not ready/);
  await host.page.screenshot({ path: `${OUT}/lobby-host.png` });
  await guest.page.screenshot({ path: `${OUT}/lobby-guest.png` });

  await hostSetsWindOff(host);
  await startMatch([host, guest]);
  const players = [host, guest];
  let turns = 0, botShot = false;
  for (; turns < 120; turns++) {
    const s = await settled(players, 60_000);
    expectSynced(s);
    if (s[0].result !== null) break;
    if (!botShot && s[0].turn > 2) { await host.page.screenshot({ path: `${OUT}/battle.png` }); botShot = true; }
    await playTurn(players);
    await host.page.waitForTimeout(400);
  }
  const final = await settled(players, 60_000);
  expectSynced(final);
  expect(final[0].result === 'red' || final[0].result === 'blue').toBe(true);
  // Bots took real turns: more turns resolved than the two humans played.
  expect(final[0].turn).toBeGreaterThan(turns);
  await host.page.getByRole('button', { name: 'SEE RESULTS' }).click();
  await host.page.waitForURL(/\/results\//);
  await expect(host.page.getByText(/Bot \w+/).first()).toBeVisible();
  await host.page.screenshot({ path: `${OUT}/results.png` });
  writeFileSync(`${OUT}/online-report.json`, JSON.stringify({ humanTurns: turns, totalTurns: final[0].turn, winner: final[0].result, hashChecks: final[0].hash.checks, mismatches: final[0].hash.mismatches }, null, 2));
  expectNoErrors([...host.errors, ...guest.errors]);
  await host.ctx.close(); await guest.ctx.close();
});

test('hot seat: one player vs two bots, set up in the Hot Seat modal, played to the end', async ({ browser }) => {
  test.setTimeout(600_000);
  const me = await newPlayer(browser, 'Solo');
  const page = me.page;
  await page.getByRole('button', { name: /Hot Seat/ }).click();
  await page.getByRole('button', { name: 'Remove a Red player' }).click();
  await page.getByTestId('seat-kind-blue-0').click();                     // Player → Easy
  for (let i = 0; i < 2; i++) await page.getByTestId('seat-kind-blue-1').click();   // → Normal
  await expect(page.getByTestId('seat-kind-blue-0')).toContainText('EASY');
  await expect(page.getByTestId('seat-kind-blue-1')).toContainText('NORMAL');
  await page.screenshot({ path: `${OUT}/hotseat-modal.png` });
  await page.getByTestId('start-hotseat').click();
  await page.waitForURL(/\/hotseat\?.*bb=easy%2Cnormal/);
  let turns = 0;
  while (await waitForMyTurn(page, 90_000)) {
    turns++;
    if (turns === 1) await expect(page.getByText('YOUR TURN').first()).toBeVisible();
    await page.evaluate(() => (window as unknown as { __lobbersDev: { aimAtNearest(): boolean } }).__lobbersDev.aimAtNearest());
    await page.keyboard.press('Space');
    const t = (await probe(page)).turn;
    await page.waitForFunction((n) => { const p = (window as unknown as { __lobbers: { turn: number; result: string | null } }).__lobbers; return p.turn > n || p.result !== null; }, t, { timeout: 60_000 });
    if (turns === 2) await page.screenshot({ path: `${OUT}/hotseat-battle.png` });
    expect(turns).toBeLessThan(80);
  }
  const p = await probe(page);
  expect(['red', 'blue', 'draw']).toContain(p.result);
  expect(p.hash.mismatches).toBe(0);
  expect(p.turn).toBeGreaterThan(turns);   // the bots played their turns
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/hotseat-end.png` });
  expectNoErrors(me.errors);
  await me.ctx.close();
});
