// Phones in landscape (owner report: Galaxy A54 too small). A54 Chrome ≈ 915×360 CSS px with the browser bar,
// 915×412 fullscreen, DPR 2.625, touch. Menus fit the width and scroll; the battle uses the phone layout.
import { expect, test, type Browser } from '@playwright/test';
import { expectNoErrors, shotsDir, waitForMyTurn } from './helpers';
import { watchErrors } from './online';

const scaleOf = async (page: import('@playwright/test').Page): Promise<{ scale: number; scroll: boolean }> =>
  page.locator('[data-stage-scale]').first().evaluate((el) => ({ scale: Number(el.getAttribute('data-stage-scale')), scroll: el.hasAttribute('data-stage-scroll') }));

async function phone(browser: Browser, height: number): Promise<{ page: import('@playwright/test').Page; close: () => Promise<void>; errors: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 915, height }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = []; watchErrors(page, errors);
  return { page, close: () => ctx.close(), errors };
}

for (const height of [360, 412]) {
  test(`A54 landscape ${height === 360 ? 'with browser bar' : 'fullscreen'} (915×${height}): menus readable, battle uses the phone layout`, async ({ browser }) => {
    const { page, close, errors } = await phone(browser, height);
    await page.goto('/');
    await page.getByPlaceholder('Kaboomerang').fill('Pocket');
    await page.getByRole('button', { name: "LET'S LOB" }).click();
    await expect(page.getByRole('button', { name: /PLAY NOW/ })).toBeEnabled();
    const home = await scaleOf(page);
    expect(home.scroll).toBe(true);
    expect(home.scale).toBeGreaterThan(0.6);            // was min(915/1440, h/900) ≈ 0.40 / 0.46
    await page.screenshot({ path: `${shotsDir('mobile')}/a54-${height}-home.png` });
    // The bottom of the Home stage is reachable by scrolling.
    await page.getByRole('button', { name: 'Join Room' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeInViewport();

    await page.goto('/hotseat?map=hollow&red=thumper&blue=mollusk&wind=off&seed=5');
    expect(await waitForMyTurn(page)).toBe(true);
    await expect(page.getByRole('slider', { name: /Aim pad/ })).toBeVisible();   // phone HUD, not tablet
    const battle = await scaleOf(page);
    expect(battle.scroll).toBe(false);
    expect(battle.scale).toBeGreaterThan(0.9);          // was the tablet layout at ≈ 0.47
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shotsDir('mobile')}/a54-${height}-battle.png` });
    expectNoErrors(errors);
    await close();
  });
}

test('phone in portrait → rotate card', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/hotseat?map=cobalt&red=thumper&blue=mollusk&seed=5');
  await expect(page.getByText('ROTATE YOUR PHONE')).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});
