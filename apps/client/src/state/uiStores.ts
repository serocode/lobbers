// Client-only UI state: battle overlays (not synced) and persisted player settings.
import { create } from 'zustand';
import type { WeaponCategory } from '@lobbers/shared';

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

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface Settings {
  trajectoryPreview: boolean;
  screenShake: boolean;
  cameraFollow: boolean;
  damageNumbers: boolean;
  /** 0–100 (Home → Settings). */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  graphics: GraphicsQuality;
  set: (p: Partial<Omit<Settings, 'set'>>) => void;
}

const KEY = 'lobbers.settings.v1';
type Persisted = Omit<Settings, 'set'>;
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults: Persisted = {
  trajectoryPreview: true, screenShake: !reducedMotion, cameraFollow: true, damageNumbers: true,
  masterVolume: 80, musicVolume: 60, sfxVolume: 90, graphics: 'high',
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return defaults;
    const o = v as Record<string, unknown>;
    const b = (k: 'trajectoryPreview' | 'screenShake' | 'cameraFollow' | 'damageNumbers'): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : defaults[k]);
    const n = (k: 'masterVolume' | 'musicVolume' | 'sfxVolume'): number => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? Math.max(0, Math.min(100, Math.round(o[k] as number))) : defaults[k]);
    const g = o.graphics === 'low' || o.graphics === 'medium' || o.graphics === 'high' ? o.graphics : defaults.graphics;
    return {
      trajectoryPreview: b('trajectoryPreview'), screenShake: b('screenShake'), cameraFollow: b('cameraFollow'), damageNumbers: b('damageNumbers'),
      masterVolume: n('masterVolume'), musicVolume: n('musicVolume'), sfxVolume: n('sfxVolume'), graphics: g,
    };
  } catch {
    return defaults;
  }
}

/** Player settings (Home → Settings, battle pause menu); persisted to localStorage, profile sync arrives in Phase 4. */
export const useSettings = create<Settings>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { set: _omit, ...persist } = { ...get(), ...p };
    try { localStorage.setItem(KEY, JSON.stringify(persist)); } catch { /* storage unavailable */ }
  },
}));

/** Canvas density cap per graphics setting. */
export const DENSITY_CAP: Record<GraphicsQuality, number> = { low: 1, medium: 1.5, high: 2 };
