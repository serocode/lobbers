// Guest session (DESIGN_SPEC §3.7): name → POST /api/auth/guest → JWT kept in localStorage and
// validated on launch. The default machine (starter pick / Machine Select "Lock In" outside a room)
// is a local preference until Phase 4 stores it on the profile.
import { create } from 'zustand';
import { MACHINES, type MachineId } from '@lobbers/shared';
import { api, ApiError } from '../net/api';

export interface SessionUser { id: string; name: string }
export type SessionStatus = 'loading' | 'needsName' | 'ready' | 'offline';

interface Stored { token: string; user: SessionUser; machine: MachineId }

export interface SessionState {
  status: SessionStatus;
  token: string;
  user: SessionUser | null;
  machine: MachineId;
  error: string;
  restore(): Promise<void>;
  signIn(name: string, machine: MachineId): Promise<void>;
  setMachine(machine: MachineId): void;
}

const KEY = 'lobbers.session.v1';

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (typeof v.token !== 'string' || typeof v.user?.id !== 'string' || typeof v.user.name !== 'string') return null;
    return { token: v.token, user: { id: v.user.id, name: v.user.name }, machine: v.machine && v.machine in MACHINES ? v.machine : 'thumper' };
  } catch {
    return null;
  }
}

function write(s: Stored): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: session lasts this tab */ }
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading', token: '', user: null, machine: read()?.machine ?? 'thumper', error: '',

  async restore() {
    const stored = read();
    if (!stored) return set({ status: 'needsName', error: '' });
    set({ token: stored.token, user: stored.user, machine: stored.machine });
    try {
      await api<{ user: SessionUser }>('/api/auth/session', { token: stored.token });
      set({ status: 'ready', error: '' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ status: 'needsName', token: '', user: null, error: '' });
      else set({ status: 'offline', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async signIn(name, machine) {
    const r = await api<{ token: string; user: SessionUser }>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ name }) });
    write({ token: r.token, user: r.user, machine });
    set({ status: 'ready', token: r.token, user: r.user, machine, error: '' });
  },

  setMachine(machine) {
    const { token, user } = get();
    set({ machine });
    if (token && user) write({ token, user, machine });
  },
}));
