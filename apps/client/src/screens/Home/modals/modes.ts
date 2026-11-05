// Mode choices shown in the mockup. Only Team Deathmatch has rules in @lobbers/shared; the others stay
// visible but disabled with a reason (docs/DECISIONS.md).
import type { GameMode } from '@lobbers/shared';

export interface ModeOption { id: GameMode | 'duel'; label: string; enabled: boolean; reason?: string }

export const MODES: ModeOption[] = [
  { id: 'team-deathmatch', label: 'Team Deathmatch', enabled: true },
  { id: 'capture-the-hill', label: 'Capture the Hill', enabled: false, reason: 'Capture the Hill rules are not built yet' },
  { id: 'duel', label: 'Duel 1v1', enabled: false, reason: 'Duels are not built yet — a 1v1 room works today' },
];
