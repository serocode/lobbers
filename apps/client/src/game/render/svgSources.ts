// SVG sources for battlefield sprites, copied from Battle.dc.html (shell, props, flame) and the
// Scene decorations. Rasterised once per match into Phaser textures.
import { WEAPONS, type MachineId, type MapId, type TeamId, type WeaponId } from '@lobbers/shared';
import { TREE_GROUP_ATTRS, columnMarkup, decorSvg, rockMarkup, treeMarkup } from '../../components/art/sceneArt';
import { sceneModel } from '../../components/art/sceneModel';

const svg = (w: number, h: number, vb: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" overflow="visible">${body}</svg>`;

/** Phaser's loader decodes `data:` URIs as base64, so encode UTF-8 → base64. */
export const dataUrl = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
};

/** Battle.dc.html shell (30×16) with the weapon colour + soft glow. */
/** viewBox centred on the shell centre (15, 8) so the texture origin is (0.5, 0.5). */
export const shellSvg = (col: string): string => svg(64, 56, '-1 -6 32 28',
  `<circle cx="15" cy="8" r="13" fill="${col}" opacity=".35"/><path d="M3 3 H19 Q28 8 19 13 H3 Z" fill="${col}" stroke="#0B0F1A" stroke-width="2.5" stroke-linejoin="round"/><rect x="5" y="3" width="4" height="10" fill="#0B0F1A" opacity=".4"/>`);

export const BARREL_SVG = svg(72, 80, '0 0 36 40',
  '<rect x="4" y="3" width="28" height="35" rx="5" fill="#F45B55" stroke="#0B0F1A" stroke-width="3"/><path d="M5 12 H31 M5 29 H31" stroke="#0B0F1A" stroke-width="3"/><path d="M18 14 L13 23 H18 L16 28 L23 19 H18 Z" fill="#FFD166" stroke="#0B0F1A" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 6 V36" stroke="#fff" stroke-width="2.5" opacity=".35"/>');

export const CRATE_SVG = svg(72, 80, '0 0 36 40',
  '<rect x="3" y="8" width="30" height="30" rx="3" fill="#C98B4E" stroke="#0B0F1A" stroke-width="3"/><rect x="12" y="14" width="12" height="18" rx="2" fill="#F5F1E8" stroke="#0B0F1A" stroke-width="2"/><path d="M18 17 V29 M12.5 23 H23.5" stroke="#5ACB91" stroke-width="4"/><path d="M10 8 L14 1 H22 L26 8" fill="none" stroke="#0B0F1A" stroke-width="3" stroke-linejoin="round"/>');

export const FLAME_SVG = svg(280, 140, '0 0 140 70',
  '<path d="M20 70 Q14 48 28 34 Q30 50 40 52 Q34 30 50 14 Q56 40 66 44 Q64 26 78 18 Q84 44 96 46 Q96 32 108 30 Q118 50 116 70 Z" fill="#FF6B3D" stroke="#0B0F1A" stroke-width="3" stroke-linejoin="round" opacity=".9"/><path d="M40 70 Q38 58 48 50 Q54 60 62 60 Q62 48 72 42 Q80 60 90 70 Z" fill="#FFD166"/>');

/** Airstrike bomb from Battle.dc.html (used for airstrike child tracks). */
export const BOMB_SVG = svg(40, 68, '0 0 20 34',
  '<path d="M4 2 H16 V22 Q10 34 4 22 Z" fill="#4C9AFF" stroke="#0B0F1A" stroke-width="2.5" stroke-linejoin="round"/><path d="M4 6 L0 0 M16 6 L20 0" stroke="#0B0F1A" stroke-width="2.5"/>');

export interface TextureSource { key: string; url: string; width: number; height: number }

const machineUrl = (file: string): string => `${import.meta.env.BASE_URL}assets/machines/${file}.svg`;

export function machineTextures(kinds: Iterable<MachineId>, teams: Iterable<TeamId>, k: number): TextureSource[] {
  const out: TextureSource[] = [];
  const size = { width: Math.round(120 * k), height: Math.round(100 * k) };
  for (const kind of new Set(kinds)) {
    out.push({ key: `barrel-${kind}`, url: machineUrl(`${kind}-barrel`), ...size });
    for (const t of new Set(teams)) out.push({ key: `body-${kind}-${t}`, url: machineUrl(`${kind}-${t}-body`), ...size });
  }
  return out;
}

export function spriteTextures(k: number): TextureSource[] {
  const list: TextureSource[] = [
    { key: 'prop-barrel', url: dataUrl(BARREL_SVG), width: 36 * k, height: 40 * k },
    { key: 'prop-crate', url: dataUrl(CRATE_SVG), width: 36 * k, height: 40 * k },
    { key: 'flame', url: dataUrl(FLAME_SVG), width: 140 * k, height: 70 * k },
    { key: 'bomb', url: dataUrl(BOMB_SVG), width: 20 * k, height: 34 * k },
  ];
  for (const w of Object.keys(WEAPONS) as WeaponId[]) list.push({ key: `shell-${w}`, url: dataUrl(shellSvg(WEAPONS[w].color)), width: 32 * k, height: 28 * k });
  return list;
}

/** Decoration textures for a map: one per tree style/cap colour, plus rock and column. */
export function decorTextures(map: MapId, k: number): TextureSource[] {
  const m = sceneModel(map);
  const size = { width: Math.round(100 * k), height: Math.round(132 * k) };
  const caps = new Set(m.trees.map((t) => t.cap));
  const list: TextureSource[] = [...caps].map((cap) => ({ key: `tree-${map}-${cap}`, url: dataUrl(decorSvg(treeMarkup(m.treeKind, m.P, cap, null), TREE_GROUP_ATTRS)), ...size }));
  list.push({ key: `rock-${map}`, url: dataUrl(decorSvg(rockMarkup(m.P))), ...size });
  if (m.columns.length) list.push({ key: 'column', url: dataUrl(decorSvg(columnMarkup())), ...size });
  return list;
}

export const backgroundUrl = (map: MapId): string => `${import.meta.env.BASE_URL}assets/maps/${map}-background.svg`;
