// Static deploy checks (P2P migration, deploy step): run against a production build —
//   pnpm build && pnpm --filter @lobbers/client preview --port 4180   ·   E2E_BASE_URL=http://localhost:4180 pnpm exec playwright test e2e/deploy.spec.ts
// A cold deep link to /lobby/:code (first run inside the lobby), refreshes on /lobby/:code for a guest and for the
// host, and the /?join= invite link. The static host must serve index.html for every path (vercel.json rewrite).
import { expect, test } from '@playwright/test';
import { expectNoErrors } from './helpers';
import { createRoom, newPlayer, watchErrors } from './online';

test('deep link + refresh on /lobby/:code, invite link', async ({ browser }) => {
  test.setTimeout(240_000);
  const host = await newPlayer(browser, 'Hosty');
  const code = await createRoom(host);

  // Guest: brand-new browser, straight to /lobby/CODE (no Home first). First-run modal appears in the lobby, then it joins.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = []; watchErrors(page, errors);
  const res = await page.goto(`/lobby/${code}`);
  expect(res?.status()).toBe(200);
  await page.getByPlaceholder('Kaboomerang').fill('Linky');
  await page.getByRole('button', { name: "LET'S LOB" }).click();
  await expect(page.getByTestId('room-code')).toHaveText(code, { timeout: 30_000 });
  await expect(host.page.getByTestId('player-count')).toHaveText('2/8');

  // Guest refresh on /lobby/CODE → back in the same room.
  await page.reload();
  await expect(page.getByTestId('room-code')).toHaveText(code, { timeout: 30_000 });
  await expect(page.getByTestId('player-count')).toHaveText('2/8', { timeout: 30_000 });
  await expect(host.page.getByTestId('player-count')).toHaveText('2/8');

  // Host refresh on /lobby/CODE → the hosted room resumes from localStorage; the guest is still in it.
  await host.page.reload();
  await expect(host.page.getByText('You are hosting')).toBeVisible({ timeout: 40_000 });
  await expect(host.page.getByTestId('room-code')).toHaveText(code);
  await expect(host.page.getByTestId('player-count')).toHaveText('2/8', { timeout: 40_000 });
  await expect(page.getByTestId('player-count')).toHaveText('2/8', { timeout: 40_000 });

  // Invite link.
  const third = await newPlayer(browser, 'Invitee');
  await third.page.goto(`/?join=${code}`);
  await third.page.waitForURL(new RegExp(`/lobby/${code}`), { timeout: 30_000 });
  await expect(host.page.getByTestId('player-count')).toHaveText('3/8', { timeout: 30_000 });

  expectNoErrors(errors); expectNoErrors(host.errors); expectNoErrors(third.errors);
  for (const c of [host.ctx, ctx, third.ctx]) await c.close();
});
