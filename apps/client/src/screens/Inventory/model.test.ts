import { describe, expect, it } from 'vitest';
import { createProfile, toPeerProfile, type LocalProfile } from '@lobbers/shared';
import { actOn, inventory, type InvItem } from './model';

const fresh = (): LocalProfile => createProfile('Tester', 'me', 0);
const find = (p: LocalProfile, id: string): InvItem => {
  for (const c of inventory(p)) { const it = c.items.find((x) => x.id === id); if (it) return it; }
  throw new Error(`no item ${id}`);
};
const run = (p: LocalProfile, id: string, cmd: Parameters<typeof actOn>[2] = { t: 'main' }): LocalProfile => {
  const r = actOn(p, find(p, id), cmd);
  if (!r.ok) throw new Error(r.reason);
  return r.value.profile;
};

describe('inventory model', () => {
  it('8 categories, 53 items like the mockup; a new player owns the starters and defaults', () => {
    const cats = inventory(fresh());
    expect(cats.map((c) => c.name)).toEqual(['Battle Machines', 'Machine Skins', 'Weapon Skins', 'Projectile Trails', 'Explosion Effects', 'Avatars', 'Emotes', 'Titles']);
    expect(cats.reduce((n, c) => n + c.items.length, 0)).toBe(53);
    const m = cats[0].items;
    expect(m.filter((x) => x.owned).map((x) => x.id)).toEqual(['machine:thumper', 'machine:sprocket', 'machine:mollusk', 'machine:voltaic', 'machine:cinder']);
    expect(find(fresh(), 'machine:thumper').action).toEqual({ kind: 'equipped' });
  });

  it('Frostbite: NOT ENOUGH → buy with coins → owned, its avatar unlocks with it', () => {
    let p = fresh();
    expect(find(p, 'machine:frostbite').action).toEqual({ kind: 'buy', currency: 'coins', price: 6000, afford: false });
    expect(actOn(p, find(p, 'machine:frostbite'), { t: 'main' })).toEqual({ ok: false, reason: 'not enough currency' });
    p = run({ ...p, coins: 6500 }, 'machine:frostbite');
    expect(p.coins).toBe(500);
    expect(find(p, 'machine:frostbite').action).toEqual({ kind: 'equip' });
    expect(find(p, 'avatar:frostbite').owned).toBe(true);
    p = run(p, 'machine:frostbite');
    expect(p.favoriteMachine).toBe('frostbite');
  });

  it('requirement items show progress, then unlock for free once met', () => {
    let p = fresh();
    expect(find(p, 'machine:whirligig').source).toBe('Unlock: Reach level 40 (1 / 40)');
    expect(find(p, 'machine:whirligig').action.kind).toBe('locked');
    p = { ...p, level: 40 };
    expect(find(p, 'machine:whirligig').action.kind).toBe('unlock');
    p = run(p, 'machine:whirligig');
    expect(find(p, 'machine:whirligig').owned).toBe(true);
  });

  it('equip / unequip: skins come off, trails fall back to the default, avatars travel in the hello profile', () => {
    let p = { ...fresh(), owned: [...fresh().owned, 's-neon', 't-rainbow'] };
    p = run(p, 's-neon');
    expect(p.equipped['skin:sprocket']).toBe('s-neon');
    p = run(p, 's-neon', { t: 'unequip' });
    expect(p.equipped['skin:sprocket']).toBeUndefined();
    p = run(p, 't-rainbow');
    expect(find(p, 't-rainbow').canUnequip).toBe(true);
    p = run(p, 't-rainbow', { t: 'unequip' });
    expect(p.equipped.trail).toBe('t-smoke');
    expect(find(p, 't-smoke').canUnequip).toBe(false);
    p = run(p, 'avatar:mollusk');
    expect(toPeerProfile(p).avatar).toBe('avatar:mollusk');
    expect(find(p, 'avatar:boomba').action.kind).toBe('locked');
  });

  it('emotes go into a chosen wheel slot', () => {
    let p = { ...fresh(), owned: [...fresh().owned, 'e-boom'] };
    p = run(p, 'e-boom', { t: 'main', emoteSlot: 'emote:3' });
    expect(p.equipped['emote:3']).toBe('e-boom');
    expect(find(p, 'e-boom').equipped).toBe(true);
    expect(find(p, 'e-boom').slot).toBe('emote:3');
  });
});
