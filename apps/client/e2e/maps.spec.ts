// Phase 3: all six maps in battle (overview), incl. the animated lava / icy-water hazard strips.
import { expect, test } from '@playwright/test';
import { MAP_LIST } from '@lobbers/shared';
import { expectNoErrors, shotsDir, waitForMyTurn } from './helpers';
import { watchErrors } from './online';

for (const m of MAP_LIST) {
  test(`map ${m.id}: loads at world size, overview + hazard`, async ({ page }) => {
    const errors: string[] = [];
    watchErrors(page, errors);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/match/local?map=${m.id}&red=thumper,voltaic&blue=mollusk,cinder&seed=2`);
    expect(await waitForMyTurn(page)).toBe(true);
    await page.keyboard.press('z');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shotsDir('phase-3')}/map-${m.id}.png` });
    expectNoErrors(errors);
  });
}
