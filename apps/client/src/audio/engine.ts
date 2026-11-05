// WebAudio engine: one AudioContext, master → music / sfx buses with the Settings volumes.
// Browsers start audio only after a user gesture, so the context is created/resumed on the first
// pointer or key press. Everything is synthesised in code (src/audio) — no third-party audio files.
import { useSettings } from '../state/uiStores';

export interface Buses { ctx: AudioContext; master: GainNode; music: GainNode; sfx: GainNode; noise: AudioBuffer }

let buses: Buses | null = null;
let unlocked = false;
const waiters: Array<(b: Buses) => void> = [];

const level = (v: number): number => Math.pow(Math.max(0, Math.min(100, v)) / 100, 2);

function applyVolumes(b: Buses): void {
  const s = useSettings.getState();
  const t = b.ctx.currentTime;
  b.master.gain.setTargetAtTime(level(s.masterVolume), t, 0.05);
  b.music.gain.setTargetAtTime(level(s.musicVolume) * 0.55, t, 0.05);
  b.sfx.gain.setTargetAtTime(level(s.sfxVolume), t, 0.05);
}

function create(): Buses | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain(), music = ctx.createGain(), sfx = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  music.connect(master); sfx.connect(master); master.connect(comp); comp.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  const b = { ctx, master, music, sfx, noise };
  applyVolumes(b);
  useSettings.subscribe(() => applyVolumes(b));
  return b;
}

/** Call once at app start: unlocks audio on the first gesture. */
export function installAudioUnlock(): void {
  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    buses ??= create();
    if (!buses) return;
    void buses.ctx.resume();
    for (const w of waiters.splice(0)) w(buses);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** DEV-only counters (Playwright checks that sounds actually play). */
export const audioStats = { sfx: 0, musicSteps: 0, track: '' as string };
if (import.meta.env.DEV) (window as unknown as { __lobbersAudio?: () => object }).__lobbersAudio = () => ({ state: buses?.ctx.state ?? 'locked', ...audioStats });

/** The engine if audio is unlocked (sound effects before the first gesture are simply skipped). */
export const audio = (): Buses | null => (unlocked ? buses : null);

/** Runs `fn` as soon as audio is unlocked (music start). */
export function whenAudio(fn: (b: Buses) => void): void {
  if (unlocked && buses) fn(buses);
  else waiters.push(fn);
}
