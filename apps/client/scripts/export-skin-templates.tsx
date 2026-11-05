// Exports public/assets/machines/templates/<kind>-<team>-body.svg: the same markup as <kind>-<team>-body.svg
// (Machine.dc.html minus the barrel), but with the body colour replaced by the token SKIN_TOKEN so the
// battlefield can repaint ONLY the body for a skin (other parts may share the signature colour).
// Run: pnpm --filter @lobbers/client skin-templates
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MACHINE_PARTS } from '../src/components/art/machineParts';
import { SKIN_TOKEN } from '../src/game/render/skinToken';

const TEAMS = { red: '#F45B55', blue: '#4C9AFF' } as const;
const SENTINEL = 9999;

/** Removes the barrel group `<g transform="rotate(9999 …)">…</g>` (balanced). */
function dropBarrel(markup: string): string {
  const at = markup.indexOf(`rotate(${SENTINEL} `);
  if (at < 0) throw new Error('barrel group not found');
  const start = markup.lastIndexOf('<g', at);
  let depth = 0, i = start;
  while (i < markup.length) {
    if (markup.startsWith('<g', i) && /[\s>]/.test(markup[i + 2])) depth++;
    else if (markup.startsWith('</g>', i)) { depth--; if (depth === 0) { i += 4; break; } }
    i++;
  }
  return markup.slice(0, start) + markup.slice(i);
}

const out = new URL('../public/assets/machines/templates/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [kind, Parts] of Object.entries(MACHINE_PARTS)) {
  for (const [team, tint] of Object.entries(TEAMS)) {
    const inner = renderToStaticMarkup(<Parts body={SKIN_TOKEN} tint={tint} rot={SENTINEL} />);
    const svg = `<svg width="240" height="200" viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="95" rx="44" ry="4.5" fill="#000" opacity=".28"></ellipse><g transform="translate(0 0)">${dropBarrel(inner)}</g></svg>`;
    if (!svg.includes(SKIN_TOKEN)) throw new Error(`${kind}: no body colour in markup`);
    writeFileSync(new URL(`${kind}-${team}-body.svg`, out), svg);
  }
}
console.log('skin templates written');
