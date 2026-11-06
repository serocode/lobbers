// Layout + stage scaling for real devices (DESIGN_SPEC §0 Stage; DECISIONS: phone sizing).
import { describe, expect, it } from 'vitest';
import { stageScale } from '../app/Stage';
import { pickLayout } from './layouts';

describe('pickLayout', () => {
  it('keeps the spec widths on roomy screens', () => {
    expect(pickLayout(1440, 900)).toBe('desktop');
    expect(pickLayout(1280, 720)).toBe('desktop');
    expect(pickLayout(1024, 768)).toBe('tablet');
    expect(pickLayout(844, 390)).toBe('phone');
  });
  it('phones in landscape get the phone layout even when wider than 900 (Galaxy A54 ≈ 915×360)', () => {
    expect(pickLayout(915, 360)).toBe('phone');
    expect(pickLayout(915, 412)).toBe('phone');   // fullscreen
    expect(pickLayout(932, 430)).toBe('phone');   // big iPhone
    expect(pickLayout(1280, 500)).toBe('phone');  // very short desktop window
  });
  it('a short laptop window falls back to tablet before phone', () => {
    expect(pickLayout(1366, 600)).toBe('tablet');
  });
});

describe('stageScale', () => {
  it('menus fit the whole 1440×900 artboard on normal screens', () => {
    expect(stageScale(1440, 900, 1440, 900, 'auto')).toEqual({ scale: 1, scroll: false });
    expect(stageScale(1280, 650, 1440, 900, 'auto').scroll).toBe(false);
  });
  it('menus on a landscape phone fit the width and scroll instead of shrinking to the height', () => {
    const r = stageScale(915, 360, 1440, 900, 'auto');
    expect(r.scroll).toBe(true);
    expect(r.scale).toBeCloseTo(915 / 1440, 4);   // 0.64 instead of 0.40
  });
  it('the battle never scrolls', () => {
    expect(stageScale(915, 360, 844, 390, 'contain')).toEqual({ scale: 360 / 390, scroll: false });
  });
});
