// zod schemas for every inbound room message (docs/NETWORK.md § Security checklist). Anything that
// fails to parse is rejected before game rules run. Numbers are bounded; strings are length-capped.
import { z } from 'zod';
import { EMOTE_SLOTS, MACHINES, MAPS, ROOM_LIMITS, SETTING_OPTIONS, WEAPONS, type LobbyIntent, type MachineId, type MapId, type MatchIntent, type WeaponId } from '@lobbers/shared';

const keys = <T extends string>(o: Record<T, unknown>): [T, ...T[]] => Object.keys(o) as [T, ...T[]];
const literalUnion = <T extends string | number | boolean>(vals: readonly T[]) => z.custom<T>((v) => vals.includes(v as T));

export const MachineIdZ = z.enum(keys(MACHINES as Record<MachineId, unknown>));
export const MapIdZ = z.enum(keys(MAPS as Record<MapId, unknown>));
export const WeaponIdZ = z.enum(keys(WEAPONS as Record<WeaponId, unknown>));
const finite = z.number().finite();

export const SettingsPatchZ = z.object({
  mode: literalUnion(SETTING_OPTIONS.mode),
  mapId: MapIdZ,
  turnSeconds: literalUnion(SETTING_OPTIONS.turnSeconds),
  wind: literalUnion(SETTING_OPTIONS.wind),
  itemsEnabled: z.boolean(),
  friendlyFire: literalUnion(SETTING_OPTIONS.friendlyFire),
  bestOf: literalUnion(SETTING_OPTIONS.bestOf),
  isPrivate: z.boolean(),
}).partial().strict();

export const RoomNameZ = z.string().trim().min(3).max(24);

export const LobbyIntentZ: z.ZodType<LobbyIntent> = z.discriminatedUnion('t', [
  z.object({ t: z.literal('setTeam'), team: z.enum(['red', 'blue']) }),
  z.object({ t: z.literal('setMachine'), machine: MachineIdZ }),
  z.object({ t: z.literal('setReady'), ready: z.boolean() }),
  z.object({ t: z.literal('updateSettings'), patch: SettingsPatchZ }),
  z.object({ t: z.literal('setRoomName'), name: RoomNameZ }),
  z.object({ t: z.literal('setCosmetics'), loadout: z.unknown() }),
  z.object({ t: z.literal('kick'), playerId: z.string().min(1).max(64) }),
  z.object({ t: z.literal('startMatch') }),
  z.object({ t: z.literal('chat'), text: z.string().max(ROOM_LIMITS.chatMaxLength * 2) }),
]);

export const MatchIntentZ: z.ZodType<MatchIntent> = z.discriminatedUnion('t', [
  z.object({ t: z.literal('aim'), angle: finite.min(-360).max(360), power: finite.min(0).max(100), weaponId: WeaponIdZ }),
  z.object({ t: z.literal('move'), dir: z.union([z.literal(-1), z.literal(1)]), ticks: z.number().int().min(1).max(10) }),
  z.object({ t: z.literal('jump') }),
  z.object({ t: z.literal('selectWeapon'), weaponId: WeaponIdZ }),
  z.object({ t: z.literal('useAbility'), slot: z.enum(['special', 'ultimate']) }),
  z.object({ t: z.literal('fire'), aim: z.object({ angle: finite, power: finite, weaponId: WeaponIdZ }) }),
  z.object({ t: z.literal('skipTurn') }),
  z.object({ t: z.literal('forfeit') }),
  z.object({ t: z.literal('emote'), slot: z.number().int().min(0).max(EMOTE_SLOTS - 1) }),
]);

/** The intent type name for a rejection, even when the payload didn't parse. */
export function intentName(raw: unknown): string {
  const t = typeof raw === 'object' && raw !== null ? (raw as { t?: unknown }).t : undefined;
  return typeof t === 'string' ? t.slice(0, 24) : 'unknown';
}
