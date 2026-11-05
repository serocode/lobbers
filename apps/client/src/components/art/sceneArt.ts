// Terrain decorations from Scene.dc.html as SVG markup strings. One source for both renderers:
// SceneBackdrop (React, inline <g>) and the Phaser battlefield (rasterised textures).
import type { MapPalette } from '@lobbers/shared';
import type { TreeKind } from './sceneModel';

const sway = (dur: number | null): string =>
  dur === null ? '' : `<animateTransform attributeName="transform" type="rotate" values="-2 0 -40;2 0 -40;-2 0 -40" dur="${dur}s" repeatCount="indefinite"></animateTransform>`;

/** Tree body for one map style (origin = base point on the ground). `dur` = sway period, null = static. */
export function treeMarkup(kind: TreeKind, P: MapPalette, cap: string, dur: number | null): string {
  switch (kind) {
    case 'puffy':
      return `<g><rect x="-6" y="-46" width="12" height="50" fill="${P.trunk}"></rect><g>${sway(dur)}<circle cx="-14" cy="-58" r="22" fill="${P.foliageDark}"></circle><circle cx="14" cy="-60" r="24" fill="${P.foliage}"></circle><circle cx="0" cy="-82" r="24" fill="${P.foliage}"></circle><path d="M-8 -92 Q2 -100 12 -94" fill="none" stroke="${P.grassHi}" stroke-width="4" stroke-linecap="round"></path></g></g>`;
    case 'dead':
      return `<g><rect x="-6" y="-46" width="12" height="50" fill="${P.trunk}"></rect><path d="M0 -40 L-22 -72 M0 -50 L18 -84 M-12 -58 L-26 -60 M10 -68 L26 -70" fill="none" stroke="${P.trunk}" stroke-width="6" stroke-linecap="round"></path></g>`;
    case 'pine':
      return `<g><rect x="-6" y="-46" width="12" height="50" fill="${P.trunk}"></rect><path d="M0 -112 L30 -50 L-30 -50 Z" fill="${P.foliage}"></path><path d="M0 -112 L22 -70 L-22 -70 Z" fill="${P.foliageDark}"></path><path d="M0 -112 L12 -88 Q0 -82 -12 -88 Z" fill="#F2F8FF"></path></g>`;
    case 'cactus':
      return `<g><path d="M-9 4 V-86 Q-9 -98 0 -98 Q9 -98 9 -86 V4 Z" fill="${P.foliage}"></path><path d="M-9 -40 H-24 V-64 Q-24 -72 -18 -72 Q-12 -72 -12 -64 V-52 H-9 M9 -54 H22 V-76 Q22 -84 28 -84 Q34 -84 34 -76 V-46 H9" fill="${P.foliage}"></path><path d="M-3 -90 V-6" stroke="${P.foliageDark}" stroke-width="3"></path></g>`;
    case 'shroom':
      return `<g><circle cx="0" cy="-46" r="44" fill="${P.glow}" opacity=".12" stroke="none"></circle><path d="M-7 4 Q-10 -24 -5 -40 H5 Q10 -24 7 4 Z" fill="${P.trunk}"></path><path d="M-36 -38 Q0 -86 36 -38 Q0 -28 -36 -38 Z" fill="${cap}"></path><circle cx="-14" cy="-52" r="5" fill="#F5F1E8" stroke="none"></circle><circle cx="10" cy="-58" r="4" fill="#F5F1E8" stroke="none"></circle><circle cx="20" cy="-44" r="3.5" fill="#F5F1E8" stroke="none"></circle></g>`;
  }
}

/** Wrapper group used by Scene.dc.html around every tree. */
export const TREE_GROUP_ATTRS = 'stroke="#151B2B" stroke-width="4" stroke-linejoin="round"';

export const rockMarkup = (P: MapPalette): string =>
  `<path d="M-22 4 L-16 -14 L2 -22 L18 -12 L24 4 Z" fill="${P.rock}" stroke="#151B2B" stroke-width="4" stroke-linejoin="round"></path>`;

export const columnMarkup = (): string =>
  '<g stroke="#151B2B" stroke-width="4" stroke-linejoin="round"><rect x="-16" y="-96" width="32" height="96" fill="#E8C99A"></rect><rect x="-24" y="-108" width="48" height="14" fill="#E8C99A"></rect><path d="M-6 -90 V-6 M6 -90 V-6" stroke="#C9A26B" stroke-width="3"></path></g>';

/** Box (in decoration units) that every decoration fits in; the base point sits at (0, 0). */
export const DECOR_BOX = { x: -50, y: -120, w: 100, h: 132 } as const;

/** Standalone SVG document for a decoration, for texture loading. */
export function decorSvg(inner: string, groupAttrs = ''): string {
  const { x, y, w, h } = DECOR_BOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="${x} ${y} ${w} ${h}"><g ${groupAttrs}>${inner}</g></svg>`;
}
