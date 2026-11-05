// The player's equipped cosmetics, kept on this device and sent when joining a room. The server keeps
// only items the account owns (guests: the default items) — the Inventory edits this in Phase 4.
import { DEFAULT_LOADOUT, type CosmeticLoadout } from '@lobbers/shared';

const KEY = 'lobbers.cosmetics.v1';

export function readLoadout(): CosmeticLoadout {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CosmeticLoadout | null;
    return v && typeof v === 'object' ? { ...DEFAULT_LOADOUT, ...v } : DEFAULT_LOADOUT;
  } catch { return DEFAULT_LOADOUT; }
}

export function saveLoadout(l: CosmeticLoadout): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage unavailable */ }
}
