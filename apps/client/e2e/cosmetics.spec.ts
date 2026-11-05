// Phase 3: cosmetics in a real (hot-seat) match — skins, trails, explosion styles, weapon-skin shells
// and emote bubbles, captured mid-flight and on impact for every preset.
import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, shotsDir, waitForMyTurn } from './helpers';
import { watchErrors } from './online';

const PRESETS = ['embers', 'bubbles', 'pixel', 'rainbow', 'stars'] as const;

async function fireAndCapture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => (window as unknown as { __lobbersDev: { aimAtNearest(): boolean } }).__lobbersDev.aimAtNearest());
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${shotsDir('phase-3')}/${name}-flight.png` });
  // The camera holds on the impact: capture the explosion layers mid-animation.
  await page.waitForFunction(() => (window as unknown as { __lobbersCam?: { mode: string } }).__lobbersCam?.mode === 'hold', null, { timeout: 20_000, polling: 16 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${shotsDir('phase-3')}/${name}-impact.png` });
}

for (const [i, look] of PRESETS.entries()) {
  test(`cosmetics preset "${look}": skins, trail, explosion, emote bubble`, async ({ page }) => {
    const errors: string[] = [];
    watchErrors(page, errors);
    await page.setViewportSize({ width: 1440, height: 900 });
    const machines = ['thumper,mollusk', 'sprocket,cinder', 'voltaic,boomba', 'mollusk,thumper', 'boomba,sprocket'][i];
    await page.goto(`/match/local?map=cobalt&red=${machines}&blue=${machines}&wind=off&turn=45&seed=${3 + i}&rl=${look}&bl=${look}`);
    expect(await waitForMyTurn(page)).toBe(true);
    await page.keyboard.press('t');
    await expect(page.getByRole('dialog', { name: 'Emotes' })).toBeVisible();
    await page.keyboard.press('2');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${shotsDir('phase-3')}/${look}-emote.png` });
    await fireAndCapture(page, look);
    expectNoErrors(errors);
  });
}

test('Items On lists all 10 weapons in the Armory; Items Off lists the loadout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/match/local?map=cobalt&red=thumper&blue=mollusk&wind=off&items=1');
  expect(await waitForMyTurn(page)).toBe(true);
  await page.keyboard.press('w');
  await expect(page.getByText('Items: On — full arsenal this match')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Armory' }).locator('button[title]')).toHaveCount(10);
  await page.screenshot({ path: `${shotsDir('phase-3')}/armory-items-on.png` });
  await page.goto('/match/local?map=cobalt&red=thumper&blue=mollusk&wind=off&items=0');
  expect(await waitForMyTurn(page)).toBe(true);
  await page.keyboard.press('w');
  await expect(page.getByText('Items: Off — Thumper loadout')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Armory' }).locator('button[title]')).toHaveCount(5);
});

test('sound: unlocks on the first key press, battle music runs, a shot plays fire/whistle/explosion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/match/local?map=cobalt&red=thumper&blue=mollusk&wind=off&seed=5');
  expect(await waitForMyTurn(page)).toBe(true);
  const stats = (): Promise<{ state: string; sfx: number; musicSteps: number; track: string }> => page.evaluate(() => (window as unknown as { __lobbersAudio: () => { state: string; sfx: number; musicSteps: number; track: string } }).__lobbersAudio());
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(600);
  const before = await stats();
  expect(before.state).toBe('running');
  expect(before.track).toBe('battle');
  expect(before.musicSteps).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { __lobbersDev: { aimAtNearest(): boolean } }).__lobbersDev.aimAtNearest());
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as unknown as { __lobbersCam?: { mode: string } }).__lobbersCam?.mode === 'hold', null, { timeout: 20_000 });
  const after = await stats();
  expect(after.sfx - before.sfx).toBeGreaterThanOrEqual(3);
});
