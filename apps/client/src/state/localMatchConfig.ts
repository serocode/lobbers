// Hot Seat setup (DESIGN_SPEC §3.9), encoded in the URL (/hotseat?map=…&red=…&blue=…&rn=…&bn=…) so a local
// match is linkable and reproducible (seed). Names are optional ("Red 1", "Blue 2" by default).
import { PRESETS, isPreset, type PresetId } from './cosmeticPresets';
import type { HotSeatSeat } from '../net/local/HotSeat';
import {
  ALL_COSMETIC_IDS, DEFAULT_SETTINGS, MACHINES, MAPS, ROOM_LIMITS, SETTING_OPTIONS, equippedFromLoadout, sanitizeLoadout,
  type MachineId, type MapId, type MatchSettings, type TeamId, type WindSetting,
} from '@lobbers/shared';

export interface LocalMatchConfig {
  mapId: MapId;
  red: MachineId[];
  blue: MachineId[];
  turnSeconds: MatchSettings['turnSeconds'];
  wind: WindSetting;
  friendlyFire: MatchSettings['friendlyFire'];
  seed: number;
  itemsEnabled: boolean;
  /** Cosmetic preset per team (dev harness). */
  look: Record<TeamId, PresetId>;
  /** Player names per team, in seat order ('' = default "Red 1"…). */
  names: Record<TeamId, string[]>;
  mode: MatchSettings['mode'];
}

export const DEFAULT_LOCAL: LocalMatchConfig = {
  mapId: 'cobalt', red: ['thumper', 'voltaic'], blue: ['frostbite', 'mollusk'],
  turnSeconds: DEFAULT_SETTINGS.turnSeconds, wind: DEFAULT_SETTINGS.wind, friendlyFire: DEFAULT_SETTINGS.friendlyFire, seed: 1,
  itemsEnabled: DEFAULT_SETTINGS.itemsEnabled, look: { red: 'default', blue: 'default' }, names: { red: [], blue: [] }, mode: 'team-deathmatch',
};

/** Same rule as profile names (3–16 visible characters). */
const cleanSeatName = (n: string): string => { const s = n.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16); return s.length >= 3 ? s : ''; };
const names = (raw: string | null): string[] => (raw ? raw.split(',').map(cleanSeatName).slice(0, ROOM_LIMITS.maxPerTeam) : []);

const isMachine = (v: string): v is MachineId => v in MACHINES;
const isMap = (v: string): v is MapId => v in MAPS;
const pick = <T>(opts: readonly T[], v: unknown, fallback: T): T => (opts.includes(v as T) ? (v as T) : fallback);

function team(raw: string | null, fallback: MachineId[]): MachineId[] {
  if (!raw) return fallback;
  const list = raw.split(',').filter(isMachine).slice(0, ROOM_LIMITS.maxPerTeam);
  return list.length ? list : fallback;
}

export function decodeLocalConfig(q: URLSearchParams): LocalMatchConfig {
  const map = q.get('map') ?? '';
  const seed = Number(q.get('seed'));
  return {
    mapId: isMap(map) ? map : DEFAULT_LOCAL.mapId,
    red: team(q.get('red'), DEFAULT_LOCAL.red),
    blue: team(q.get('blue'), DEFAULT_LOCAL.blue),
    turnSeconds: pick(SETTING_OPTIONS.turnSeconds, Number(q.get('turn')), DEFAULT_LOCAL.turnSeconds),
    wind: pick(SETTING_OPTIONS.wind, q.get('wind'), DEFAULT_LOCAL.wind),
    friendlyFire: pick(SETTING_OPTIONS.friendlyFire, Number(q.get('ff') ?? DEFAULT_LOCAL.friendlyFire), DEFAULT_LOCAL.friendlyFire),
    seed: Number.isInteger(seed) && seed > 0 ? seed : DEFAULT_LOCAL.seed,
    itemsEnabled: q.get('items') === null ? DEFAULT_LOCAL.itemsEnabled : q.get('items') === '1',
    look: { red: isPreset(q.get('rl')) ? (q.get('rl') as PresetId) : 'default', blue: isPreset(q.get('bl')) ? (q.get('bl') as PresetId) : 'default' },
    names: { red: names(q.get('rn')), blue: names(q.get('bn')) },
    mode: 'team-deathmatch',
  };
}

export function encodeLocalConfig(c: LocalMatchConfig): string {
  const q = new URLSearchParams({ map: c.mapId, red: c.red.join(','), blue: c.blue.join(','), turn: String(c.turnSeconds), wind: c.wind, ff: String(c.friendlyFire), seed: String(c.seed), items: c.itemsEnabled ? '1' : '0', rl: c.look.red, bl: c.look.blue });
  if (c.names.red.some(Boolean)) q.set('rn', c.names.red.join(','));
  if (c.names.blue.some(Boolean)) q.set('bn', c.names.blue.join(','));
  return `/hotseat?${q.toString()}`;
}

/** Hot-seat seats, red then blue, with readable names ("Red 1", "Blue 2") and their team's cosmetic preset. */
export function hotSeatSeats(c: LocalMatchConfig): HotSeatSeat[] {
  const seats: HotSeatSeat[] = [];
  const add = (t: TeamId, list: MachineId[]): void => list.forEach((machine, slot) => seats.push({
    name: cleanSeatName(c.names[t][slot] ?? '') || `${t === 'red' ? 'Red' : 'Blue'} ${slot + 1}`, team: t, machine, cosmetics: equippedFromLoadout(sanitizeLoadout(PRESETS[c.look[t]].loadout, ALL_COSMETIC_IDS)),
  }));
  add('red', c.red);
  add('blue', c.blue);
  return seats;
}

export function settingsFor(c: LocalMatchConfig): MatchSettings {
  return { ...DEFAULT_SETTINGS, mapId: c.mapId, turnSeconds: c.turnSeconds, wind: c.wind, friendlyFire: c.friendlyFire, itemsEnabled: c.itemsEnabled, isPrivate: true };
}
