// Gunbound-style battlefield camera. Pure presentation — the server never reads this.
// The mockup (Battle.dc.html) implements exactly these values; Phaser should too.

export const CAMERA = {
  /** World pixels visible at zoom 1 on desktop (the field above the controls deck). */
  viewport: { desktop: { w: 1440, h: 750, zoom: 1 }, tablet: { w: 1024, h: 560, zoom: 0.8 }, phone: { w: 844, h: 390, zoom: 0.55 } },
  /** The focus point sits this far above a machine's feet so the sky above it (where shots arc) is visible. */
  focusAboveUnit: 120,
  /** Turn start / impact / "look at" pans. */
  panMs: 900,
  panEasing: 'cubic-bezier(.3,.8,.3,1)',  // Phaser: 'Cubic.easeInOut'
  /** While a shot flies the camera chases it with this per-sample lerp (≈ Phaser startFollow lerp 0.12 at 60 fps). */
  followLerp: 0.22,
  /** Hold on the explosion before panning to the next player. */
  holdOnImpactMs: 1500,
  /** Background layer scroll factor (parallax). Terrain/units = 1. */
  parallaxBack: 0.6,
  /** Match intro: whole-map overview, then fly in to the first player. */
  introOverviewMs: 1300,
  /** Pointer drag must move this far before it pans (so taps still work). */
  dragThresholdPx: 5,
  /** Zoom levels: 1 (play) and 'fit' (whole world letterboxed). Toggle with Z or the overview button. */
  zoomLevels: [1, 'fit'] as const,
  /** Off-screen marker for the active machine: kept this far inside the viewport edges. */
  edgeMarkerInset: { x: 60, top: 150, bottom: 30 },
  /** Minimap: top-right, under the log button; width in px, height follows the map aspect. */
  minimap: { width: 260, right: 14, top: 120 },
} as const;

/** Camera scroll that centres world point (x, y) at zoom z, clamped to the world. */
export function cameraFor(x: number, y: number, z: number, view: { w: number; h: number }, world: { width: number; height: number }): { x: number; y: number } {
  const cx = x - view.w / (2 * z);
  const cy = y - view.h / (2 * z) + 60 / z;
  return {
    x: Math.max(0, Math.min(Math.max(0, world.width - view.w / z), cx)),
    y: Math.max(0, Math.min(Math.max(0, world.height - view.h / z), cy)),
  };
}

/** Zoom that fits the whole world in the viewport. */
export const fitZoom = (view: { w: number; h: number }, world: { width: number; height: number }): number => Math.min(view.w / world.width, view.h / world.height);
