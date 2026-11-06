// Helpers for the multiplayer E2E (skill `multiplayer-e2e`): one browser context per player
// (separate storage = separate guest account), real server, real rooms.
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface Player { name: string; ctx: BrowserContext; page: Page; errors: string[] }
export interface Snap {
  turn: number; wind: number; phase: string; active: string | null; replaying: boolean; result: string | null; mine: boolean;
  hash: { client: number; server: number; checks: number; mismatches: number };
  units: Array<{ id: string; hp: number; alive: boolean; x: number; y: number }>;
  offline: string[];
  link: string;
}

const IGNORED = [/Failed to load resource/, /WebSocket connection .* failed/, /ERR_CONNECTION_REFUSED/];

export function watchErrors(page: Page, errors: string[]): void {
  if (process.env.P2P_DEBUG) page.on('console', (m) => { if (m.text().startsWith('[p2p]')) console.log(new Date().toISOString().slice(11, 19), page.url().slice(-14), m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text()); });
}

export async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  watchErrors(page, errors);
  await page.goto('/');
  await page.getByPlaceholder('Kaboomerang').fill(name);
  await page.getByRole('button', { name: "LET'S LOB" }).click();
  await expect(page.getByRole('button', { name: /PLAY NOW/ })).toBeEnabled();
  return { name, ctx, page, errors };
}

/** The player hosts a room in their own tab (PeerJS) and lands in its lobby. */
export async function createRoom(p: Player): Promise<string> {
  await p.page.getByRole('button', { name: 'Create Room' }).click();
  await p.page.getByRole('button', { name: 'Create & Open Lobby' }).click();
  await p.page.waitForURL(/\/lobby\/LOB-/, { timeout: 20_000 });
  await expect(p.page.getByTestId('room-code')).toHaveText(/LOB-/, { timeout: 20_000 });
  return (await p.page.getByTestId('room-code').textContent()) ?? '';
}

export async function joinByCode(p: Player, code: string): Promise<void> {
  await p.page.getByRole('button', { name: 'Join Room' }).click();
  await p.page.getByPlaceholder('LOB-XXXX').fill(code);
  await p.page.getByRole('button', { name: `Join ${code}` }).click();
  await p.page.waitForURL(new RegExp(`/lobby/${code}`));
  await expect(p.page.getByTestId('room-code')).toHaveText(code, { timeout: 20_000 });
}

export const countText = (p: Player): Promise<string | null> => p.page.getByTestId('player-count').textContent();

/** Host cycles WIND to Off so the dev auto-aim lands (wind still goes through the server). */
export async function hostSetsWindOff(host: Player): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const v = await host.page.locator('button', { hasText: 'WIND' }).textContent();
    if (v?.includes('Off')) return;
    await host.page.locator('button', { hasText: 'WIND' }).click();
    await host.page.waitForTimeout(150);
  }
}

export async function startMatch(players: Player[]): Promise<string> {
  const [host, ...rest] = players;
  for (const p of rest) await p.page.getByRole('button', { name: 'READY UP' }).click();
  await expect(host.page.getByTestId('ready-info')).toHaveText('Everyone is ready', { timeout: 10_000 });
  await host.page.getByRole('button', { name: 'START MATCH' }).click();
  for (const p of players) await p.page.waitForURL(/\/match\/(?!local)/, { timeout: 20_000 });
  for (const p of players) await p.page.waitForFunction(() => !!(window as unknown as { __lobbersDev?: unknown }).__lobbersDev, null, { timeout: 20_000 });
  return new URL(host.page.url()).pathname.split('/').pop() ?? '';
}

export const snap = (p: Player): Promise<Snap> => p.page.evaluate(() => (window as unknown as { __lobbersDev: { debug(): Snap } }).__lobbersDev.debug());

/** Every client idle on the same turn (nothing left to replay). */
export async function settled(players: Player[], timeout = 40_000): Promise<Snap[]> {
  const t0 = Date.now();
  for (;;) {
    const s = await Promise.all(players.map(snap));
    const same = s.every((x) => x.turn === s[0].turn && !x.replaying && (x.result !== null || x.phase === 'acting') && x.result === s[0].result);
    if (same && (s[0].result !== null || s.some((x) => x.mine))) return s;
    if (Date.now() - t0 > timeout) throw new Error(`clients never settled: ${JSON.stringify(s.map((x) => [x.turn, x.phase, x.replaying, x.result, x.mine, x.link]))}`);
    await players[0].page.waitForTimeout(150);
  }
}

/** All clients agree on HP, alive, positions, wind, turn; each mirror terrain hash equals the server's. */
export function expectSynced(s: Snap[]): void {
  for (const x of s) {
    expect(x.units).toEqual(s[0].units);
    expect(x.wind).toBe(s[0].wind);
    expect(x.turn).toBe(s[0].turn);
    expect(x.hash.client).toBe(x.hash.server);
    expect(x.hash.mismatches).toBe(0);
    expect(x.hash.server).toBe(s[0].hash.server);
  }
}

/** The active player auto-aims (dev helper over the shared preview) and fires with Space. */
export async function playTurn(players: Player[]): Promise<Player> {
  const s = await Promise.all(players.map(snap));
  const i = s.findIndex((x) => x.mine);
  const p = players[i];
  await p.page.evaluate(() => (window as unknown as { __lobbersDev: { aimAtNearest(): boolean } }).__lobbersDev.aimAtNearest());
  await p.page.keyboard.press('Space');
  return p;
}
