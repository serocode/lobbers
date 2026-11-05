// Game sound effects (Phase 3): fire per weapon category, flight whistle, explosion by category/size,
// hit, elimination, turn start, UI click, emote pop. Synthesised — see engine.ts.
import type { WeaponCategory } from '@lobbers/shared';
import { audio, audioStats } from './engine';
import { noise, tone } from './synth';

const play = (fn: (b: NonNullable<ReturnType<typeof audio>>) => void): void => { const b = audio(); if (b) { audioStats.sfx++; fn(b); } };

export const sfx = {
  click(): void { play((b) => tone(b, b.sfx, { freq: 1400, to: 900, type: 'square', dur: 0.05, gain: 0.05 })); },

  fire(cat: WeaponCategory): void {
    play((b) => {
      const o = b.sfx;
      noise(b, o, { dur: 0.22, gain: 0.5, freq: 2400, to: 300 });
      tone(b, o, { freq: 150, to: 55, dur: 0.25, gain: 0.55 });
      if (cat === 'Electric') tone(b, o, { freq: 900, to: 2400, type: 'square', dur: 0.18, gain: 0.08 });
      if (cat === 'Ice') tone(b, o, { freq: 1800, to: 2600, dur: 0.3, gain: 0.08 });
      if (cat === 'Fire') noise(b, o, { dur: 0.45, gain: 0.25, type: 'bandpass', freq: 600, to: 1800, q: 1.2 });
      if (cat === 'Guided') tone(b, o, { freq: 300, to: 900, type: 'sawtooth', dur: 0.35, gain: 0.05 });
      if (cat === 'Cluster') tone(b, o, { freq: 500, to: 260, type: 'triangle', dur: 0.12, gain: 0.15, at: 0.05 });
    });
  },

  /** Falling-shell whistle for the flight time (pitch drops as it comes down). */
  whistle(seconds: number): void {
    const dur = Math.max(0.3, Math.min(6, seconds));
    play((b) => tone(b, b.sfx, { freq: 1500, to: 520, type: 'sine', dur, gain: 0.035, attack: 0.25 }));
  },

  explosion(radius: number, cat: WeaponCategory | 'Barrel'): void {
    const big = Math.min(1.6, Math.max(0.5, radius / 50));
    play((b) => {
      const o = b.sfx;
      noise(b, o, { dur: 0.5 * big + 0.3, gain: 0.7 * Math.min(1, big), freq: 3000, to: 120 });
      tone(b, o, { freq: 90, to: 28, dur: 0.6 * big + 0.2, gain: 0.8 * Math.min(1, big) });
      if (cat === 'Ice') tone(b, o, { freq: 2200, to: 1200, dur: 0.5, gain: 0.07, at: 0.05 });
      if (cat === 'Fire' || cat === 'Barrel') noise(b, o, { at: 0.1, dur: 0.8, gain: 0.2, type: 'bandpass', freq: 900, to: 300 });
      if (cat === 'Electric') noise(b, o, { dur: 0.3, gain: 0.25, type: 'highpass', freq: 4000 });
    });
  },

  bolt(): void { play((b) => { noise(b, b.sfx, { dur: 0.35, gain: 0.45, type: 'highpass', freq: 2500, to: 6000 }); tone(b, b.sfx, { freq: 60, to: 30, dur: 0.4, gain: 0.6 }); }); },
  hit(direct: boolean): void { play((b) => tone(b, b.sfx, { freq: direct ? 220 : 180, to: 90, type: 'triangle', dur: 0.15, gain: direct ? 0.35 : 0.2 })); },
  heal(): void { play((b) => { tone(b, b.sfx, { freq: 660, dur: 0.12, gain: 0.12 }); tone(b, b.sfx, { freq: 990, dur: 0.18, gain: 0.12, at: 0.1 }); }); },

  elimination(): void {
    play((b) => {
      [523, 392, 330, 262].forEach((f, i) => tone(b, b.sfx, { freq: f, type: 'square', dur: 0.14, gain: 0.07, at: i * 0.09 }));
      noise(b, b.sfx, { at: 0.3, dur: 0.6, gain: 0.3, freq: 1200, to: 100 });
    });
  },

  turnStart(mine: boolean): void {
    play((b) => {
      const notes = mine ? [523, 659, 784] : [440, 523];
      notes.forEach((f, i) => tone(b, b.sfx, { freq: f, type: 'triangle', dur: 0.18, gain: mine ? 0.14 : 0.07, at: i * 0.08 }));
    });
  },

  emote(): void { play((b) => tone(b, b.sfx, { freq: 700, to: 1100, type: 'sine', dur: 0.12, gain: 0.12 })); },

  matchEnd(won: boolean): void {
    play((b) => {
      const notes = won ? [523, 659, 784, 1047] : [392, 330, 294, 262];
      notes.forEach((f, i) => tone(b, b.sfx, { freq: f, type: 'square', dur: 0.22, gain: 0.08, at: i * 0.14 }));
    });
  },
};
