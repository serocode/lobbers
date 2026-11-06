import type { MachineId, MatchSettings, TeamId, WeaponId } from '../types.ts';
import { MACHINES } from '../config/machines.ts';
import { WEAPONS } from '../config/weapons.ts';
import { MAPS } from '../config/maps.ts';
import { ROOM_LIMITS, SETTING_OPTIONS } from '../config/match.ts';
import { EMOTE_SLOTS } from '../config/cosmetics.ts';
import { BOT_DIFFICULTIES, type BotDifficulty } from '../config/bots.ts';
import { MAX_PEER_MESSAGE_CHARS, type PeerMessage, type PeerProfile } from '../protocol.ts';

// Shape validation for everything a peer sends. The host calls `parsePeerMessage` on every inbound message and
// silently drops anything that returns null. (Game legality is checked afterwards by rules.ts / lobby.ts.)
// Hand-written so packages/shared stays dependency-free; if your app already uses zod, keep these semantics.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const team = (v: unknown): v is TeamId => v === 'red' || v === 'blue';
const machine = (v: unknown): v is MachineId => typeof v === 'string' && v in MACHINES;
const weapon = (v: unknown): v is WeaponId => typeof v === 'string' && v in WEAPONS;
const difficulty = (v: unknown): v is BotDifficulty => (BOT_DIFFICULTIES as readonly unknown[]).includes(v);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Display names: 3–16 visible characters, no control characters, trimmed. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 3 && s.length <= 16 ? s : null;
}

// Chat hygiene hook (docs/NETWORK.md: length cap + profanity filter). Swap the list here; nothing else filters.
const BLOCKLIST = ['fuck', 'shit', 'cunt', 'nigger', 'faggot', 'retard', 'bitch'];
const BLOCKED = new RegExp(`\\b(${BLOCKLIST.join('|')})\\w*`, 'gi');

/** Strips control characters, collapses whitespace, caps length and masks the blocklist. */
export function cleanChat(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ROOM_LIMITS.chatMaxLength);
  return s.length ? s.replace(BLOCKED, (w) => w[0] + '*'.repeat(Math.max(0, w.length - 1))) : null;
}

function parseCosmetics(v: unknown): Record<string, string> {
  const cosmetics: Record<string, string> = {};
  if (isObj(v)) for (const [k, c] of Object.entries(v).slice(0, 24)) if (str(k, 40) && str(c, 60)) cosmetics[k] = c;
  return cosmetics;
}

function parseProfile(v: unknown): PeerProfile | null {
  if (!isObj(v) || !str(v.id, 64) || !(v.id as string).length) return null;
  const name = cleanName(v.name);
  if (!name) return null;
  const cosmetics = parseCosmetics(v.cosmetics);
  return {
    id: v.id as string, name,
    level: num(v.level) ? clamp(Math.floor(v.level), 1, 999) : 1,
    rating: num(v.rating) ? clamp(Math.floor(v.rating), 0, 99999) : 1000,
    title: str(v.title, 40) ? (v.title as string) : null,
    avatar: str(v.avatar, 60) ? (v.avatar as string) : null,
    favoriteMachine: machine(v.favoriteMachine) ? v.favoriteMachine : 'thumper',
    cosmetics,
  };
}

function parseSettingsPatch(v: unknown): Partial<MatchSettings> | null {
  if (!isObj(v)) return null;
  const out: Partial<MatchSettings> = {};
  const pick = <K extends keyof typeof SETTING_OPTIONS>(k: K): void => {
    if (k in v && (SETTING_OPTIONS[k] as readonly unknown[]).includes(v[k])) (out as Obj)[k] = v[k];
  };
  pick('mode'); pick('turnSeconds'); pick('wind'); pick('itemsEnabled'); pick('friendlyFire'); pick('bestOf');
  if (typeof v.mapId === 'string' && v.mapId in MAPS) out.mapId = v.mapId as MatchSettings['mapId'];
  if (typeof v.isPrivate === 'boolean') out.isPrivate = v.isPrivate;
  return Object.keys(out).length ? out : null;
}

/** Returns a sanitised message or null (drop it). Accepts a JSON string or an already-parsed object. */
export function parsePeerMessage(raw: unknown): PeerMessage | null {
  let m: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_PEER_MESSAGE_CHARS) return null;
    try { m = JSON.parse(raw); } catch { return null; }
  }
  if (!isObj(m) || typeof m.t !== 'string') return null;
  switch (m.t) {
    case 'hello': {
      const profile = parseProfile(m.profile);
      if (!num(m.v) || !profile) return null;
      return { t: 'hello', v: m.v, profile, ...(str(m.rejoinToken, 80) ? { rejoinToken: m.rejoinToken as string } : {}) };
    }
    case 'ping': return num(m.clientTime) ? { t: 'ping', clientTime: m.clientTime, ...(num(m.rtt) ? { rtt: clamp(Math.round(m.rtt), 0, 9999) } : {}) } : null;
    case 'emote': return num(m.slot) && Number.isInteger(m.slot) && m.slot >= 0 && m.slot < EMOTE_SLOTS ? { t: 'emote', slot: m.slot } : null;
    case 'loaded': case 'leave': case 'jump': case 'skipTurn': case 'forfeit': case 'startMatch': return { t: m.t };
    case 'setTeam': return team(m.team) ? { t: 'setTeam', team: m.team } : null;
    case 'setMachine': return machine(m.machine) ? { t: 'setMachine', machine: m.machine } : null;
    case 'setReady': return typeof m.ready === 'boolean' ? { t: 'setReady', ready: m.ready } : null;
    case 'updateSettings': { const patch = parseSettingsPatch(m.patch); return patch ? { t: 'updateSettings', patch } : null; }
    case 'kick': return str(m.playerId, 64) ? { t: 'kick', playerId: m.playerId as string } : null;
    case 'addBot': return team(m.team) && difficulty(m.difficulty) ? { t: 'addBot', team: m.team, difficulty: m.difficulty, ...(machine(m.machine) ? { machine: m.machine } : {}) } : null;
    case 'setBot': return str(m.playerId, 64) && difficulty(m.difficulty) ? { t: 'setBot', playerId: m.playerId as string, difficulty: m.difficulty } : null;
    case 'chat': { const text = cleanChat(m.text); return text ? { t: 'chat', text } : null; }
    case 'setCosmetics': return isObj(m.cosmetics) ? { t: 'setCosmetics', cosmetics: parseCosmetics(m.cosmetics), title: str(m.title, 40) ? (m.title as string) : null } : null;
    case 'aim': return num(m.angle) && num(m.power) && weapon(m.weaponId) ? { t: 'aim', angle: clamp(m.angle, 0, 180), power: clamp(m.power, 0, 100), weaponId: m.weaponId } : null;
    case 'move': return (m.dir === 1 || m.dir === -1) && num(m.ticks) ? { t: 'move', dir: m.dir, ticks: clamp(Math.round(m.ticks), 1, 10) } : null;
    case 'selectWeapon': return weapon(m.weaponId) ? { t: 'selectWeapon', weaponId: m.weaponId } : null;
    case 'useAbility': return m.slot === 'special' || m.slot === 'ultimate' ? { t: 'useAbility', slot: m.slot } : null;
    case 'fire': {
      const a = m.aim;
      if (!isObj(a) || !num(a.angle) || !num(a.power) || !weapon(a.weaponId)) return null;
      return { t: 'fire', aim: { angle: a.angle, power: a.power, weaponId: a.weaponId } };
    }
    default: return null;
  }
}
