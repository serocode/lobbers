// Persistence (P2P migration, persistence step): the profile lives in localStorage. Reload keeps level/coins/history; empty,
// corrupt and blocked (setItem throws) storage all still start the game (first-run flow / banner).
import { expect, test } from '@playwright/test';
import { createProfile, PROFILE_KEY } from '@lobbers/shared';
import { expectNoErrors } from './helpers';
import { watchErrors } from './online';

test('reload keeps your level, coins and recent activity', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  await page.goto('/');
  const p = { ...createProfile('Saver', 'u-saver', Date.now()), level: 6, xp: 1200, coins: 2345 };
  p.history = [{ matchId: 'LOB-AAAA-1', endedAt: Date.now() - 60_000, mapId: 'ember', mode: 'team-deathmatch', team: 'red', won: true, draw: false, machine: 'thumper', damageDealt: 900, eliminations: 2, assists: 0, accuracy: 60, mvp: true, xp: 480, coins: 220, players: [] }];
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PROFILE_KEY, JSON.stringify(p)]);
  await page.reload();
  await expect(page.getByTestId('profile-level')).toHaveText('LV 6');
  await expect(page.getByTestId('profile-coins')).toHaveText('2,345');
  await expect(page.getByText('Victory on Ember Basin')).toBeVisible();
  await expect(page.getByTestId('storage-banner')).toHaveCount(0);
  expectNoErrors(errors);
});

test('empty storage → first-run modal → profile saved', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Kaboomerang').fill('Fresh.One');
  await page.getByRole('button', { name: "LET'S LOB" }).click();
  await expect(page.getByTestId('profile-level')).toHaveText('LV 1');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as { name: string } | null, PROFILE_KEY);
  expect(saved?.name).toBe('Fresh.One');
});

test('corrupt save → quarantined, first-run modal shows again', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"id":'), PROFILE_KEY);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Pick your lobber name' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(`${k}:corrupt`), PROFILE_KEY)).toBe('{"v":1,"id":');
});

test('blocked storage (setItem throws) → still playable, banner warns', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.goto('/');
  await page.getByPlaceholder('Kaboomerang').fill('Privateer');
  await page.getByRole('button', { name: "LET'S LOB" }).click();
  await expect(page.getByTestId('storage-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: /PLAY NOW/ })).toBeEnabled();
  expectNoErrors(errors);
});

test('export save → import in another browser restores the same player (id, level, coins)', async ({ browser }) => {
  const a = await browser.newContext(); const pa = await a.newPage();
  await pa.goto('/');
  const p = { ...createProfile('Mover', 'u-mover', Date.now()), level: 9, xp: 3000, coins: 4321 };
  await pa.evaluate(([k, v]) => localStorage.setItem(k, v), [PROFILE_KEY, JSON.stringify(p)]);
  await pa.reload();
  await pa.getByRole('button', { name: 'Settings' }).click();
  await pa.getByRole('button', { name: 'Export save' }).click();
  const code = await pa.getByLabel('Save code').inputValue();
  expect(code).toMatch(/^LOBBERS1:/);

  const b = await browser.newContext(); const pb = await b.newPage();
  const errors: string[] = []; watchErrors(pb, errors);
  await pb.goto('/');
  await pb.getByRole('button', { name: 'I have a save code' }).click();
  await pb.getByLabel('Paste your save code').fill(code);
  await pb.getByRole('button', { name: 'Import save' }).click();
  await expect(pb.getByTestId('profile-level')).toHaveText('LV 9');
  await expect(pb.getByTestId('profile-coins')).toHaveText('4,321');
  const saved = await pb.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as { id: string } | null, PROFILE_KEY);
  expect(saved?.id).toBe('u-mover');
  expectNoErrors(errors);
  await a.close(); await b.close();
});
