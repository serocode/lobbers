// The player's local profile (DESIGN_SPEC §3.7, DATA_MODEL): one versioned localStorage key through
// persist/profile.ts + safeStore. If storage is blocked the profile lives in memory for the session and
// Home shows a banner. Identity for rooms = profile.id (sent in `hello`).
import { create } from 'zustand';
import {
  PROFILE_KEY, createProfile, loadProfile, safeStore, saveProfile, toPeerProfile, type KeyValueStore, type LocalProfile, type MachineId, type PeerProfile,
} from '@lobbers/shared';

export type ProfileStatus = 'loading' | 'needsName' | 'ready';

export interface ProfileState {
  status: ProfileStatus;
  profile: LocalProfile | null;
  /** false = saving failed (private mode, quota, blocked) — progress lasts this session only. */
  storageOk: boolean;
  init(): void;
  create(name: string, machine: MachineId): void;
  /** Replace the profile (pure persist/profile.ts helpers) and save it. */
  update(fn: (p: LocalProfile) => LocalProfile): void;
  /** Import a save (Settings / first-run "I have a save code"): replaces this device's profile. */
  replace(p: LocalProfile): void;
  /** Settings → Reset progress: forget the profile; the first-run flow shows again. */
  reset(): void;
}

const raw = (): KeyValueStore | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };
let backing: KeyValueStore | null = raw();
/** Every profile/transport read+write goes through this (it never throws). */
export const store: KeyValueStore = safeStore({
  getItem: (k) => backing?.getItem(k) ?? null,
  setItem: (k, v) => { if (!backing) throw new Error('no storage'); backing.setItem(k, v); },
  removeItem: (k) => { backing?.removeItem(k); },
});
/** Tests: run the store over a memoryStore / a throwing store. */
export function setBackingStore(s: KeyValueStore | null): void { backing = s; useProfile.setState({ status: 'loading', profile: null, storageOk: true }); }

/** Can we actually write? (Safari private mode / blocked storage throw or silently drop writes.) */
function probe(): boolean {
  try {
    if (!backing) return false;
    backing.setItem('lobbers:probe', '1');
    const ok = backing.getItem('lobbers:probe') === '1';
    backing.removeItem('lobbers:probe');
    return ok;
  } catch { return false; }
}

function persist(p: LocalProfile): boolean {
  saveProfile(store, p);
  return store.getItem('lobbers:profile') === JSON.stringify(p);
}

export const useProfile = create<ProfileState>((set, get) => ({
  status: 'loading', profile: null, storageOk: true,
  init() {
    if (get().status !== 'loading') return;
    const p = loadProfile(store);
    set({ profile: p, status: p ? 'ready' : 'needsName', storageOk: probe() });
  },
  create(name, machine) {
    const id = globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const p = { ...createProfile(name, id, Date.now()), favoriteMachine: machine };
    set({ profile: p, status: 'ready', storageOk: persist(p) });
  },
  replace(p) { set({ profile: p, status: 'ready', storageOk: persist(p) }); },
  reset() { store.removeItem(PROFILE_KEY); set({ profile: null, status: 'needsName' }); },
  update(fn) {
    const p = get().profile;
    if (!p) return;
    const next = fn(p);
    set({ profile: next, storageOk: persist(next) });
  },
}));

export const myId = (): string => useProfile.getState().profile?.id ?? '';
export const myPeerProfile = (): PeerProfile | null => { const p = useProfile.getState().profile; return p ? toPeerProfile(p) : null; };
