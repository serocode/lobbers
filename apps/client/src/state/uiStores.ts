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
  set: (p: Partial<Omit<BattleUi, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const uiDefaults = { armoryOpen: false, armoryTab: 'All' as ArmoryTab, paused: false, confirmLeave: false, logOpen: true, sheetOpen: false };
export const useBattleUi = create<BattleUi>((set) => ({ ...uiDefaults, set: (p) => set(p), reset: () => set(uiDefaults) }));

export interface Settings {
  trajectoryPreview: boolean;
  screenShake: boolean;
  cameraFollow: boolean;
  set: (p: Partial<Omit<Settings, 'set'>>) => void;
}

const KEY = 'lobbers.settings.v1';
type Persisted = Omit<Settings, 'set'>;
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults: Persisted = { trajectoryPreview: true, screenShake: !reducedMotion, cameraFollow: true };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return defaults;
    const o = v as Record<string, unknown>;
    const b = (k: keyof Persisted): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : defaults[k]);
    return { trajectoryPreview: b('trajectoryPreview'), screenShake: b('screenShake'), cameraFollow: b('cameraFollow') };
  } catch {
    return defaults;
  }
}

/** Battlefield settings (pause menu); persisted to localStorage, profile sync arrives in Phase 4. */
export const useSettings = create<Settings>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { trajectoryPreview, screenShake, cameraFollow } = { ...get(), ...p };
    try { localStorage.setItem(KEY, JSON.stringify({ trajectoryPreview, screenShake, cameraFollow })); } catch { /* storage unavailable */ }
  },
}));
