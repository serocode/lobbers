import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const shotsDir = (phase: string): string => { const d = `${repo}docs/screenshots/${phase}`; mkdirSync(d, { recursive: true }); return d; };

export interface Probe { fps: number; hash: { checks: number; mismatches: number }; phase: string; active: string | null; turn: number; result: string | null; units: Array<{ id: string; hp: number; alive: boolean; x: number; y: number }> }

export const probe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as { __lobbers: Probe }).__lobbers);

/** Waits until the active (local) unit can be controlled, returns false if the match ended. */
export async function waitForMyTurn(page: Page, timeout = 30_000): Promise<boolean> {
  await page.waitForFunction(() => {
    const w = window as unknown as { __lobbers?: Probe; __lobbersDev?: unknown };
    return !!w.__lobbers && (w.__lobbers.result !== null || (w.__lobbers.phase === 'acting' && !!document.querySelector('button[aria-label^="Fire"]:not([disabled])')));
  }, null, { timeout, polling: 100 });
  return (await probe(page)).result === null;
}

/**
 * Mean per-channel difference (0–100 %) between a PNG buffer and a reference image served by Vite (/@fs),
 * after scaling both to the reference size. Computed in the page with canvas.
 */
export async function diffPercent(page: Page, actual: Buffer, refAbsPath: string): Promise<number> {
  return page.evaluate(async ({ a, ref }) => {
    const load = (src: string): Promise<HTMLImageElement> => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [ia, ib] = await Promise.all([load(`data:image/png;base64,${a}`), load(ref)]);
    const w = ib.naturalWidth, h = ib.naturalHeight;
    const px = (img: HTMLImageElement): Uint8ClampedArray => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (!x) throw new Error('2d'); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let sum = 0;
    for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return (sum / ((da.length / 4) * 3 * 255)) * 100;
  }, { a: actual.toString('base64'), ref: `/@fs${refAbsPath}` });
}

export const expectNoErrors = (errors: string[]): void => { expect(errors, errors.join('\n')).toEqual([]); };
