// Friends (P2P tabs), Daily Missions and Leaderboards (Phase 4). Screenshots vs 08-friends / 01d-home-missions.
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createProfile, nextMidnight, PROFILE_KEY, type LocalProfile } from '@lobbers/shared';
import { diffPercent, expectNoErrors, repo, shotsDir } from './helpers';
import { createRoom, newPlayer, watchErrors } from './online';

const report: Record<string, number> = {};
const now = Date.now();
const crew = (): LocalProfile['recentPlayers'] => [
  { id: 'p-pickle', name: 'PicklePounder', level: 27, rating: 1240, title: 'Static Cling', lastPlayedAt: now - 120_000, matchesTogether: 12, starred: true },
  { id: 'p-mara', name: 'Mara.Vex', level: 41, rating: 1330, title: 'Crater Maker', lastPlayedAt: now - 7_200_000, matchesTogether: 5, starred: false },
  { id: 'p-salt', name: 'Saltwire', level: 52, rating: 1102, title: 'Dune Lord', lastPlayedAt: now - 86_400_000 * 2, matchesTogether: 2, starred: false },
];

async function seed(page: Page, patch: Partial<LocalProfile>): Promise<void> {
  await page.goto('/');
  const p = { ...createProfile('Kaboomerang', 'u-social', now - 86_400_000 * 30), ...patch };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PROFILE_KEY, JSON.stringify(p)]);
}
const shot = async (page: Page, name: string, ref: string): Promise<void> => {
  await page.waitForTimeout(800);
  const png = await page.screenshot({ path: `${shotsDir('phase-4')}/${name}.png` });
  report[name] = Math.round((await diffPercent(page, png, `${repo}design/screenshots/${ref}`)) * 10) / 10;
  writeFileSync(`${shotsDir('phase-4')}/social-report.json`, JSON.stringify(report, null, 2));
};

test('Friends: Starred / Recent players, star → Your Crew, popover, join by code', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  await seed(page, { recentPlayers: crew() });
  await page.goto('/');
  await page.getByRole('link', { name: 'See all' }).click();
  await page.waitForURL('**/friends');
  await expect(page.getByRole('button', { name: /^Starred\s*1$/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Recent players\s*3$/ }).click();
  await expect(page.getByText('played 12× · last 2 min ago')).toBeVisible();
  await expect(page.getByText('Create a room to invite friends')).toBeVisible();
  await shot(page, 'friends', '08-friends.png');
  await page.getByRole('button', { name: 'Star Mara.Vex' }).click();
  await expect(page.getByRole('button', { name: /^Starred\s*2$/ })).toBeVisible();
  await page.getByRole('button', { name: 'View profile of Saltwire' }).click();
  const pop = page.getByRole('dialog', { name: 'Player profile' });
  await expect(pop).toContainText('SILVER I');
  await expect(pop.getByRole('button', { name: 'Invite to room' })).toBeDisabled();
  await shot(page, 'friends-profile', '08b-friends-profile.png');
  await pop.getByRole('button', { name: 'Close' }).click();
  await page.getByLabel('Join a room by code').fill('LOB-12');
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  await page.goto('/');
  await expect(page.getByLabel('Your crew')).toContainText('Mara.Vex');
  expectNoErrors(errors);
});

test('Daily missions: badge, claim pays once; Leaderboards: you + crew by rating, Global disabled', async ({ page }) => {
  const errors: string[] = []; watchErrors(page, errors);
  const reset = nextMidnight(now);
  await seed(page, {
    coins: 500, recentPlayers: crew(),
    progress: { 'daily:m-direct': { value: 5, claimedAt: null, resetAt: reset }, 'daily:m-damage': { value: 3420, claimedAt: null, resetAt: reset } },
  });
  await page.goto('/');
  await expect(page.getByTestId('missions-badge')).toHaveText('1');
  await page.getByRole('button', { name: /Missions/ }).click();
  await expect(page.getByTestId('missions-reset')).toHaveText(/Resets in \d\d:\d\d:\d\d/);
  await expect(page.getByTestId('mission-m-damage')).toContainText('3,420 / 5,000');
  await shot(page, 'missions', '01d-home-missions.png');
  await page.getByTestId('mission-m-direct').getByRole('button', { name: 'Claim' }).click();
  await expect(page.getByRole('status')).toHaveText('+150 coins claimed');
  await expect(page.getByTestId('mission-m-direct').getByRole('button')).toHaveText('Claimed');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('profile-coins')).toHaveText('650');
  await expect(page.getByTestId('missions-badge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Leaderboards' }).click();
  const lb = page.getByRole('dialog', { name: 'Leaderboards' });
  await expect(lb.getByRole('button', { name: 'Global' })).toBeDisabled();
  await expect(lb.getByTestId('leader-you')).toContainText('Kaboomerang (you)');
  await expect(lb.locator('[data-testid="leader-you"]')).toContainText('1,000');
  expectNoErrors(errors);
});

test('Friends while hosting: Your Room card shows the live room; Invite copies the link', async ({ browser }) => {
  const host = await newPlayer(browser, 'Hostess');
  await host.page.evaluate(([k]) => { const p = JSON.parse(localStorage.getItem(k) ?? '{}') as LocalProfile; p.recentPlayers = [{ id: 'p-x', name: 'Xan', level: 3, rating: 1000, title: null, lastPlayedAt: Date.now(), matchesTogether: 1, starred: false }]; localStorage.setItem(k, JSON.stringify(p)); }, [PROFILE_KEY]);
  await host.page.reload();   // the app keeps the profile in memory; reload so it picks up the seeded crew
  const code = await createRoom(host);
  await host.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await host.page.getByRole('link', { name: /Customize/ }).click();
  await host.page.waitForURL('**/inventory');
  await expect(host.page.getByRole('link', { name: 'Lobby' })).toBeVisible();
  await host.page.goto('/friends');
  const room = host.page.getByRole('complementary', { name: 'Your room' });
  await expect(room).toContainText(code, { timeout: 60_000 });
  await expect(room).toContainText('1/8');
  await host.page.getByRole('button', { name: /^Recent players\s*1$/ }).click();
  await host.page.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(host.page.getByRole('status')).toHaveText('Invite link copied — send it to Xan');
  expect(await host.page.evaluate(() => navigator.clipboard.readText())).toContain(`/?join=${code}`);
  await room.getByRole('button', { name: 'OPEN LOBBY' }).click();
  await host.page.waitForURL(new RegExp(`/lobby/${code}`));
  expectNoErrors(host.errors);
  await host.ctx.close();
});
