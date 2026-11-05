// Two synthesised loops (Phase 3): a relaxed menu groove and a driving battle loop. A small
// look-ahead scheduler (25 ms tick, 120 ms window) keeps timing tight; volume = Settings → Music.
import { audioStats, whenAudio, type Buses } from './engine';
import { noise, tone } from './synth';

export type Track = 'menu' | 'battle' | null;

interface Song { bpm: number; chords: number[][]; bass: number[]; drums: boolean; lead: number }

// Chords as MIDI notes, one per bar (4 bars); bass = root per bar. Pentatonic, cheerful, cartoonish.
const SONGS: Record<'menu' | 'battle', Song> = {
  menu: { bpm: 96, chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], bass: [36, 33, 41, 43], drums: false, lead: 0.035 },
  battle: { bpm: 132, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bass: [33, 29, 31, 28], drums: true, lead: 0.03 },
};

const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

let current: Track = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextAt = 0;

function scheduleStep(b: Buses, song: Song, s: number, at: number): void {
  audioStats.musicSteps++;
  const bar = Math.floor(s / 16) % 4, beat = s % 16;
  const chord = song.chords[bar], sixteenth = 60 / song.bpm / 4;
  const delay = at - b.ctx.currentTime;
  if (beat % 4 === 0) tone(b, b.music, { freq: hz(song.bass[bar]), type: 'triangle', dur: sixteenth * 3.5, gain: 0.22, at: delay });
  if (beat % 2 === 0) {
    const n = chord[(beat / 2) % chord.length] + 12;
    tone(b, b.music, { freq: hz(n), type: 'square', dur: sixteenth * 1.4, gain: song.lead, at: delay });
  }
  if (beat === 0 || beat === 8) for (const n of chord) tone(b, b.music, { freq: hz(n), type: 'sine', dur: sixteenth * 7, gain: 0.04, at: delay, attack: 0.05 });
  if (song.drums) {
    if (beat % 4 === 0) tone(b, b.music, { freq: 120, to: 40, dur: 0.18, gain: 0.35, at: delay });
    if (beat === 4 || beat === 12) noise(b, b.music, { at: delay, dur: 0.14, gain: 0.25, type: 'bandpass', freq: 1800, q: 0.7 });
    if (beat % 2 === 1) noise(b, b.music, { at: delay, dur: 0.04, gain: 0.08, type: 'highpass', freq: 7000 });
  }
}

/** Switch loops (null = silence). Starts after the first user gesture if audio is still locked. */
export function playMusic(track: Track): void {
  if (track === current) return;
  current = track;
  audioStats.track = track ?? '';
  if (timer) { clearInterval(timer); timer = null; }
  if (!track) return;
  whenAudio((b) => {
    if (current !== track || timer) return;
    const song = SONGS[track];
    step = 0;
    nextAt = b.ctx.currentTime + 0.1;
    timer = setInterval(() => {
      const sixteenth = 60 / song.bpm / 4;
      while (nextAt < b.ctx.currentTime + 0.12) { scheduleStep(b, song, step++, nextAt); nextAt += sixteenth; }
    }, 25);
  });
}
