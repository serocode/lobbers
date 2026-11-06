import { describe, expect, it } from 'vitest';
import { memoryStore, PROFILE_KEY, type KeyValueStore } from '@lobbers/shared';
import { setBackingStore, useProfile } from './profile';
import { useSettings } from './uiStores';

const throwing: KeyValueStore = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('local profile store (DESIGN_SPEC §3.7, DATA_MODEL)', () => {
  it('first run → create → reload keeps level, coins, history and settings', () => {
    const disk = memoryStore();
    setBackingStore(disk);
    useProfile.getState().init();
    expect(useProfile.getState().status).toBe('needsName');
    useProfile.getState().create('Kaboomerang', 'mollusk');
    expect(useProfile.getState().storageOk).toBe(true);
    useProfile.getState().update((p) => ({ ...p, level: 7, coins: 1234 }));
    useSettings.getState().set({ musicVolume: 12, graphics: 'low' });
    setBackingStore(disk);           // "reload"
    useProfile.getState().init();
    const p = useProfile.getState().profile;
    expect(useProfile.getState().status).toBe('ready');
    expect([p?.name, p?.level, p?.coins, p?.favoriteMachine]).toEqual(['Kaboomerang', 7, 1234, 'mollusk']);
    expect(p?.settings.musicVolume).toBe(12);
    expect(useSettings.getState().graphics).toBe('low');
  });

  it('a corrupt save is quarantined and the first-run flow shows again', () => {
    const disk = memoryStore({ [PROFILE_KEY]: '{"v":1,"id":' });
    setBackingStore(disk);
    useProfile.getState().init();
    expect(useProfile.getState().status).toBe('needsName');
    expect(disk.getItem(`${PROFILE_KEY}:corrupt`)).toBe('{"v":1,"id":');
  });

  it('blocked / full storage: the game still starts, the profile lives in memory, Home warns', () => {
    setBackingStore(throwing);
    useProfile.getState().init();
    expect(useProfile.getState().status).toBe('needsName');
    useProfile.getState().create('Privateer', 'thumper');
    expect(useProfile.getState().status).toBe('ready');
    expect(useProfile.getState().storageOk).toBe(false);
    useProfile.getState().update((p) => ({ ...p, coins: p.coins + 50 }));
    expect(useProfile.getState().profile?.coins).toBe(550);
  });
});
