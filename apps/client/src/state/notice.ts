// One-shot messages that survive a navigation (e.g. "The host removed you from the room" → Home).
import { create } from 'zustand';

export interface Notice { id: number; text: string; kind: 'ok' | 'error' }
let seq = 1;
export const useNotice = create<{ notice: Notice | null }>(() => ({ notice: null }));
export const showNotice = (text: string, kind: Notice['kind'] = 'ok'): void => useNotice.setState({ notice: { id: seq++, text, kind } });
export const clearNotice = (): void => useNotice.setState({ notice: null });
