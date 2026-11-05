// Small synthesis helpers: enveloped oscillators and filtered noise bursts on a bus.
import type { Buses } from './engine';

export interface Tone { freq: number; to?: number; type?: OscillatorType; at?: number; dur: number; gain: number; attack?: number }

export function tone(b: Buses, out: AudioNode, t: Tone): void {
  const { ctx } = b;
  const start = ctx.currentTime + (t.at ?? 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, t.to), start + t.dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(t.gain, start + (t.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + t.dur + 0.05);
}

export interface Noise { at?: number; dur: number; gain: number; type?: BiquadFilterType; freq: number; to?: number; q?: number }

export function noise(b: Buses, out: AudioNode, n: Noise): void {
  const { ctx } = b;
  const start = ctx.currentTime + (n.at ?? 0);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = b.noise;
  src.loop = true;
  f.type = n.type ?? 'lowpass';
  f.frequency.setValueAtTime(n.freq, start);
  if (n.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, n.to), start + n.dur);
  f.Q.value = n.q ?? 0.8;
  g.gain.setValueAtTime(n.gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
  src.connect(f).connect(g).connect(out);
  src.start(start, Math.random() * 0.5);
  src.stop(start + n.dur + 0.05);
}
