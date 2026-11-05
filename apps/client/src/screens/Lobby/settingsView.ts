// The six lobby setting buttons (Lobby.dc.html OPTS) over SETTING_OPTIONS. Values the simulation does
// not support yet stay visible but can't be selected (reason in the tooltip; docs/DECISIONS.md).
import { SETTING_OPTIONS, type MatchSettings } from '@lobbers/shared';

export interface SettingButton { key: string; label: string; value: string; next: Partial<MatchSettings> | null; reason?: string }

const cycle = <T,>(opts: readonly T[], v: T): T => opts[(opts.indexOf(v) + 1) % opts.length];
const WIND = { off: 'Off', calm: 'Calm', variable: 'Variable', wild: 'Wild' } as const;
const FF: Record<string, string> = { '0': 'Off', '0.5': '50%', '1': '100%' };

export function settingButtons(s: MatchSettings): SettingButton[] {
  return [
    { key: 'mode', label: 'MODE', value: s.mode === 'team-deathmatch' ? 'Team Deathmatch' : 'Capture the Hill', next: null, reason: 'Capture the Hill rules are not built yet' },
    { key: 'turn', label: 'TURN TIMER', value: `${s.turnSeconds} seconds`, next: { turnSeconds: cycle(SETTING_OPTIONS.turnSeconds, s.turnSeconds) } },
    { key: 'wind', label: 'WIND', value: WIND[s.wind], next: { wind: cycle(SETTING_OPTIONS.wind, s.wind) } },
    { key: 'items', label: 'ITEMS', value: s.itemsEnabled ? 'On' : 'Off', next: { itemsEnabled: !s.itemsEnabled } },
    { key: 'ff', label: 'FRIENDLY FIRE', value: FF[String(s.friendlyFire)] ?? `${s.friendlyFire * 100}%`, next: { friendlyFire: cycle(SETTING_OPTIONS.friendlyFire, s.friendlyFire) } },
    { key: 'rounds', label: 'ROUNDS', value: `Best of ${s.bestOf}`, next: null, reason: 'Best-of-3 series are not built yet' },
  ];
}
