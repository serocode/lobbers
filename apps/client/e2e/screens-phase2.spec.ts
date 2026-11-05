// Phase 2 screens at 1440×900, compared with design/screenshots (mean pixel difference recorded).
// Mock names/levels/currency differ from the mockup's demo data, so the numbers are a layout check.
import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { diffPercent, repo, shotsDir } from './helpers';
import { createRoom, joinByCode, newPlayer, type Player } from './online';

const report: Record<string, number> = {};
const ref = (f: string): string => `${repo}design/screenshots/${f}`;

async function shoot(page: Page, name: string, refFile: string): Promise<void> {
  await page.waitForTimeout(900); // let entrance animations settle
  const png = await page.screenshot({ path: `${shotsDir('phase-2')}/${name}.png` });
  report[name] = Math.round((await diffPercent(page, png, ref(refFile))) * 10) / 10;
  writeFileSync(`${shotsDir('phase-2')}/screens-report.json`, JSON.stringify(report, null, 2));
}

test('home, modals, lobby, machine select, results', async ({ browser }) => {
  test.setTimeout(300_000);
  const players: Player[] = [];
  for (const name of ['Kaboomerang', 'PicklePounder', 'Mara.Vex', 'FrostedFlakes', 'Tidecaller', 'nightowl_ph']) players.push(await newPlayer(browser, name));
  const [me] = players;
  await shoot(me.page, 'home', '01-home.png');

  await me.page.getByRole('button', { name: 'Create Room' }).click();
  await shoot(me.page, 'home-create-room', '01c-home-create-room.png');
  await me.page.getByRole('button', { name: 'Close' }).click();
  await me.page.getByRole('button', { name: 'Join Room' }).click();
  await shoot(me.page, 'home-join-room', '01c-home-create-room.png');
  await me.page.getByRole('button', { name: 'Close' }).click();
  await me.page.getByRole('button', { name: 'Settings' }).click();
  await shoot(me.page, 'home-settings', '01-home.png');
  await me.page.getByRole('button', { name: 'Close' }).click();

  const code = await createRoom(me);
  for (const p of players.slice(1)) await joinByCode(p, code);
  await expect(me.page.getByTestId('player-count')).toHaveText('6/8');
  await players[1].page.getByRole('button', { name: 'READY UP' }).click();
  await players[3].page.getByRole('button', { name: 'READY UP' }).click();
  await me.page.getByPlaceholder('Say something to the lobby…').fill('host pls Cobalt, wind is fair there');
  await me.page.keyboard.press('Enter');
  await shoot(me.page, 'lobby', '02-lobby.png');
  await me.page.getByRole('button', { name: 'Open slot' }).first().click();
  await shoot(me.page, 'lobby-invite', '02b-lobby-invite-slot.png');
  await me.page.getByRole('button', { name: 'Close' }).click();

  await me.page.getByRole('link', { name: 'Change Machine' }).click();
  await me.page.waitForURL(/\/machine$/);
  await shoot(me.page, 'machine-select', '03-machine-select.png');
  await me.page.keyboard.press('3');
  await shoot(me.page, 'machine-select-mollusk', '03b-machine-select-mollusk.png');
  for (const p of players) await p.ctx.close();
});

test('quick match modal fills from a real public room', async ({ browser }) => {
  const a = await newPlayer(browser, 'QuickOne');
  const b = await newPlayer(browser, 'QuickTwo');
  await a.page.getByRole('button', { name: 'Quick Match' }).click();
  await expect(a.page.getByText('MATCH FOUND!')).toBeVisible();
  await b.page.getByRole('button', { name: 'Quick Match' }).click();
  await expect(b.page.getByText('MATCH FOUND!')).toBeVisible();
  await expect(a.page.getByText(/2 \/ 8 players/)).toBeVisible();
  await shoot(a.page, 'home-quick-match', '01b-home-quick-match.png');
  await b.page.getByRole('button', { name: 'Enter Lobby' }).click();
  await b.page.waitForURL(/\/lobby\//);
  await expect(b.page.getByTestId('player-count')).toHaveText('2/8');
  await a.ctx.close();
  await b.ctx.close();
});
