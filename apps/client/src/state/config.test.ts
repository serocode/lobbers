import { describe, expect, it } from 'vitest';
import { MACHINE_LIST, ROOM_LIMITS } from '@lobbers/shared';
import { decodeLocalConfig, encodeLocalConfig, seatsFor, DEFAULT_LOCAL } from './localMatchConfig';
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
  it('seats every player in slot order per team', () => {
    const seats = seatsFor({ ...DEFAULT_LOCAL, red: ['thumper', 'voltaic'], blue: ['mollusk'] });
    expect(seats.map((s) => `${s.team}-${s.slot}`)).toEqual(['red-0', 'red-1', 'blue-0']);
    expect(new Set(seats.map((s) => s.playerId)).size).toBe(3);
  });
});

describe('battle controls helpers', () => {
  it('quick slots are 4 distinct loadout weapons for every machine', () => {
    for (const m of MACHINE_LIST) {
      const q = quickSlots(m);
      expect(q).toHaveLength(4);
      expect(new Set(q).size).toBe(4);
      for (const w of q) expect(m.loadout).toContain(w);
    }
  });
  it('elevation mirrors on the left side', () => {
    expect(elevationOf(30)).toBe(30);
    expect(elevationOf(150)).toBe(30);
    expect(elevationOf(90)).toBe(90);
  });
});
