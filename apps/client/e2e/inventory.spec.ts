// Inventory (Phase 4): screenshot vs design/screenshots/07-inventory.png, buy a machine with coins, equip /
// unequip, everything persisted in localStorage.
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createProfile, PROFILE_KEY, type LocalProfile } from '@lobbers/shared';
import { diffPercent, expectNoErrors, shotsDir } from './helpers';
import { watchErrors } from './online';

const repo = new URL('../../../', import.meta.url).pathname;
const report: Record<string, number> = {};

async function seed(page: Page, patch: Partial<LocalProfile>): Promise<void> {
  await page.goto('/');
  const base = createProfile('Kaboomerang', 'u-inv', Date.now());
  const p = { ...base, ...patch };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PROFILE_KEY, JSON.stringify(p)]);
}
const saved = (page: Page): Promise<LocalProfile> => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as LocalProfile, PROFILE_KEY);

test('inventory matches 07-inventory: Machine Skins, Arctic Camo Thumper equipped', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  const base = createProfile('Kaboomerang', 'u-inv', 0);
  await seed(page, { coins: 12480, gems: 260, owned: [...base.owned, 's-arctic', 's-ash', 's-neon'], equipped: { ...base.equipped, 'skin:thumper': 's-arctic' } });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Machine Skins' })).toBeVisible();
  await expect(page.getByTestId('inv-coins')).toHaveText('12,480');
  await expect(page.getByTestId('item-action')).toHaveText('EQUIPPED');
  await page.waitForTimeout(700);
  const png = await page.screenshot({ path: `${shotsDir('phase-4')}/inventory.png` });
  report.inventory = Math.round((await diffPercent(page, png, `${repo}design/screenshots/07-inventory.png`)) * 10) / 10;
  // 07b: Explosion Effects.
  await page.getByRole('button', { name: /Explosion Effects/ }).click();
  await page.waitForTimeout(500);
  const png2 = await page.screenshot({ path: `${shotsDir('phase-4')}/inventory-explosions.png` });
  report['inventory-explosions'] = Math.round((await diffPercent(page, png2, `${repo}design/screenshots/07b-inventory-explosions.png`)) * 10) / 10;
  writeFileSync(`${shotsDir('phase-4')}/inventory-report.json`, JSON.stringify(report, null, 2));
  expectNoErrors(errors);
});

test('buy Frostbite with coins, equip it, equip and unequip a trail; all saved', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  const base = createProfile('Buyer', 'u-buy', 0);
  await seed(page, { coins: 6500, owned: [...base.owned, 't-rainbow'] });
  await page.goto('/inventory?cat=0');
  await page.getByRole('button', { name: /^Frostbite, Epic, locked/ }).click();
  await expect(page.getByTestId('item-source')).toHaveText('Unlock: 6,000 coins');
  await page.getByTestId('item-action').click();
  await expect(page.getByRole('status')).toHaveText('Unlocked Frostbite!');
  await expect(page.getByTestId('inv-coins')).toHaveText('500');
  await expect(page.getByTestId('item-action')).toHaveText('EQUIP');
  await page.getByTestId('item-action').click();
  await expect(page.getByTestId('item-action')).toHaveText('EQUIPPED');
  // Locked by a requirement: progress shown, button disabled.
  await page.getByRole('button', { name: /^Whirligig, Rare, locked/ }).click();
  await expect(page.getByTestId('item-source')).toHaveText('Unlock: Reach level 40 (1 / 40)');
  await expect(page.getByTestId('item-action')).toBeDisabled();
  // Trails: equip Rainbow, then Unequip falls back to the default trail.
  await page.getByRole('button', { name: /Projectile Trails/ }).click();
  await page.getByRole('button', { name: /^Rainbow/ }).click();
  await page.getByTestId('item-action').click();
  expect((await saved(page)).equipped.trail).toBe('t-rainbow');
  await page.getByRole('button', { name: 'Unequip' }).click();
  expect((await saved(page)).equipped.trail).toBe('t-smoke');
  await page.reload();
  const p = await saved(page);
  expect(p.owned).toContain('machine:frostbite');
  expect(p.favoriteMachine).toBe('frostbite');
  expect(p.coins).toBe(500);
  expectNoErrors(errors);
});
