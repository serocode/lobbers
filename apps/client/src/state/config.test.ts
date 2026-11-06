import { describe, expect, it } from 'vitest';
import { DEFAULT_QUICK_SLOTS, MACHINE_LIST, ROOM_LIMITS, arsenalFor } from '@lobbers/shared';
import { decodeLocalConfig, encodeLocalConfig, hotSeatSeats, DEFAULT_LOCAL } from './localMatchConfig';
import { elevationOf, quickSlots } from './battleControls';

describe('hot-seat config', () => {
  it('round-trips through the URL', () => {
    const c = { ...DEFAULT_LOCAL, mapId: 'skyreach' as const, red: ['boomba' as const], blue: ['whirligig' as const, 'cinder' as const], seed: 42 };
    const url = encodeLocalConfig(c);
    expect(decodeLocalConfig(new URLSearchParams(url.split('?')[1]))).toEqual(c);
  });
  it('rejects junk and clamps team size', () => {
    const c = decodeLocalConfig(new URLSearchParams('map=nope&red=thumper,x,thumper,thumper,thumper,thumper&blue=&turn=99&wind=hurricane&seed=-3'));
    expect(c.mapId).toBe(DEFAULT_LOCAL.mapId);
    expect(c.red).toHaveLength(ROOM_LIMITS.maxPerTeam);
    expect(c.blue).toEqual(DEFAULT_LOCAL.blue);
    expect(c.turnSeconds).toBe(DEFAULT_LOCAL.turnSeconds);
    expect(c.wind).toBe(DEFAULT_LOCAL.wind);
    expect(c.seed).toBe(DEFAULT_LOCAL.seed);
  });
  it('lists hot-seat seats red then blue with readable names and their team preset', () => {
    const seats = hotSeatSeats({ ...DEFAULT_LOCAL, red: ['thumper', 'voltaic'], blue: ['mollusk'], look: { red: 'embers', blue: 'default' } });
    expect(seats.map((s) => `${s.team}:${s.name}:${s.machine}`)).toEqual(['red:Red 1:thumper', 'red:Red 2:voltaic', 'blue:Blue 1:mollusk']);
    expect(seats[0].cosmetics.trail).toBe('t-ember');
    expect(seats[2].cosmetics.trail).toBe('t-smoke');
  });
});

describe('battle controls helpers', () => {
  it('quick slots are 4 distinct usable weapons for every machine (Items Off and On)', () => {
    for (const m of MACHINE_LIST) {
      for (const items of [false, true]) {
        const arsenal = arsenalFor(m.loadout, items);
        const q = quickSlots(arsenal);
        expect(q).toHaveLength(4);
        expect(new Set(q).size).toBe(4);
        for (const w of q) expect(arsenal).toContain(w);
      }
      expect(quickSlots(arsenalFor(m.loadout, true))).toEqual(DEFAULT_QUICK_SLOTS);
    }
  });
  it('elevation mirrors on the left side', () => {
    expect(elevationOf(30)).toBe(30);
    expect(elevationOf(150)).toBe(30);
    expect(elevationOf(90)).toBe(90);
  });
});
