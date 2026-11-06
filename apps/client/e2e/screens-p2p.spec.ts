// Screens changed by the P2P migration (DESIGN_SPEC §2.1–2.8, §3.7–3.9) at 1440×900, compared with
// design/screenshots (mean pixel difference recorded; names/levels/currency differ from the mockup's demo data).
import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { diffPercent, repo, shotsDir } from './helpers';
import { createRoom, joinByCode, newPlayer, type Player } from './online';

const report: Record<string, number> = {};
const ref = (f: string): string => `${repo}design/screenshots/${f}`;

async function shoot(page: Page, name: string, refFile: string): Promise<void> {
  await page.waitForTimeout(900); // let entrance animations settle
  const png = await page.screenshot({ path: `${shotsDir('p2p')}/${name}.png` });
  report[name] = Math.round((await diffPercent(page, png, ref(refFile))) * 10) / 10;
  writeFileSync(`${shotsDir('p2p')}/screens-report.json`, JSON.stringify(report, null, 2));
}

test('first run, Home, Hot Seat, Create/Join Room, Settings (save data)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Pick your lobber name' })).toBeVisible();
  await shoot(page, 'first-run', '01-home.png');
  await page.getByPlaceholder('Kaboomerang').fill('Kaboomerang');
  await page.getByRole('button', { name: "LET'S LOB" }).click();
  await shoot(page, 'home', '01-home.png');
  await page.getByRole('button', { name: /Hot Seat/ }).click();
  await shoot(page, 'home-hot-seat', '01b-home-quick-match.png');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Create Room' }).click();
  await shoot(page, 'home-create-room', '01c-home-create-room.png');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Join Room' }).click();
  await shoot(page, 'home-join-room', '01c-home-create-room.png');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('connection-mode')).toHaveText(/Connection: (STUN only|TURN configured)/);
  await page.getByRole('button', { name: 'Export save' }).click();
  await shoot(page, 'home-settings-export', '01-home.png');
  await ctx.close();
});

test('lobby (host + guest views), invite, host close confirm, room-closed card, machine select', async ({ browser }) => {
  test.setTimeout(240_000);
  const players: Player[] = [];
  for (const name of ['Kaboomerang', 'PicklePounder', 'Mara.Vex', 'FrostedFlakes', 'Tidecaller', 'nightowl_ph']) players.push(await newPlayer(browser, name));
  const [me, guest] = players;
  const code = await createRoom(me);
  for (const p of players.slice(1)) await joinByCode(p, code);
  await expect(me.page.getByTestId('player-count')).toHaveText('6/8');
  await expect(me.page.getByTestId('link-status')).toHaveText('You are hosting');
  await expect(guest.page.getByTestId('link-status')).toHaveText(/P2P · \d+ ms/);
  await players[1].page.getByRole('button', { name: 'READY UP' }).click();
  await players[3].page.getByRole('button', { name: 'READY UP' }).click();
  await me.page.getByPlaceholder('Say something to the lobby…').fill('host pls Cobalt, wind is fair there');
  await me.page.keyboard.press('Enter');
  await shoot(me.page, 'lobby-host', '02-lobby.png');
  await shoot(guest.page, 'lobby-guest', '02-lobby.png');
  await me.page.getByRole('button', { name: 'Open slot' }).first().click();
  await shoot(me.page, 'lobby-invite', '02b-lobby-invite-slot.png');
  await me.page.getByRole('button', { name: 'Close' }).click();
  await guest.page.getByRole('link', { name: 'Change Machine' }).click();
  await guest.page.waitForURL(/\/machine$/);
  await guest.page.keyboard.press('3');
  await shoot(guest.page, 'machine-select', '03b-machine-select-mollusk.png');
  await me.page.getByRole('button', { name: 'Leave' }).click();
  await expect(me.page.getByRole('dialog', { name: 'Close the room for everyone?' })).toBeVisible();
  await shoot(me.page, 'lobby-host-close-confirm', '02-lobby.png');
  await me.page.getByRole('button', { name: 'CLOSE ROOM' }).click();
  await expect(players[2].page.getByTestId('closed-reason')).toHaveText('The host closed the room');
  await shoot(players[2].page, 'closed-card', '02-lobby.png');
  for (const p of players) await p.ctx.close();
});

test('wrong code → "Room not found" card', async ({ browser }) => {
  const p = await newPlayer(browser, 'Lost.Soul');
  await joinByCode(p, 'LOB-ZZZZ').catch(() => undefined);
  await expect(p.page.getByTestId('closed-reason')).toHaveText('Room not found', { timeout: 30_000 });
  await p.ctx.close();
});
