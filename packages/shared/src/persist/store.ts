/** The subset of the Web Storage API the game uses. Pass `window.localStorage` (profile, host snapshot) or
 *  `window.sessionStorage`; tests use `memoryStore()`. Every call may throw (private mode, quota) — callers catch. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(init: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

/** Wraps a store so failures never crash the game (Safari private mode, full quota, blocked storage). */
export function safeStore(inner: KeyValueStore | null | undefined): KeyValueStore {
  return {
    getItem: (k) => { try { return inner?.getItem(k) ?? null; } catch { return null; } },
    setItem: (k, v) => { try { inner?.setItem(k, v); } catch { /* ignore */ } },
    removeItem: (k) => { try { inner?.removeItem(k); } catch { /* ignore */ } },
  };
}
