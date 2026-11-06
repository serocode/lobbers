// Client-only UI state: battle overlays (not synced) and persisted player settings.
import { create } from 'zustand';
import { DEFAULT_PROFILE_SETTINGS, type GraphicsQuality, type ProfileSettings, type WeaponCategory } from '@lobbers/shared';
import { useProfile } from './profile';

export type ArmoryTab = 'All' | WeaponCategory;

export interface BattleUi {
  armoryOpen: boolean;
  armoryTab: ArmoryTab;
  paused: boolean;
  confirmLeave: boolean;
  logOpen: boolean;
  sheetOpen: boolean;
  emoteOpen: boolean;
  set: (p: Partial<Omit<BattleUi, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const uiDefaults = { armoryOpen: false, armoryTab: 'All' as ArmoryTab, paused: false, confirmLeave: false, logOpen: true, sheetOpen: false, emoteOpen: false };
export const useBattleUi = create<BattleUi>((set) => ({ ...uiDefaults, set: (p) => set(p), reset: () => set(uiDefaults) }));

export type { GraphicsQuality } from '@lobbers/shared';

/** Player settings (Home → Settings, battle pause menu) — `profile.settings` in the local profile. */
export interface Settings extends ProfileSettings {
  set: (p: Partial<ProfileSettings>) => void;
}

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults = (): ProfileSettings => ({ ...DEFAULT_PROFILE_SETTINGS, screenShake: DEFAULT_PROFILE_SETTINGS.screenShake && !reducedMotion });

/** Mirrors `profile.settings` (no profile yet → defaults); `set` saves through the profile. */
export const useSettings = create<Settings>((set) => ({
  ...defaults(),
  set: (p) => {
    set(p);
    useProfile.getState().update((prof) => ({ ...prof, settings: { ...prof.settings, ...p } }));
  },
}));
useProfile.subscribe((st, prev) => {
  if (st.profile?.settings && st.profile.settings !== prev.profile?.settings) useSettings.setState({ ...st.profile.settings });
});

/** Canvas density cap per graphics setting. */
export const DENSITY_CAP: Record<GraphicsQuality, number> = { low: 1, medium: 1.5, high: 2 };
