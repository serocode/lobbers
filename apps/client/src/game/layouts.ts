// The three battle layouts (DESIGN_SPEC §0 Stage, §2.4). Field = camera viewport in layout px.
import { CAMERA } from '@lobbers/shared';

export type LayoutId = 'desktop' | 'tablet' | 'phone';

export interface LayoutSpec {
  id: LayoutId;
  stage: { w: number; h: number };
  field: { x: number; y: number; w: number; h: number };
  /** Play zoom (world px → layout px). */
  zoom: number;
  /** Unit tag style: phone shows only a thick HP bar (BattleMobile.dc.html). */
  tag: { font: number; hpW: number; hpH: number; hpBorder: number; name: boolean; top: number };
  damageFont: number;
  preview: { core: number; outline: number; gap: number };
}

const v = CAMERA.viewport;

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  desktop: {
    id: 'desktop', stage: { w: 1440, h: 900 }, field: { x: 0, y: 0, w: v.desktop.w, h: v.desktop.h }, zoom: v.desktop.zoom,
    tag: { font: 12, hpW: 76, hpH: 8, hpBorder: 2, name: true, top: 38 }, damageFont: 36, preview: { core: 5, outline: 8, gap: 16 },
  },
  tablet: {
    id: 'tablet', stage: { w: 1024, h: 768 }, field: { x: 0, y: 0, w: v.tablet.w, h: v.tablet.h }, zoom: v.tablet.zoom,
    tag: { font: 15, hpW: 84, hpH: 10, hpBorder: 2, name: true, top: 40 }, damageFont: 46, preview: { core: 6, outline: 10, gap: 19 },
  },
  phone: {
    id: 'phone', stage: { w: 844, h: 390 }, field: { x: 0, y: 0, w: v.phone.w, h: v.phone.h }, zoom: v.phone.zoom,
    tag: { font: 0, hpW: 86, hpH: 14, hpBorder: 3, name: false, top: 20 }, damageFont: 60, preview: { core: 7, outline: 12, gap: 21 },
  },
};

/** Smallest stage scale a bigger layout may render at before we fall back to a smaller one. */
export const MIN_LAYOUT_SCALE = 0.7;

const fitScale = (id: LayoutId, w: number, h: number): number => Math.min(w / LAYOUTS[id].stage.w, h / LAYOUTS[id].stage.h);

/**
 * DESIGN_SPEC §0: width ≥ 1200 → desktop; ≥ 900 → tablet; else phone — and a bigger layout is used only if it still
 * renders at ≥ MIN_LAYOUT_SCALE. Phones in landscape are often ~915×360 CSS px: wide enough for "tablet" by width,
 * but the 1024×768 tablet stage would shrink to ~47%; the 844×390 phone layout fits at ~92%.
 */
export function pickLayout(w: number, h: number): LayoutId {
  if (w >= 1200 && fitScale('desktop', w, h) >= MIN_LAYOUT_SCALE) return 'desktop';
  if (w >= 900 && fitScale('tablet', w, h) >= MIN_LAYOUT_SCALE) return 'tablet';
  return 'phone';
}
