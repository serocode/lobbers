/** m:ss for countdowns ("RECONNECTING 0:42", "OFFLINE 0:42"). */
export const mmss = (ms: number): string => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
