// Hot-seat match setup, encoded in the URL (/match/local?map=…&red=…&blue=…) so a match is linkable
// and reproducible (seed). Phase 2 replaces this with real lobby seats.
import {
  DEFAULT_SETTINGS, MACHINES, MAPS, ROOM_LIMITS, SETTING_OPTIONS,
  type MachineId, type MapId, type MatchSettings, type SeatInput, type TeamId, type WindSetting,
} from '@lobbers/shared';

export interface LocalMatchConfig {
  mapId: MapId;
  red: MachineId[];
  blue: MachineId[];
  turnSeconds: MatchSettings['turnSeconds'];
  wind: WindSetting;
  friendlyFire: MatchSettings['friendlyFire'];
  seed: number;
}

export const DEFAULT_LOCAL: LocalMatchConfig = {
  mapId: 'cobalt', red: ['thumper', 'voltaic'], blue: ['frostbite', 'mollusk'],
  turnSeconds: DEFAULT_SETTINGS.turnSeconds, wind: DEFAULT_SETTINGS.wind, friendlyFire: DEFAULT_SETTINGS.friendlyFire, seed: 1,
};

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
  };
}

export function encodeLocalConfig(c: LocalMatchConfig): string {
  const q = new URLSearchParams({ map: c.mapId, red: c.red.join(','), blue: c.blue.join(','), turn: String(c.turnSeconds), wind: c.wind, ff: String(c.friendlyFire), seed: String(c.seed) });
  return `/match/local?${q.toString()}`;
}

/** Hot-seat players get readable names: "Red 1", "Blue 2"… */
export function seatsFor(c: LocalMatchConfig): SeatInput[] {
  const seats: SeatInput[] = [];
  const add = (t: TeamId, list: MachineId[]): void => list.forEach((machine, slot) => seats.push({ playerId: `local-${t}-${slot}`, name: `${t === 'red' ? 'Red' : 'Blue'} ${slot + 1}`, team: t, machine, slot }));
  add('red', c.red);
  add('blue', c.blue);
  return seats;
}

export function settingsFor(c: LocalMatchConfig): MatchSettings {
  return { ...DEFAULT_SETTINGS, mapId: c.mapId, turnSeconds: c.turnSeconds, wind: c.wind, friendlyFire: c.friendlyFire, isPrivate: true };
}
