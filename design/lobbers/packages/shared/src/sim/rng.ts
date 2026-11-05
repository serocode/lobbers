/** Seeded PRNG (mulberry32). The SERVER owns randomness (wind, damage variance);
 *  clients never roll anything that affects outcomes. */
export interface Rng { next(): number; int(min: number, max: number): number; state(): number }

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => s,
  };
}

/** An Rng that always returns the midpoint — used by previews and tests that need no variance. */
export const NO_VARIANCE: Rng = { next: () => 0.5, int: (a, b) => Math.round((a + b) / 2), state: () => 0 };
