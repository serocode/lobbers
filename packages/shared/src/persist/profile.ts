import type { MachineId, MapId, TeamId } from '../types.ts';
import { applyXp } from '../rewards.ts';
import type { MatchDetails, MatchEndedMsg, PeerProfile, PlayerResult } from '../protocol.ts';
import { STARTER_MACHINES } from '../config/machines.ts';
import {
  COSMETIC_BY_ID, DEFAULT_EQUIPPED, DEFAULT_ITEMS, equippedFromLoadout, loadoutFromEquipped, machineItemId, sanitizeLoadout,
} from '../config/cosmetics.ts';
import type { Verdict } from '../rules.ts';
import type { KeyValueStore } from './store.ts';

// Everything that used to live in Postgres now lives in ONE localStorage key per browser.
// Pure functions: load → change → save. Never mutate a loaded profile in place from React; replace it.

export const PROFILE_KEY = 'lobbers:profile';
export const PROFILE_VERSION = 1;

/** Starting inventory (DATA_MODEL §Starter): the 5 starter machines (`machine:<id>`) + the catalog's default items. */
export const STARTER_ITEMS: readonly string[] = [...STARTER_MACHINES.map(machineItemId), ...DEFAULT_ITEMS];

/** Machine ownership — the same `machine:<id>` form everywhere. */
export const ownsMachine = (p: Pick<LocalProfile, 'owned'>, id: MachineId): boolean => p.owned.includes(machineItemId(id));

export const RATING = { start: 1000, win: 25, loss: -20, draw: 0, floor: 0 } as const;

export interface MatchHistoryEntry {
  matchId: string;
  endedAt: number;
  mapId: MapId;
  mode: MatchEndedMsg['mode'];
  team: TeamId;
  won: boolean;
  draw: boolean;
  machine: MachineId;
  damageDealt: number;
  eliminations: number;
  assists: number;
  accuracy: number;
  mvp: boolean;
  xp: number;
  coins: number;
  players: Array<{ id: string; name: string; team: TeamId; machine: MachineId; mvp: boolean }>;
  /** Compact copy of the host's result so /results/:matchId revisits work offline (details: last 14 turns). */
  summary?: MatchSummary;
}

export interface MatchSummary {
  winner: MatchEndedMsg['winner'];
  turns: number;
  durationSec: number;
  mvpHighlight: string;
  details: MatchDetails;
  results: PlayerResult[];
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export interface ProfileSettings {
  /** 0–100 */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  trajectoryPreview: boolean;
  cameraFollow: boolean;
  damageNumbers: boolean;
  graphics: GraphicsQuality;
}

/** Rooms you hosted or joined (Join Room → "Recent rooms"). */
export interface RecentRoom { code: string; name: string; at: number; hosted: boolean }

export interface RecentPlayer {
  id: string;
  name: string;
  level: number;
  rating: number;
  title: string | null;
  lastPlayedAt: number;
  matchesTogether: number;
  /** Friends list = recent players you starred. */
  starred: boolean;
}

export interface LocalProfile {
  v: typeof PROFILE_VERSION;
  id: string;
  name: string;
  createdAt: number;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  rating: number;
  favoriteMachine: MachineId;
  owned: string[];
  /** slot → catalog id (config/cosmetics.ts): "trail" → "t-ember", "skin:mollusk" → "s-coral", "emote:1" → "e-gg", "title" → "ti-rookie". */
  equipped: Record<string, string>;
  settings: ProfileSettings;
  recentRooms: RecentRoom[];
  stats: {
    matches: number; wins: number; losses: number; draws: number; damageDealt: number; eliminations: number; assists: number;
    mvps: number; shots: number; hits: number; byMachine: Partial<Record<MachineId, { matches: number; wins: number }>>;
  };
  history: MatchHistoryEntry[];
  recentPlayers: RecentPlayer[];
  /** Match ids already credited — reloading the results screen must not pay out twice. */
  credited: string[];
  /** Daily missions / achievements progress keyed by definition id. */
  progress: Record<string, { value: number; claimedAt: number | null; resetAt: number | null }>;
}

const LIMITS = { history: 30, recentPlayers: 50, credited: 60, recentRooms: 4, detailTurns: 14 } as const;

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  masterVolume: 80, musicVolume: 60, sfxVolume: 90, screenShake: true, trajectoryPreview: true, cameraFollow: true, damageNumbers: true, graphics: 'high',
};

export function createProfile(name: string, id: string, now: number): LocalProfile {
  return {
    v: PROFILE_VERSION, id, name, createdAt: now, level: 1, xp: 0, coins: 500, gems: 0, rating: RATING.start, favoriteMachine: 'thumper',
    owned: [...STARTER_ITEMS], equipped: { ...DEFAULT_EQUIPPED },
    settings: { ...DEFAULT_PROFILE_SETTINGS }, recentRooms: [],
    stats: { matches: 0, wins: 0, losses: 0, draws: 0, damageDealt: 0, eliminations: 0, assists: 0, mvps: 0, shots: 0, hits: 0, byMachine: {} },
    history: [], recentPlayers: [], credited: [], progress: {},
  };
}

/** What this browser tells the host about its player. */
export function toPeerProfile(p: LocalProfile): PeerProfile {
  // Only items this profile owns, in the right slots (the host can't check ownership).
  const cosmetics = equippedFromLoadout(sanitizeLoadout(loadoutFromEquipped(p.equipped), new Set(p.owned)));
  const title = COSMETIC_BY_ID[cosmetics.title ?? '']?.name ?? null;
  return { id: p.id, name: p.name, level: p.level, rating: p.rating, title, avatar: p.equipped.avatar ?? null, favoriteMachine: p.favoriteMachine, cosmetics };
}

/** Reads + migrates. A corrupt value is moved to `<key>:corrupt` and null is returned (first-run flow shows again). */
export function loadProfile(store: KeyValueStore): LocalProfile | null {
  const raw = store.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const p = migrate(JSON.parse(raw));
    if (p) return p;
  } catch { /* fall through */ }
  store.setItem(`${PROFILE_KEY}:corrupt`, raw);
  store.removeItem(PROFILE_KEY);
  return null;
}

export function saveProfile(store: KeyValueStore, p: LocalProfile): void { store.setItem(PROFILE_KEY, JSON.stringify(p)); }

/** Future versions: add `if (raw.v === 1) raw = upgrade1to2(raw)` steps here. */
function migrate(raw: unknown): LocalProfile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<LocalProfile>;
  if (r.v !== PROFILE_VERSION || typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const base = createProfile(r.name, r.id, r.createdAt ?? 0);
  return { ...base, ...r, settings: { ...base.settings, ...r.settings }, stats: { ...base.stats, ...r.stats }, recentRooms: Array.isArray(r.recentRooms) ? r.recentRooms : [] } as LocalProfile;
}

export interface CreditOutcome { profile: LocalProfile; credited: boolean; xpGained: number; coinsGained: number; levelsGained: number; ratingChange: number }

/**
 * Applies a finished match to THIS player's profile (every peer does it for itself from the host's `matchEnded`).
 * Idempotent per matchId. Players who aren't in `result.players` get nothing.
 */
export function creditMatch(p: LocalProfile, result: MatchEndedMsg, others: Array<Pick<PeerProfile, 'id' | 'name' | 'level' | 'rating' | 'title'>> = []): CreditOutcome {
  const none: CreditOutcome = { profile: p, credited: false, xpGained: 0, coinsGained: 0, levelsGained: 0, ratingChange: 0 };
  if (p.credited.includes(result.matchId)) return none;
  const me: PlayerResult | undefined = result.players.find((x) => x.playerId === p.id);
  if (!me) return none;
  const won = result.winner === me.team;
  const draw = result.winner === 'draw';
  const lv = applyXp(p.level, p.xp, me.xp);
  const ratingChange = draw ? RATING.draw : won ? RATING.win : RATING.loss;
  const byMachine = { ...p.stats.byMachine };
  const bm = byMachine[me.machine] ?? { matches: 0, wins: 0 };
  byMachine[me.machine] = { matches: bm.matches + 1, wins: bm.wins + (won ? 1 : 0) };
  const entry: MatchHistoryEntry = {
    matchId: result.matchId, endedAt: result.endedAt, mapId: result.mapId, mode: result.mode, team: me.team, won, draw, machine: me.machine,
    damageDealt: me.damageDealt, eliminations: me.eliminations, assists: me.assists, accuracy: me.accuracy, mvp: me.mvp, xp: me.xp, coins: me.coins,
    players: result.players.map((x) => ({ id: x.playerId, name: x.name, team: x.team, machine: x.machine, mvp: x.mvp })),
    summary: {
      winner: result.winner, turns: result.turns, durationSec: result.durationSec, mvpHighlight: result.mvpHighlight,
      details: { damageByTurn: result.details.damageByTurn.slice(-LIMITS.detailTurns), weapons: result.details.weapons.slice(0, 4) }, results: result.players,
    },
  };
  const recent = new Map(p.recentPlayers.map((r) => [r.id, r]));
  for (const x of result.players) {
    if (x.playerId === p.id) continue;
    const info = others.find((o) => o.id === x.playerId);
    const prev = recent.get(x.playerId);
    recent.set(x.playerId, {
      id: x.playerId, name: info?.name ?? x.name, level: info?.level ?? prev?.level ?? 1, rating: info?.rating ?? prev?.rating ?? RATING.start,
      title: info?.title ?? prev?.title ?? null, lastPlayedAt: result.endedAt, matchesTogether: (prev?.matchesTogether ?? 0) + 1, starred: prev?.starred ?? false,
    });
  }
  const profile: LocalProfile = {
    ...p,
    level: lv.level, xp: lv.xp, coins: p.coins + me.coins, rating: Math.max(RATING.floor, p.rating + ratingChange),
    stats: {
      ...p.stats, matches: p.stats.matches + 1, wins: p.stats.wins + (won ? 1 : 0), losses: p.stats.losses + (!won && !draw ? 1 : 0), draws: p.stats.draws + (draw ? 1 : 0),
      damageDealt: p.stats.damageDealt + me.damageDealt, eliminations: p.stats.eliminations + me.eliminations, assists: p.stats.assists + me.assists,
      mvps: p.stats.mvps + (me.mvp ? 1 : 0), shots: p.stats.shots + me.shots, hits: p.stats.hits + me.hits, byMachine,
    },
    history: [entry, ...p.history].slice(0, LIMITS.history),
    recentPlayers: [...recent.values()].sort((a, b) => Number(b.starred) - Number(a.starred) || b.lastPlayedAt - a.lastPlayedAt).slice(0, LIMITS.recentPlayers),
    credited: [result.matchId, ...p.credited].slice(0, LIMITS.credited),
  };
  return { profile, credited: true, xpGained: me.xp, coinsGained: me.coins, levelsGained: lv.levelsGained, ratingChange };
}

export function purchase(p: LocalProfile, item: { id: string; priceCoins?: number; priceGems?: number }): Verdict<LocalProfile> {
  if (p.owned.includes(item.id)) return { ok: false, reason: 'already owned' };
  const c = item.priceCoins ?? 0, g = item.priceGems ?? 0;
  if (p.coins < c || p.gems < g) return { ok: false, reason: 'not enough currency' };
  return { ok: true, value: { ...p, coins: p.coins - c, gems: p.gems - g, owned: [...p.owned, item.id] } };
}

export function equip(p: LocalProfile, slot: string, itemId: string | null): Verdict<LocalProfile> {
  if (itemId !== null && !p.owned.includes(itemId)) return { ok: false, reason: 'not owned' };
  if (itemId !== null && !fitsSlot(slot, itemId)) return { ok: false, reason: 'wrong slot' };
  const equipped = { ...p.equipped };
  if (itemId === null) delete equipped[slot]; else equipped[slot] = itemId;
  return { ok: true, value: { ...p, equipped } };
}

export function starPlayer(p: LocalProfile, playerId: string, starred: boolean): LocalProfile {
  return { ...p, recentPlayers: p.recentPlayers.map((r) => (r.id === playerId ? { ...r, starred } : r)) };
}

/** Friends leaderboard: you + everyone you've played with, by rating (ratings are as last seen in a lobby). */
export function localLeaderboard(p: LocalProfile, onlyStarred = false): Array<{ id: string; name: string; level: number; rating: number; you: boolean }> {
  const rows = [{ id: p.id, name: p.name, level: p.level, rating: p.rating, you: true },
    ...p.recentPlayers.filter((r) => !onlyStarred || r.starred).map((r) => ({ id: r.id, name: r.name, level: r.level, rating: r.rating, you: false }))];
  return rows.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

// ---- Backup / move to another device (Settings → "Export save" / "Import save"). Not encrypted — it's a hobby game.
const SAVE_PREFIX = 'LOBBERS1:';

function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const toB64 = (s: string): string => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const fromB64 = (s: string): string => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export function exportProfile(p: LocalProfile): string {
  const json = JSON.stringify(p);
  return `${SAVE_PREFIX}${checksum(json)}:${toB64(json)}`;
}

export function importProfile(code: string): Verdict<LocalProfile> {
  const s = code.trim();
  if (!s.startsWith(SAVE_PREFIX)) return { ok: false, reason: 'not a Lobbers save' };
  const [sum, b64] = s.slice(SAVE_PREFIX.length).split(':');
  try {
    const json = fromB64(b64 ?? '');
    if (checksum(json) !== sum) return { ok: false, reason: 'save code is damaged' };
    const p = migrate(JSON.parse(json));
    return p ? { ok: true, value: p } : { ok: false, reason: 'unsupported save version' };
  } catch { return { ok: false, reason: 'save code is damaged' }; }
}

/** Slot names follow the catalog: "trail", "explosion", "title", "emote:n", "skin:<machine>", "weaponSkin:<category>". */
function fitsSlot(slot: string, itemId: string): boolean {
  const c = COSMETIC_BY_ID[itemId];
  if (!c) return false;
  const [base, q] = slot.split(':');
  if (base !== c.slot) return false;
  if (c.slot === 'skin') return q === c.machine;
  if (c.slot === 'weaponSkin') return q === c.category;
  if (c.slot === 'emote') return Number(q) >= 1 && Number(q) <= 4;
  return q === undefined;
}

/** The finished match as Results shows it, from a history entry (revisits). Null for old entries without a summary. */
export function resultFromHistory(e: MatchHistoryEntry): MatchEndedMsg | null {
  if (!e.summary) return null;
  return {
    matchId: e.matchId, mapId: e.mapId, mode: e.mode, endedAt: e.endedAt, winner: e.summary.winner, turns: e.summary.turns, durationSec: e.summary.durationSec,
    players: e.summary.results, mvpHighlight: e.summary.mvpHighlight, details: e.summary.details,
  };
}

/** Remember a room code for Join Room → Recent rooms (newest first, max 4). */
export function rememberRoom(p: LocalProfile, room: RecentRoom): LocalProfile {
  return { ...p, recentRooms: [room, ...p.recentRooms.filter((r) => r.code !== room.code)].slice(0, LIMITS.recentRooms) };
}

