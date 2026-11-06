// Profile (Phase 4): screenshot vs 06-profile.png from a played-in profile (built with creditMatch), title picker,
// history row → Results from history, Home profile card → Profile.
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createProfile, creditMatch, PROFILE_KEY, type LocalProfile, type MatchEndedMsg, type PlayerResult } from '@lobbers/shared';
import { diffPercent, expectNoErrors, repo, shotsDir } from './helpers';
import { watchErrors } from './online';

const res = (id: string, team: 'red' | 'blue', o: Partial<PlayerResult> = {}): PlayerResult => ({
  playerId: id, unitId: `${team}-${id}`, name: id === 'u-prof' ? 'Kaboomerang' : 'Tidecaller', team, machine: 'thumper', damageDealt: 900, damageReceived: 300,
  eliminations: 2, assists: 1, accuracy: 55, shots: 6, hits: 3, xp: 480, coins: 120, mvp: id === 'u-prof', survived: true,
  feats: { directHits: 3, burnDamage: 0, carvedPx: 9000, friendlyHits: 0, windHits: 1, bestChain: 0, bestFreeze: 0, bestTurnElims: 1, iceElims: 0, guidedHits: 0 }, ...o,
});
const maps = ['cobalt', 'glacier', 'ember', 'cobalt', 'glacier', 'ember', 'cobalt', 'ember', 'dunes', 'skyreach'] as const;

function playedProfile(): LocalProfile {
  let p: LocalProfile = { ...createProfile('Kaboomerang', 'u-prof', new Date(2026, 2, 3).getTime()), owned: [...createProfile('x', 'x', 0).owned, 'ti-hill', 's-arctic'] };
  p = { ...p, equipped: { ...p.equipped, title: 'ti-hill', 'skin:thumper': 's-arctic' } };
  maps.forEach((mapId, i) => {
    const won = i % 3 !== 2;
    const m: MatchEndedMsg = {
      matchId: `LOB-PROF-${i}`, mapId, mode: 'team-deathmatch', winner: won ? 'red' : 'blue', turns: 12, durationSec: 320, endedAt: Date.now() - (10 - i) * 3_600_000,
      players: [res('u-prof', 'red', { machine: i === 4 ? 'frostbite' : 'thumper', damageDealt: 600 + i * 70 }), res('u-foe', 'blue')], mvpHighlight: 'Biggest hit: 412 with Heavy Bomb',
      details: { damageByTurn: [{ turn: 1, red: 300, blue: 120 }], weapons: [{ weaponId: 'heavy-bomb', shots: 4, damage: 900 }] },
    };
    p = creditMatch(p, m).profile;
  });
  return p;
}

test('profile from real match history: stats, rank, achievements, history → Results; title picker', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  await page.goto('/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PROFILE_KEY, JSON.stringify(playedProfile())]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Your profile' }).click();
  await page.waitForURL('**/profile');
  await expect(page.getByTestId('win-rate')).toHaveText('70%');
  await expect(page.getByTestId('profile-title')).toContainText('“Hill Breaker” · Member since March 2026');
  await expect(page.getByTestId('profile-rank')).toHaveText(/BRONZE|SILVER|GOLD/);
  await expect(page.getByTestId('ach-done')).toHaveText('2 / 12');                  // Wind Whisperer + Crater Maker (90,000 px)
  await expect(page.getByTestId('history-page')).toHaveText('1 / 2');
  await page.waitForTimeout(1600);
  const png = await page.screenshot({ path: `${shotsDir('phase-4')}/profile.png` });
  writeFileSync(`${shotsDir('phase-4')}/profile-report.json`, JSON.stringify({ profile: Math.round((await diffPercent(page, png, `${repo}design/screenshots/06-profile.png`)) * 10) / 10 }, null, 2));

  await page.getByRole('button', { name: 'Change title' }).click();
  await page.getByRole('dialog', { name: 'Change title' }).getByRole('button', { name: '“Rookie”' }).click();
  await expect(page.getByTestId('profile-title')).toContainText('“Rookie”');
  await page.getByRole('button', { name: 'Share profile' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  await page.getByRole('button', { name: /Open results/ }).first().click();
  await page.waitForURL(/\/results\/LOB-PROF-9/);
  await expect(page.getByText('Player Rankings')).toBeVisible();
  expectNoErrors(errors);
});
