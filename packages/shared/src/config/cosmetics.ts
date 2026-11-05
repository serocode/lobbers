// Cosmetics shown in matches (Inventory.dc.html categories: Machine Skins, Weapon Skins, Projectile
// Trails, Explosion Effects, Emotes, Titles). Ids, names, rarities and copy come from the mockup.
// Cosmetics never change the simulation. Machine unlocks and avatars are Inventory (Phase 4) concerns.
import type { MachineId, WeaponCategory } from '../types.ts';

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type TrailStyle = 'smoke' | 'sparks' | 'bubbles' | 'dash' | 'rainbow' | 'stars';
export type ExplosionStyle = 'classic' | 'confetti' | 'plasma' | 'pixel' | 'sakura' | 'blackhole';

/** How an item is obtained. Guests own every `default` item until accounts and the store arrive (Phase 4). */
export type Unlock = { kind: 'default' } | { kind: 'coins' | 'gems'; price: number } | { kind: 'requirement'; text: string };

interface Base { id: string; name: string; rarity: Rarity; description: string; bg: string; unlock: Unlock }
export type CosmeticItem =
  | (Base & { slot: 'skin'; machine: MachineId; paint: string })
  | (Base & { slot: 'weaponSkin'; category: WeaponCategory; color: string })
  | (Base & { slot: 'trail'; style: TrailStyle; color: string })
  | (Base & { slot: 'explosion'; style: ExplosionStyle; color: string })
  | (Base & { slot: 'emote'; text: string })
  | (Base & { slot: 'title' });
export type CosmeticSlot = CosmeticItem['slot'];

const def: Unlock = { kind: 'default' };
const req = (text: string): Unlock => ({ kind: 'requirement', text });
const coins = (price: number): Unlock => ({ kind: 'coins', price });
const gems = (price: number): Unlock => ({ kind: 'gems', price });

export const COSMETICS: CosmeticItem[] = [
  // Machine skins (paint replaces the body colour)
  { id: 's-arctic', slot: 'skin', machine: 'thumper', paint: '#B9C7A0', name: 'Arctic Camo Thumper', rarity: 'Rare', bg: '#2E3A2A', description: 'Sage-and-frost plating that hides you nicely on Glacier Rift. Nicely.', unlock: req('Season 3 pass, level 12') },
  { id: 's-ash', slot: 'skin', machine: 'cinder', paint: '#6E5A60', name: 'Ashfall Cinder', rarity: 'Epic', bg: '#2A1A1E', description: 'Soot-black furnace plating with a cooled-lava sheen.', unlock: req('Season event reward') },
  { id: 's-neon', slot: 'skin', machine: 'sprocket', paint: '#39E59A', name: 'Neon Sprocket', rarity: 'Rare', bg: '#123A2C', description: 'Glow-in-the-dark bodywork for night maps.', unlock: req('50 wins with Sprocket') },
  { id: 's-coral', slot: 'skin', machine: 'mollusk', paint: '#FF8A7A', name: 'Coral Mollusk', rarity: 'Rare', bg: '#4A2626', description: 'A reef-pink shell. Same tungsten, friendlier colour.', unlock: coins(1200) },
  { id: 's-thunder', slot: 'skin', machine: 'voltaic', paint: '#7C88C2', name: 'Thunderhead Voltaic', rarity: 'Epic', bg: '#252A48', description: 'Storm-cloud plating with crackling copper coils.', unlock: gems(300) },
  { id: 's-midnight', slot: 'skin', machine: 'boomba', paint: '#3A4466', name: 'Midnight Boomba', rarity: 'Legendary', bg: '#1A1E34', description: 'The classic cartoon bomb, finally in its true colours.', unlock: req('Season 4 pass · level 50') },
  { id: 's-gild', slot: 'skin', machine: 'thumper', paint: '#E8C25A', name: 'Gilded Thumper', rarity: 'Legendary', bg: '#3E3418', description: 'Solid-gold siege plating for players who never miss. Or say so.', unlock: req('Reach Gold I rank') },
  // Weapon skins (shell colour for every weapon in that Armory category)
  { id: 'w-gild', slot: 'weaponSkin', category: 'Explosive', color: '#E8C25A', name: 'Gilded Shell', rarity: 'Legendary', bg: '#3E3418', description: 'Your explosive shells, but make it treasure.', unlock: req('Season 2 top 500') },
  { id: 'w-candy', slot: 'weaponSkin', category: 'Explosive', color: '#FF7EB6', name: 'Candy Stripe Mortar', rarity: 'Rare', bg: '#4A2440', description: 'Pink-and-white striped explosive rounds.', unlock: req('Daily login streak 30') },
  { id: 'w-pump', slot: 'weaponSkin', category: 'Cluster', color: '#F28C38', name: 'Pumpkin Bomb', rarity: 'Epic', bg: '#4A2E1E', description: 'Cluster bomblets carved like tiny pumpkins.', unlock: req('Event: Harvest Havoc 2026') },
  { id: 'w-circuit', slot: 'weaponSkin', category: 'Electric', color: '#5ACB91', name: 'Circuit Bolt', rarity: 'Epic', bg: '#1E3E33', description: 'Lightning shells with a green circuit-board glow.', unlock: gems(250) },
  { id: 'w-jade', slot: 'weaponSkin', category: 'Ice', color: '#6EE0B0', name: 'Jade Spear', rarity: 'Rare', bg: '#1E3E33', description: 'Ice shells carved from polished jade.', unlock: coins(900) },
  { id: 'w-comet', slot: 'weaponSkin', category: 'Guided', color: '#8FE3FF', name: 'Comet Hornet', rarity: 'Rare', bg: '#1B3A48', description: 'A guided missile with a comet tail.', unlock: req('Mission: 20 guided hits') },
  // Projectile trails
  { id: 't-smoke', slot: 'trail', style: 'smoke', color: '#A9B3CC', name: 'Smoke Ring', rarity: 'Common', bg: '#2A3045', description: 'The default puff of grey smoke.', unlock: def },
  { id: 't-ember', slot: 'trail', style: 'sparks', color: '#FF8A3D', name: 'Ember Sparks', rarity: 'Epic', bg: '#4A221C', description: 'Your shots leave a fizzing streak of embers.', unlock: req('Season 3 pass, level 40') },
  { id: 't-bubble', slot: 'trail', style: 'bubbles', color: '#8FE3FF', name: 'Bubble Stream', rarity: 'Rare', bg: '#1B3A48', description: 'A wobbly trail of soap bubbles.', unlock: req('200 matches played') },
  { id: 't-pixel', slot: 'trail', style: 'dash', color: '#5ACB91', name: 'Pixel Dash', rarity: 'Rare', bg: '#1E3E33', description: 'Chunky retro dashes behind every shot.', unlock: coins(600) },
  { id: 't-rainbow', slot: 'trail', style: 'rainbow', color: '#FF7EB6', name: 'Rainbow Ribbon', rarity: 'Legendary', bg: '#4A2440', description: 'A shimmering ribbon that cycles colours mid-flight.', unlock: gems(1500) },
  { id: 't-star', slot: 'trail', style: 'stars', color: '#FFD166', name: 'Starfall', rarity: 'Epic', bg: '#3E3820', description: 'Twinkling stars that linger after the shot lands.', unlock: req('Win 10 matches on Glacier Rift') },
  // Explosion effects
  { id: 'b-classic', slot: 'explosion', style: 'classic', color: '#FFB547', name: 'Classic Kaboom', rarity: 'Common', bg: '#4A2E1E', description: 'Orange fireball. Timeless.', unlock: def },
  { id: 'b-confetti', slot: 'explosion', style: 'confetti', color: '#FF7EB6', name: 'Confetti Pop', rarity: 'Legendary', bg: '#4A2440', description: 'Every impact is a party. The crater is still very real.', unlock: req('Season 3 top 1,000') },
  { id: 'b-plasma', slot: 'explosion', style: 'plasma', color: '#4C9AFF', name: 'Blue Plasma', rarity: 'Epic', bg: '#1E2D4E', description: 'A crackling sphere of blue plasma.', unlock: gems(400) },
  { id: 'b-pixel', slot: 'explosion', style: 'pixel', color: '#5ACB91', name: 'Pixel Burst', rarity: 'Rare', bg: '#1E3E33', description: 'An 8-bit explosion with square debris.', unlock: coins(800) },
  { id: 'b-sakura', slot: 'explosion', style: 'sakura', color: '#FFB3D1', name: 'Cherry Blossom', rarity: 'Epic', bg: '#4A2440', description: 'A soft burst of petals drifting on the wind.', unlock: gems(400) },
  { id: 'b-hole', slot: 'explosion', style: 'blackhole', color: '#B07CF2', name: 'Black Hole', rarity: 'Legendary', bg: '#33264E', description: 'The blast collapses inward before it detonates.', unlock: req('Reach Platinum rank') },
  // Emotes (speech bubbles over your machine)
  { id: 'e-gg', slot: 'emote', text: 'GG, well lobbed!', name: 'GG, well lobbed!', rarity: 'Common', bg: '#2A3045', description: 'The polite post-match classic.', unlock: def },
  { id: 'e-oops', slot: 'emote', text: 'Oops.', name: 'Oops.', rarity: 'Common', bg: '#2A3045', description: 'For friendly fire. Use often.', unlock: def },
  { id: 'e-nice', slot: 'emote', text: 'Nice shot!', name: 'Nice shot!', rarity: 'Common', bg: '#2A3045', description: 'Even when it hit you.', unlock: def },
  { id: 'e-wind', slot: 'emote', text: 'Wind?!', name: 'Wind?!', rarity: 'Rare', bg: '#1E2D4E', description: 'Blame the weather, not the aim.', unlock: def },
  { id: 'e-boom', slot: 'emote', text: 'KABOOM!', name: 'KABOOM!', rarity: 'Epic', bg: '#4A2E1E', description: 'Shakes the speech bubble on send.', unlock: gems(200) },
  { id: 'e-ready', slot: 'emote', text: 'Ready when you are', name: 'Ready when you are', rarity: 'Rare', bg: '#1E2D4E', description: 'A lobby favourite for impatient hosts.', unlock: coins(600) },
  // Titles (lobby slot, results)
  { id: 'ti-rookie', slot: 'title', name: 'Rookie', rarity: 'Common', bg: '#2A3045', description: 'Everyone starts somewhere.', unlock: def },
  { id: 'ti-hill', slot: 'title', name: 'Hill Breaker', rarity: 'Rare', bg: '#2A3045', description: 'Destroy 10,000 px of terrain in a single match.', unlock: req('Achievement reward') },
  { id: 'ti-wind', slot: 'title', name: 'Wind Whisperer', rarity: 'Epic', bg: '#1E2D4E', description: 'Land a hit in wind 10 or stronger.', unlock: req('Achievement reward') },
  { id: 'ti-crater', slot: 'title', name: 'Crater Maker', rarity: 'Rare', bg: '#4A2E1E', description: 'Destroy 50,000 px of terrain overall.', unlock: req('Achievement reward') },
  { id: 'ti-last', slot: 'title', name: 'Last Lobber Standing', rarity: 'Legendary', bg: '#3E3418', description: 'Win as the last machine alive on your team.', unlock: req('Achievement reward') },
  { id: 'ti-ff', slot: 'title', name: 'Friendly Fire Expert', rarity: 'Rare', bg: '#4A2440', description: 'Hit teammates 10 times.', unlock: req('Hit teammates 10 times') },
];

export const COSMETIC_BY_ID: Record<string, CosmeticItem> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const RARITY_COLOR: Record<Rarity, string> = { Common: '#A9B3CC', Rare: '#4C9AFF', Epic: '#B07CF2', Legendary: '#FFD166' };

/** What a player has equipped (sent on lobby join; validated by the server against what they own). */
export interface CosmeticLoadout {
  skins: Partial<Record<MachineId, string>>;
  weaponSkins: Partial<Record<WeaponCategory, string>>;
  trail: string;
  explosion: string;
  title: string;
  emotes: string[];
}

export const EMOTE_SLOTS = 4;
export const DEFAULT_LOADOUT: CosmeticLoadout = { skins: {}, weaponSkins: {}, trail: 't-smoke', explosion: 'b-classic', title: 'ti-rookie', emotes: ['e-gg', 'e-oops', 'e-nice', 'e-wind'] };
/** Items every player owns. */
export const DEFAULT_ITEMS: string[] = COSMETICS.filter((c) => c.unlock.kind === 'default').map((c) => c.id);

const ofSlot = <S extends CosmeticSlot>(id: unknown, slot: S, owned: ReadonlySet<string>): Extract<CosmeticItem, { slot: S }> | null => {
  if (typeof id !== 'string' || !owned.has(id)) return null;
  const c = COSMETIC_BY_ID[id];
  return c && c.slot === slot ? (c as Extract<CosmeticItem, { slot: S }>) : null;
};

/** Keeps only owned items in the right slots; anything else falls back to the default. Never throws. */
export function sanitizeLoadout(raw: unknown, owned: ReadonlySet<string>): CosmeticLoadout {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof CosmeticLoadout, unknown>>;
  const skins: CosmeticLoadout['skins'] = {};
  if (typeof o.skins === 'object' && o.skins !== null) {
    for (const [m, id] of Object.entries(o.skins)) { const c = ofSlot(id, 'skin', owned); if (c && c.machine === m) skins[c.machine] = c.id; }
  }
  const weaponSkins: CosmeticLoadout['weaponSkins'] = {};
  if (typeof o.weaponSkins === 'object' && o.weaponSkins !== null) {
    for (const [cat, id] of Object.entries(o.weaponSkins)) { const c = ofSlot(id, 'weaponSkin', owned); if (c && c.category === cat) weaponSkins[c.category] = c.id; }
  }
  const emotes = (Array.isArray(o.emotes) ? o.emotes : []).map((id) => ofSlot(id, 'emote', owned)?.id).filter((x): x is string => !!x);
  const uniq = [...new Set(emotes)].slice(0, EMOTE_SLOTS);
  for (const d of DEFAULT_LOADOUT.emotes) if (uniq.length < EMOTE_SLOTS && !uniq.includes(d)) uniq.push(d);
  return {
    skins, weaponSkins,
    trail: ofSlot(o.trail, 'trail', owned)?.id ?? DEFAULT_LOADOUT.trail,
    explosion: ofSlot(o.explosion, 'explosion', owned)?.id ?? DEFAULT_LOADOUT.explosion,
    title: ofSlot(o.title, 'title', owned)?.id ?? DEFAULT_LOADOUT.title,
    emotes: uniq,
  };
}

/** What renderers need for one unit (resolved by the server from a sanitised loadout). */
export interface UnitCosmetics {
  paint: string | null;
  trail: { style: TrailStyle; color: string };
  explosion: { style: ExplosionStyle; color: string };
  /** Shell colour per weapon category (weapon skins). */
  shellColors: Partial<Record<WeaponCategory, string>>;
  title: string;
  emotes: string[];
}

export function resolveCosmetics(l: CosmeticLoadout, machine: MachineId): UnitCosmetics {
  const skin = l.skins[machine] ? COSMETIC_BY_ID[l.skins[machine] as string] : undefined;
  const trail = COSMETIC_BY_ID[l.trail], boom = COSMETIC_BY_ID[l.explosion], title = COSMETIC_BY_ID[l.title];
  const shellColors: UnitCosmetics['shellColors'] = {};
  for (const [cat, id] of Object.entries(l.weaponSkins)) { const c = id ? COSMETIC_BY_ID[id] : undefined; if (c?.slot === 'weaponSkin') shellColors[c.category] = c.color; }
  return {
    paint: skin?.slot === 'skin' ? skin.paint : null,
    trail: trail?.slot === 'trail' ? { style: trail.style, color: trail.color } : { style: 'smoke', color: '#A9B3CC' },
    explosion: boom?.slot === 'explosion' ? { style: boom.style, color: boom.color } : { style: 'classic', color: '#FFB547' },
    shellColors,
    title: title?.name ?? 'Rookie',
    emotes: l.emotes.filter((id) => COSMETIC_BY_ID[id]?.slot === 'emote'),
  };
}

export const DEFAULT_COSMETICS: UnitCosmetics = resolveCosmetics(DEFAULT_LOADOUT, 'thumper');
