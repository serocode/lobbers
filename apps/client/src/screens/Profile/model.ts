// Profile view model (Profile.dc.html renderVals) from the local profile. Pure; tested in model.test.ts.
import {
  COSMETIC_BY_ID, MACHINES, REWARDS, avatarMachine, emoteSlot, ownsMachine,
  type LocalProfile, type MachineId, type MatchHistoryEntry, type Rarity,
} from '@lobbers/shared';
import { RARITY_COLOR } from '../Inventory/model';
import { MODES } from '../Home/modals/modes';

export const HISTORY_PAGE = 8;

export interface StatCard { k: string; v: string; sub: string; color: string }

export function careerStats(p: LocalProfile): { winRate: number; cards: StatCard[] } {
  const s = p.stats;
  const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);
  const since = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return {
    winRate: pct(s.wins, s.matches),
    cards: [
      { k: 'MATCHES', v: s.matches.toLocaleString('en-US'), sub: `since ${since}`, color: '#F5F1E8' },
      { k: 'WINS', v: s.wins.toLocaleString('en-US'), sub: `best streak ${p.best.bestWinStreak}`, color: '#5ACB91' },
      { k: 'LOSSES', v: s.losses.toLocaleString('en-US'), sub: `${pct(s.losses, s.matches)}%`, color: '#F45B55' },
      { k: 'ACCURACY', v: `${pct(s.hits, s.shots)}%`, sub: `${s.hits.toLocaleString('en-US')} hits`, color: '#FFD166' },
    ],
  };
}

/** Most-played machine (ties → most wins → the favourite you picked). */
export function mostPlayed(p: LocalProfile): { id: MachineId; matches: number; winPct: number } {
  let best: { id: MachineId; matches: number; wins: number } = { id: p.favoriteMachine, matches: 0, wins: 0 };
  for (const [id, v] of Object.entries(p.stats.byMachine) as Array<[MachineId, { matches: number; wins: number }]>) {
    if (v.matches > best.matches || (v.matches === best.matches && v.wins > best.wins)) best = { id, ...v };
  }
  return { id: best.id, matches: best.matches, winPct: best.matches ? Math.round((best.wins / best.matches) * 100) : 0 };
}

/** The machine shown in the identity hex: the equipped avatar, else your favourite machine. */
export function avatarKind(p: LocalProfile): MachineId {
  const m = p.equipped.avatar ? avatarMachine(p.equipped.avatar) : null;
  return m && ownsMachine(p, m) ? m : p.favoriteMachine;
}

export interface EquippedRow { slot: string; name: string; rarity: Rarity; rarityColor: string; color: string; icon: string }

const ICON = {
  skin: 'M3 18h22M6 18l2-6h12l2 6M14 12V7h8', trail: 'M3 18c5-12 10-12 22-6',
  explosion: 'M14 3v5M14 16v5M4 12h5M19 12h5M7 5l3 3M18 16l3 3M7 19l3-3M18 8l3-3', title: 'M4 7h20M4 12h14M4 17h18', emote: 'M4 4h20v12H12l-6 5v-5H4z',
};

/** Profile.dc.html "Equipped cosmetics": skin (on your avatar machine), trail, explosion, title, first emote. */
export function equippedRows(p: LocalProfile): EquippedRow[] {
  const kind = avatarKind(p);
  const row = (slot: string, id: string | undefined, icon: string, fallback: string): EquippedRow => {
    const c = id ? COSMETIC_BY_ID[id] : undefined;
    const color = c && 'paint' in c ? c.paint : c && 'color' in c ? c.color : c?.slot === 'title' ? '#FFD166' : '#F5F1E8';
    const rarity: Rarity = c?.rarity ?? 'Common';
    const name = !c ? fallback : c.slot === 'emote' ? `“${c.text}”` : c.name;
    return { slot, name, rarity, rarityColor: RARITY_COLOR[rarity], color, icon };
  };
  return [
    row('MACHINE SKIN', p.equipped[`skin:${kind}`], ICON.skin, `Factory ${MACHINES[kind].name}`),
    row('PROJECTILE TRAIL', p.equipped.trail, ICON.trail, 'Smoke Ring'),
    row('EXPLOSION', p.equipped.explosion, ICON.explosion, 'Classic'),
    row('TITLE', p.equipped.title, ICON.title, 'Rookie'),
    row('EMOTE', p.equipped[emoteSlot(0)], ICON.emote, '—'),
  ];
}

export type HistoryTab = 'All' | 'Wins' | 'Losses';
const modeLabel = (id: string): string => MODES.find((m) => m.id === id)?.label ?? id;
export interface HistoryRow { matchId: string; won: boolean; draw: boolean; machine: MachineId; map: string; mode: string; endedAt: number; ka: string; dmg: string; xp: number }

export function historyPage(p: LocalProfile, mapName: (e: MatchHistoryEntry) => string, tab: HistoryTab, page: number): { rows: HistoryRow[]; pages: number; page: number } {
  const all = p.history.filter((h) => tab === 'All' || (tab === 'Wins' ? h.won : !h.won && !h.draw));
  const pages = Math.max(1, Math.ceil(all.length / HISTORY_PAGE));
  const pg = Math.min(Math.max(0, page), pages - 1);
  const rows = all.slice(pg * HISTORY_PAGE, (pg + 1) * HISTORY_PAGE).map((h) => ({
    matchId: h.matchId, won: h.won, draw: h.draw, machine: h.machine, map: mapName(h), mode: modeLabel(h.mode), endedAt: h.endedAt,
    ka: `${h.eliminations} / ${h.assists}`, dmg: h.damageDealt.toLocaleString('en-US'), xp: h.xp,
  }));
  return { rows, pages, page: pg };
}

export function xpBar(p: LocalProfile): { need: number; pct: number } {
  const need = REWARDS.xpForLevel(p.level);
  return { need, pct: Math.min(100, Math.round((p.xp / need) * 100)) };
}

/** Owned titles for the title picker. */
export const ownedTitles = (p: LocalProfile): Array<{ id: string; name: string }> =>
  p.owned.map((id) => COSMETIC_BY_ID[id]).filter((c) => c?.slot === 'title').map((c) => ({ id: c.id, name: c.name }));

/** Text for "Share profile" (no profile pages without a server: a summary + the game link). */
export function shareText(p: LocalProfile, rank: string, origin: string): string {
  return `${p.name} · LV ${p.level} · ${rank} · ${p.stats.wins} wins on Lobbers. Play: ${origin}`;
}
