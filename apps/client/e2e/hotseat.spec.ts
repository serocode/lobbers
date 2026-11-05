// Phase 1 checks: hot-seat match to victory, layouts vs the design screenshots, camera on long shots, fps.
import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { diffPercent, expectNoErrors, probe, repo, shotsDir, waitForMyTurn } from './helpers';

const OUT = shotsDir('phase-1');
const collect = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};
const aim = (page: Page, prefer?: string): Promise<boolean> =>
  page.evaluate((p) => (window as unknown as { __lobbersDev: { aimAtNearest(w?: string): boolean } }).__lobbersDev.aimAtNearest(p), prefer);

test('desktop: 2v2 hot-seat played to victory, terrain hash equal after every action', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = collect(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/match/local?map=cobalt&red=thumper,boomba&blue=cinder,voltaic&wind=calm&turn=45&seed=11');
  await waitForMyTurn(page);
  await page.waitForTimeout(900);
  const first = await page.screenshot();
  writeFileSync(`${OUT}/desktop-turn.png`, first);
  const fps: number[] = [];
  let turns = 0;
  while (await waitForMyTurn(page, 60_000)) {
    turns++;
    if (turns === 2) {
      // Overview (Z) toggles on your turn; it is ignored while a shell is being followed.
      await page.waitForTimeout(1000);
      await page.keyboard.press('z');
      await page.waitForTimeout(1100);
      await page.screenshot({ path: `${OUT}/desktop-overview.png` });
      expect(await page.evaluate(() => (window as unknown as { __lobbersCam: { fit: boolean } }).__lobbersCam.fit)).toBe(true);
      await page.keyboard.press('z');
      await page.waitForTimeout(1000);
    }
    expect(await aim(page, turns <= 2 ? 'heavy-bomb' : undefined)).toBe(true);
    if (turns === 1) {
      await page.keyboard.press('w');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/desktop-armory.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    await page.keyboard.press('Space');
    if (turns === 1) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/desktop-shot-in-flight.png` });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/desktop-impact.png` });
    }
    await page.waitForFunction((t) => { const p = (window as unknown as { __lobbers: { turn: number; result: string | null } }).__lobbers; return p.turn > t || p.result !== null; }, (await probe(page)).turn, { timeout: 30_000 });
    fps.push((await probe(page)).fps);
    if (turns === 3) await page.screenshot({ path: `${OUT}/desktop-next-turn.png` });
    expect(turns).toBeLessThan(80);
  }
  await page.waitForSelector('[role="dialog"][aria-label="VICTORY!"], [role="dialog"][aria-label="DRAW"]', { timeout: 15_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/desktop-victory.png` });
  const p = await probe(page);
  expect(p.result === 'red' || p.result === 'blue').toBe(true);
  expect(p.hash.mismatches).toBe(0);
  expect(p.hash.checks).toBeGreaterThan(turns);
  const d = await diffPercent(page, first, `${repo}design/screenshots/04-battle.png`);
  const perf = await page.evaluate(() => (window as unknown as { __lobbersPerf?: { carves: number; maxCarveMs: number } }).__lobbersPerf ?? null);
  writeFileSync(`${OUT}/desktop-report.json`, JSON.stringify({ perf, turns, winner: p.result, hashChecks: p.hash.checks, hashMismatches: p.hash.mismatches, fps: { min: Math.min(...fps), avg: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) }, diffVs04: Math.round(d * 100) / 100 }, null, 2));
  expectNoErrors(errors);
});

const fps8: Record<string, number> = {};

async function layoutShot(page: Page, size: { width: number; height: number }, query: string, name: string, ref: string): Promise<number> {
  await page.setViewportSize(size);
  await page.goto(`/match/local?${query}`);
  await waitForMyTurn(page);
  await page.waitForTimeout(1800);
  const buf = await page.screenshot();
  writeFileSync(`${OUT}/${name}.png`, buf);
  fps8[name] = (await probe(page)).fps;
  return diffPercent(page, buf, `${repo}design/screenshots/${ref}`);
}

test('tablet + phone layouts render (vs 04f / 04g) and Skyreach (vs 04i)', async ({ page }) => {
  const errors = collect(page);
  const t = await layoutShot(page, { width: 1024, height: 768 }, 'map=dunes&red=thumper,voltaic,sprocket,cinder&blue=boomba,whirligig,mollusk,frostbite&seed=5', 'tablet-turn', '04f-battle-tablet.png');
  const ph = await layoutShot(page, { width: 844, height: 390 }, 'map=hollow&red=thumper,voltaic,sprocket,cinder&blue=frostbite,mollusk,whirligig,boomba&seed=5', 'phone-turn', '04g-battle-phone.png');
  await page.locator('button[aria-label="All weapons and abilities"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/phone-weapon-sheet.png` });
  const sk = await layoutShot(page, { width: 1440, height: 900 }, 'map=skyreach&red=thumper,voltaic,sprocket,cinder&blue=frostbite,mollusk,whirligig,boomba&seed=5', 'desktop-skyreach', '04i-battle-skyreach.png');
  writeFileSync(`${OUT}/layout-report.json`, JSON.stringify({ tabletDiffVs04f: +t.toFixed(2), phoneDiffVs04g: +ph.toFixed(2), skyreachDiffVs04i: +sk.toFixed(2), fpsWith8Units: fps8 }, null, 2));
  expectNoErrors(errors);
});

test('Sunscar Dunes: full-power shot is chased across the map, then the camera pans to the next player', async ({ page }) => {
  const errors = collect(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/match/local?map=dunes&red=thumper&blue=mollusk&wind=off&seed=2');
  await waitForMyTurn(page);
  await page.waitForTimeout(800);
  for (let i = 0; i < 25; i++) await page.keyboard.press('e');
  const views: Array<{ x: number; mode: string }> = [];
  await page.keyboard.press('Space');
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/dunes-chase-${i}.png` });
    views.push(await page.evaluate(() => (window as unknown as { __lobbersCam: { x: number; mode: string } }).__lobbersCam));
  }
  await waitForMyTurn(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/dunes-next-player.png` });
  const xs = views.map((v) => v.x);
  writeFileSync(`${OUT}/dunes-camera.json`, JSON.stringify(views, null, 2));
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(800);
  expect(views.some((v) => v.mode === 'follow')).toBe(true);
  expectNoErrors(errors);
});
