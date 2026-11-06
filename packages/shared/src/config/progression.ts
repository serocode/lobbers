// Daily missions, achievements, unlock requirements and machine unlocks (Main.dc.html Missions modal,
// Profile.dc.html achievements, Inventory.dc.html locks). Everything is checked locally against the player's own
// profile; requirements that needed a server (seasons, global ranks, events) are mapped to local goals (DECISIONS,
// Phase 4).
import type { MachineId, MapId } from '../types.ts';
import { MACHINES } from './machines.ts';
import { MAPS } from './maps.ts';

/** Lifetime counters kept on the profile (`profile.counters`), fed by the host's per-player feats. */
export type CounterId =
  | 'directHits' | 'burnDamage' | 'carvedPx' | 'friendlyHits' | 'windHits' | 'guidedHits' | 'iceElims'
  | 'missionsCompleted' | 'untouchableWins' | 'lastLobberWins';

export type Requirement =
  | { kind: 'level'; n: number }
  | { kind: 'rating'; n: number }
  | { kind: 'matches'; n: number }
  | { kind: 'wins'; n: number }
  | { kind: 'winsWith'; machine: MachineId; n: number }
  | { kind: 'winsOn'; map: MapId; n: number }
  | { kind: 'counter'; counter: CounterId; n: number; text: string }
  | { kind: 'achievement'; id: AchievementId }
  | { kind: 'streak'; n: number };

export type Reward = { coins: number } | { gems: number };

export interface MissionDef {
  id: string; text: string; goal: number; reward: Reward;
}

/** The mockup's five daily missions. Progress resets at local midnight; Claim pays once per day. */
export const DAILY_MISSIONS: readonly MissionDef[] = [
  { id: 'm-direct', text: 'Land 5 direct hits', goal: 5, reward: { coins: 150 } },
  { id: 'm-thumper', text: 'Win 3 matches as Thumper', goal: 3, reward: { coins: 300 } },
  { id: 'm-damage', text: 'Deal 5,000 damage', goal: 5000, reward: { coins: 200 } },
  { id: 'm-ice', text: 'Eliminate 2 enemies with Ice weapons', goal: 2, reward: { gems: 80 } },
  { id: 'm-friend', text: 'Play a match with a friend', goal: 1, reward: { coins: 100 } },
];

export type AchievementId =
  | 'sharpshooter' | 'crater-maker' | 'wind-whisperer' | 'centurion' | 'last-lobber' | 'electrician'
  | 'island-hopper' | 'ice-age' | 'pyromaniac' | 'friendly-fire' | 'untouchable' | 'demolition-derby';

export type AchievementGlyph = 'aim' | 'drop' | 'star' | 'bolt' | 'flame';

export interface AchievementDef {
  id: AchievementId; name: string; description: string; goal: number; glyph: AchievementGlyph; color: string;
  /** Where the progress value comes from (lifetime counter, wins stat, best-ever feat, wins on a map). */
  source: { kind: 'counter'; counter: CounterId } | { kind: 'wins' } | { kind: 'best'; feat: 'bestChain' | 'bestFreeze' | 'bestTurnElims' } | { kind: 'winsOn'; map: MapId };
}

/** Profile.dc.html's 12 tiles. "Arc Bolt" / "Frost Nova" / teleporting don't exist in our game — see DECISIONS. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'sharpshooter', name: 'Sharpshooter', description: 'Land 100 direct hits.', goal: 100, glyph: 'aim', color: '#FFD166', source: { kind: 'counter', counter: 'directHits' } },
  { id: 'crater-maker', name: 'Crater Maker', description: 'Destroy 50,000 px of terrain.', goal: 50_000, glyph: 'drop', color: '#F28C38', source: { kind: 'counter', counter: 'carvedPx' } },
  { id: 'wind-whisperer', name: 'Wind Whisperer', description: 'Hit a target in wind 10 or stronger.', goal: 1, glyph: 'star', color: '#9FE3FF', source: { kind: 'counter', counter: 'windHits' } },
  { id: 'centurion', name: 'Centurion', description: 'Win 100 matches.', goal: 100, glyph: 'star', color: '#FFD166', source: { kind: 'wins' } },
  { id: 'last-lobber', name: 'Last Lobber', description: 'Win a round as the last machine standing on your team.', goal: 1, glyph: 'star', color: '#F45B55', source: { kind: 'counter', counter: 'lastLobberWins' } },
  { id: 'electrician', name: 'Electrician', description: 'Chain a Lightning Strike through 3 machines.', goal: 3, glyph: 'bolt', color: '#FFE45E', source: { kind: 'best', feat: 'bestChain' } },
  { id: 'island-hopper', name: 'Island Hopper', description: 'Win 10 matches on Skyreach Isles.', goal: 10, glyph: 'star', color: '#5ACB91', source: { kind: 'winsOn', map: 'skyreach' } },
  { id: 'ice-age', name: 'Ice Age', description: 'Freeze 4 enemies at once.', goal: 4, glyph: 'drop', color: '#9FE3FF', source: { kind: 'best', feat: 'bestFreeze' } },
  { id: 'pyromaniac', name: 'Pyromaniac', description: 'Deal 10,000 burn damage.', goal: 10_000, glyph: 'flame', color: '#FF6B3D', source: { kind: 'counter', counter: 'burnDamage' } },
  { id: 'friendly-fire', name: 'Friendly Fire', description: 'Hit a teammate 10 times. Sorry, team.', goal: 10, glyph: 'star', color: '#FF7EB6', source: { kind: 'counter', counter: 'friendlyHits' } },
  { id: 'untouchable', name: 'Untouchable', description: 'Win a match without taking damage.', goal: 1, glyph: 'aim', color: '#B07CF2', source: { kind: 'counter', counter: 'untouchableWins' } },
  { id: 'demolition-derby', name: 'Demolition Derby', description: 'Eliminate 4 enemies in one turn.', goal: 4, glyph: 'flame', color: '#FF7EB6', source: { kind: 'best', feat: 'bestTurnElims' } },
];

export const achievementById = (id: AchievementId): AchievementDef => ACHIEVEMENTS.find((a) => a.id === id) ?? ACHIEVEMENTS[0];

/** Inventory "Battle Machines": the five starters are owned; the rest unlock (Inventory.dc.html `mlock`, local goals). */
export const MACHINE_UNLOCKS: Partial<Record<MachineId, { kind: 'coins'; price: number } | { kind: 'requirement'; need: Requirement }>> = {
  frostbite: { kind: 'coins', price: 6000 },
  whirligig: { kind: 'requirement', need: { kind: 'level', n: 40 } },
  boomba: { kind: 'requirement', need: { kind: 'level', n: 20 } },   // mockup: "Season 4 pass · level 20"
};

/** One line for the Inventory preview pane / lock badge. */
export function requirementText(r: Requirement): string {
  switch (r.kind) {
    case 'level': return `Reach level ${r.n}`;
    case 'rating': return `Reach rating ${r.n.toLocaleString('en-US')}`;
    case 'matches': return `${r.n.toLocaleString('en-US')} matches played`;
    case 'wins': return `Win ${r.n.toLocaleString('en-US')} matches`;
    case 'winsWith': return `${r.n} wins with ${MACHINES[r.machine].name}`;
    case 'winsOn': return `Win ${r.n} matches on ${MAPS[r.map].name}`;
    case 'counter': return r.text;
    case 'achievement': return `Achievement: ${achievementById(r.id).name}`;
    case 'streak': return `Play ${r.n} days in a row`;
  }
}


/** Rank tiers by rating (Profile rank shield). Divisions climb I → III inside a tier; "Gold I" = 1,200 (see requirements). */
export interface RankTier { name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'; min: number; color: string; inner: string }
export const RANK_TIERS: readonly RankTier[] = [
  { name: 'Bronze', min: 1000, color: '#D9925B', inner: '#A8683A' },   // new players start here; anything lower is Bronze I
  { name: 'Silver', min: 1100, color: '#C9D1E0', inner: '#8F9AB3' },
  { name: 'Gold', min: 1200, color: '#FFD166', inner: '#E8A23B' },
  { name: 'Platinum', min: 1400, color: '#9FE3FF', inner: '#4FB3D9' },
  { name: 'Diamond', min: 1600, color: '#B07CF2', inner: '#7E4FC4' },
];

export function rankFor(rating: number): { tier: RankTier; division: 'I' | 'II' | 'III' | null; label: string } {
  let i = 0;
  for (let k = 0; k < RANK_TIERS.length; k++) if (rating >= RANK_TIERS[k].min) i = k;
  const tier = RANK_TIERS[i];
  const next = RANK_TIERS[i + 1];
  if (!next) return { tier, division: null, label: tier.name.toUpperCase() };
  const band = (next.min - tier.min) / 3;
  const d = Math.max(0, Math.min(2, Math.floor((rating - tier.min) / band)));
  const division = (['I', 'II', 'III'] as const)[d];
  return { tier, division, label: `${tier.name.toUpperCase()} ${division}` };
}
