// Phase 0 check: /dev/kit art vs design/screenshots (c1 machine, c2 weapon icon, c3 scenes).
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { diffPercent, expectNoErrors, repo, shotsDir } from './helpers';

const MAPS = ['cobalt', 'ember', 'glacier', 'dunes', 'skyreach', 'hollow'] as const;

test('dev kit art matches the design references', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto('/dev/kit');
  await page.evaluate(() => document.fonts.ready);
  const out = shotsDir('phase-0');
  const report: Record<string, number> = {};
  const check = async (key: string, ref: string, max: number): Promise<void> => {
    const el = page.locator(`[data-kit="${key}"]`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const buf = await el.screenshot();
    writeFileSync(`${out}/${key}.png`, buf);
    const d = await diffPercent(page, buf, `${repo}design/screenshots/${ref}`);
    report[key] = Math.round(d * 100) / 100;
    expect(d, `${key} differs ${d.toFixed(2)}% from ${ref}`).toBeLessThan(max);
  };
  await check('c1', 'c1-machine.png', 1);
  await check('c2', 'c2-weapon-icon.png', 1);
  // Scenes animate (clouds drift, stars twinkle, motes float), so allow a little more.
  for (const m of MAPS) await check(`c3-${m}`, `c3-scene-${m}.png`, 4);
  writeFileSync(`${out}/diff-report.json`, JSON.stringify(report, null, 2));
  await page.locator('section[aria-label="Components"]').screenshot({ path: `${out}/kit-components.png` });
  await page.locator('section[aria-label="MachineArt"]').screenshot({ path: `${out}/kit-machines.png` });
  await page.locator('section[aria-label="WeaponIcon"]').screenshot({ path: `${out}/kit-weapons.png` });
  expectNoErrors(errors);
});
