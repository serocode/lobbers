// Records the Phase 1 demo clip: Bunker Buster + Heavy Bomb carves a real crater, the target falls in.
// Run on demand: pnpm --filter @lobbers/client exec playwright test e2e/record.spec.ts
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expectNoErrors, probe, repo, shotsDir, waitForMyTurn } from './helpers';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } }, viewport: { width: 1440, height: 900 } });

test('record: heavy bomb crater + fall', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/match/local?map=cobalt&red=thumper&blue=frostbite,mollusk,cinder,voltaic&wind=off&seed=4');
  await waitForMyTurn(page);
  await page.waitForTimeout(1000);
  await page.locator('button[aria-label^="Special ability"]').click();
  await page.waitForFunction(() => document.querySelector('button[aria-label^="Special ability"][aria-pressed="true"]'));
  await waitForMyTurn(page); // the ability's own replay briefly blocks input
  const before = (await probe(page)).units.find((u) => u.id === 'blue-3');
  expect(await page.evaluate(() => (window as unknown as { __lobbersDev: { aimAtNearest(w: string): boolean } }).__lobbersDev.aimAtNearest('heavy-bomb'))).toBe(true);
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  const out = shotsDir('phase-1');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/crater-seq-${i}.png` }); }
  await waitForMyTurn(page);
  await page.waitForTimeout(1500);
  const after = (await probe(page)).units.find((u) => u.id === 'blue-3');
  writeFileSync(`${out}/crater-report.json`, JSON.stringify({ before, after }, null, 2));
  expect(after && before && (after.y > before.y || after.hp < before.hp)).toBe(true);
  await page.close();
  mkdirSync(`${repo}docs/media`, { recursive: true });
  await page.video()?.saveAs(`${repo}docs/media/phase1-heavy-bomb-crater.webm`);
  expectNoErrors(errors);
});
