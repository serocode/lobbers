// Hot-seat (dev harness) cosmetic presets per team, so every trail / explosion / skin / weapon skin
// can be seen in a real hot-seat match (Hot Seat ignores the profile). Local only.
import { COSMETICS, DEFAULT_LOADOUT, type CosmeticLoadout, type MachineId } from '@lobbers/shared';

export type PresetId = 'default' | 'embers' | 'bubbles' | 'pixel' | 'rainbow' | 'stars';

const allSkins = (): CosmeticLoadout['skins'] => {
  const out: CosmeticLoadout['skins'] = {};
  for (const c of COSMETICS) if (c.slot === 'skin' && !out[c.machine as MachineId]) out[c.machine] = c.id;
  return out;
};
const show = (trail: string, explosion: string, weaponSkin: [string, string], title: string): CosmeticLoadout => ({
  skins: allSkins(), weaponSkins: { [weaponSkin[0]]: weaponSkin[1] }, trail, explosion, title, emotes: ['e-gg', 'e-boom', 'e-nice', 'e-ready'],
});

export const PRESETS: Record<PresetId, { label: string; loadout: CosmeticLoadout }> = {
  default: { label: 'Default', loadout: DEFAULT_LOADOUT },
  embers: { label: 'Ember Sparks · Blue Plasma', loadout: show('t-ember', 'b-plasma', ['Explosive', 'w-gild'], 'ti-hill') },
  bubbles: { label: 'Bubble Stream · Confetti Pop', loadout: show('t-bubble', 'b-confetti', ['Cluster', 'w-pump'], 'ti-wind') },
  pixel: { label: 'Pixel Dash · Pixel Burst', loadout: show('t-pixel', 'b-pixel', ['Electric', 'w-circuit'], 'ti-crater') },
  rainbow: { label: 'Rainbow Ribbon · Black Hole', loadout: show('t-rainbow', 'b-hole', ['Ice', 'w-jade'], 'ti-last') },
  stars: { label: 'Starfall · Cherry Blossom', loadout: show('t-star', 'b-sakura', ['Guided', 'w-comet'], 'ti-ff') },
};
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const isPreset = (v: string | null): v is PresetId => !!v && v in PRESETS;
