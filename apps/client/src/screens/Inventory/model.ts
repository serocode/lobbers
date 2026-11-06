// Inventory view model (Inventory.dc.html `data()` / `renderVals()`), built from the catalog + the local profile.
// Pure: the screen renders it and calls `actOn` with what the player pressed.
import {
  COSMETICS, DEFAULT_EQUIPPED, EMOTE_SLOTS, MACHINES, MACHINE_LIST, MACHINE_UNLOCKS, avatarItemId, emoteSlot, equip, machineItemId, ownsMachine,
  purchase, requirementProgress, requirementText, setFavoriteMachine, unlockByRequirement,
  type CosmeticItem, type LocalProfile, type MachineId, type Rarity, type Requirement, type Verdict, type WeaponIconId,
} from '@lobbers/shared';

export type Preview =
  | { type: 'machine'; kind: MachineId; paint?: string }
  | { type: 'weapon'; icon: WeaponIconId; color: string }
  | { type: 'trail'; color: string }
  | { type: 'explosion'; color: string }
  | { type: 'emote'; text: string }
  | { type: 'title' };

export type ItemAction =
  | { kind: 'equip' } | { kind: 'equipped' }
  | { kind: 'buy'; currency: 'coins' | 'gems'; price: number; afford: boolean }
  | { kind: 'unlock' }
  | { kind: 'locked' };

export interface InvItem {
  id: string; name: string; rarity: Rarity; bg: string; description: string; preview: Preview;
  owned: boolean; equipped: boolean;
  /** Profile slot this item equips into ("trail", "skin:thumper", "emote:2", "avatar", "machine"). */
  slot: string;
  /** Equipped and removable (falls back to the default / nothing). */
  canUnequip: boolean;
  /** Preview-pane source line ("In your collection" / "Unlock: …"). */
  source: string;
  action: ItemAction;
}

export interface InvCategory { name: string; icon: string; items: InvItem[] }

/** Rarity → colour (Inventory.dc.html RC). */
export const RARITY_COLOR: Record<Rarity, string> = { Common: '#A9B3CC', Rare: '#4C9AFF', Epic: '#B07CF2', Legendary: '#FFD166' };
/** Machine card grounds (Inventory.dc.html MB). */
export const MACHINE_BG: Record<MachineId, string> = {
  thumper: '#4A2E1E', sprocket: '#1E3E33', mollusk: '#33264E', whirligig: '#1B3A48', voltaic: '#3E3820', cinder: '#4A221C', frostbite: '#1E3A50', boomba: '#4A2440',
};
/** The mockup lists machines in this order. */
const MOCKUP_ORDER: MachineId[] = ['thumper', 'sprocket', 'mollusk', 'whirligig', 'voltaic', 'cinder', 'frostbite', 'boomba'];

const priceText = (currency: 'coins' | 'gems', price: number): string => `${price.toLocaleString('en-US')} ${currency}`;
const lockedSource = (p: LocalProfile, need: Requirement): string => {
  const r = requirementProgress(p, need);
  return `Unlock: ${requirementText(need)}${r.goal > 1 ? ` (${r.value.toLocaleString('en-US')} / ${r.goal.toLocaleString('en-US')})` : ''}`;
};

function cosmeticSlot(c: CosmeticItem, p: LocalProfile): string {
  switch (c.slot) {
    case 'skin': return `skin:${c.machine}`;
    case 'weaponSkin': return `weaponSkin:${c.category}`;
    case 'emote': { for (let i = 0; i < EMOTE_SLOTS; i++) if (p.equipped[emoteSlot(i)] === c.id) return emoteSlot(i); return 'emote'; }
    default: return c.slot;
  }
}

function preview(c: CosmeticItem): Preview {
  switch (c.slot) {
    case 'skin': return { type: 'machine', kind: c.machine, paint: c.paint };
    case 'weaponSkin': return { type: 'weapon', icon: c.category, color: c.color };
    case 'trail': return { type: 'trail', color: c.color };
    case 'explosion': return { type: 'explosion', color: c.color };
    case 'emote': return { type: 'emote', text: c.text };
    case 'title': return { type: 'title' };
  }
}

function cosmeticItem(c: CosmeticItem, p: LocalProfile): InvItem {
  const owned = p.owned.includes(c.id);
  const slot = cosmeticSlot(c, p);
  const equipped = p.equipped[slot] === c.id;
  // Skins / weapon skins come off entirely; trail/explosion/title/emotes fall back to the default item.
  const canUnequip = equipped && (c.slot === 'skin' || c.slot === 'weaponSkin' || (c.slot !== 'emote' && DEFAULT_EQUIPPED[slot] !== c.id));
  let action: ItemAction = owned ? { kind: equipped ? 'equipped' : 'equip' } : { kind: 'locked' };
  let source = owned ? (c.unlock.kind === 'default' ? 'Starter item' : 'In your collection') : 'Unlock: coming soon';
  if (!owned) {
    if (c.unlock.kind === 'coins' || c.unlock.kind === 'gems') {
      const have = c.unlock.kind === 'coins' ? p.coins : p.gems;
      action = { kind: 'buy', currency: c.unlock.kind, price: c.unlock.price, afford: have >= c.unlock.price };
      source = `Unlock: ${priceText(c.unlock.kind, c.unlock.price)}`;
    } else if (c.unlock.kind === 'requirement') {
      action = requirementProgress(p, c.unlock.need).met ? { kind: 'unlock' } : { kind: 'locked' };
      source = lockedSource(p, c.unlock.need);
    }
  }
  return { id: c.id, name: c.name, rarity: c.rarity, bg: c.bg, description: c.description, preview: preview(c), owned, equipped, slot, canUnequip, source, action };
}

function machineItem(id: MachineId, p: LocalProfile): InvItem {
  const owned = ownsMachine(p, id);
  const unlock = MACHINE_UNLOCKS[id];
  let action: ItemAction = owned ? { kind: p.favoriteMachine === id ? 'equipped' : 'equip' } : { kind: 'locked' };
  let source = owned ? 'In your collection' : 'Unlock: coming soon';
  if (!owned && unlock?.kind === 'coins') { action = { kind: 'buy', currency: 'coins', price: unlock.price, afford: p.coins >= unlock.price }; source = `Unlock: ${priceText('coins', unlock.price)}`; }
  if (!owned && unlock?.kind === 'requirement') { action = requirementProgress(p, unlock.need).met ? { kind: 'unlock' } : { kind: 'locked' }; source = lockedSource(p, unlock.need); }
  return {
    id: machineItemId(id), name: MACHINES[id].name, rarity: id === 'boomba' ? 'Legendary' : id === 'frostbite' ? 'Epic' : 'Rare', bg: MACHINE_BG[id],
    description: `Unlock the ${MACHINES[id].name} chassis for every mode.`, preview: { type: 'machine', kind: id },
    owned, equipped: owned && p.favoriteMachine === id, slot: 'machine', canUnequip: false, source, action,
  };
}

function avatarItem(id: MachineId, i: number, p: LocalProfile): InvItem {
  const owned = ownsMachine(p, id);
  const itemId = avatarItemId(id);
  const equipped = owned && p.equipped.avatar === itemId;
  return {
    id: itemId, name: `${MACHINES[id].name} Portrait`, rarity: i < 5 ? 'Common' : 'Rare', bg: MACHINE_BG[id],
    description: `Show off your ${MACHINES[id].name} in lobbies and on your profile.`, preview: { type: 'machine', kind: id },
    owned, equipped, slot: 'avatar', canUnequip: equipped, source: owned ? 'Unlocked with the machine' : `Unlock: Own the ${MACHINES[id].name} machine`,
    action: owned ? { kind: equipped ? 'equipped' : 'equip' } : { kind: 'locked' },
  };
}

const ICONS = {
  machines: 'M2 18h20M5 18l2-5h9l2 5M12 13V9h8', skins: 'M12 3l8 4v6c0 4-4 7-8 8-4-1-8-4-8-8V7z', weapons: 'M4 20l7-7M14 4l6 6-7 7-6-6z',
  trails: 'M3 18c5-10 10-12 18-6', explosions: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3',
  avatars: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z', emotes: 'M4 4h16v11H11l-5 4v-4H4z', titles: 'M4 7h16M4 12h11M4 17h14',
} as const;

export function inventory(p: LocalProfile): InvCategory[] {
  const order = MOCKUP_ORDER.filter((m) => MACHINE_LIST.some((x) => x.id === m));
  const of = (slot: CosmeticItem['slot']): InvItem[] => COSMETICS.filter((c) => c.slot === slot).map((c) => cosmeticItem(c, p));
  return [
    { name: 'Battle Machines', icon: ICONS.machines, items: order.map((m) => machineItem(m, p)) },
    { name: 'Machine Skins', icon: ICONS.skins, items: of('skin') },
    { name: 'Weapon Skins', icon: ICONS.weapons, items: of('weaponSkin') },
    { name: 'Projectile Trails', icon: ICONS.trails, items: of('trail') },
    { name: 'Explosion Effects', icon: ICONS.explosions, items: of('explosion') },
    { name: 'Avatars', icon: ICONS.avatars, items: order.map((m, i) => avatarItem(m, i, p)) },
    { name: 'Emotes', icon: ICONS.emotes, items: of('emote') },
    { name: 'Titles', icon: ICONS.titles, items: of('title') },
  ];
}

/** Emote wheel slot an EQUIP goes to by default: the first slot still holding a default emote, else the last. */
export function defaultEmoteSlot(p: LocalProfile): string {
  for (let i = 0; i < EMOTE_SLOTS; i++) if (p.equipped[emoteSlot(i)] === DEFAULT_EQUIPPED[emoteSlot(i)]) return emoteSlot(i);
  return emoteSlot(EMOTE_SLOTS - 1);
}

export type InvCommand = { t: 'main'; emoteSlot?: string } | { t: 'unequip' };

/** Applies what the player pressed. Returns the new profile and the status line ("Unlocked Frostbite!"). */
export function actOn(p: LocalProfile, item: InvItem, cmd: InvCommand): Verdict<{ profile: LocalProfile; message: string }> {
  const done = (v: Verdict<LocalProfile>, message: string): Verdict<{ profile: LocalProfile; message: string }> => (v.ok ? { ok: true, value: { profile: v.value, message } } : v);
  if (cmd.t === 'unequip') {
    if (!item.canUnequip) return { ok: false, reason: 'nothing to unequip' };
    const fallback = item.slot === 'avatar' || item.slot.startsWith('skin:') || item.slot.startsWith('weaponSkin:') ? null : DEFAULT_EQUIPPED[item.slot] ?? null;
    return done(equip(p, item.slot, fallback), `${item.name} unequipped`);
  }
  switch (item.action.kind) {
    case 'equip':
      if (item.slot === 'machine') return done(setFavoriteMachine(p, item.id.slice('machine:'.length) as MachineId), `${item.name} equipped`);
      return done(equip(p, item.preview.type === 'emote' ? cmd.emoteSlot ?? defaultEmoteSlot(p) : item.slot, item.id), `${item.name} equipped`);
    case 'buy':
      return done(purchase(p, item.action.currency === 'coins' ? { id: item.id, priceCoins: item.action.price } : { id: item.id, priceGems: item.action.price }), `Unlocked ${item.name}!`);
    case 'unlock':
      return done(unlockByRequirement(p, item.id), `Unlocked ${item.name}!`);
    default:
      return { ok: false, reason: item.action.kind === 'equipped' ? 'already equipped' : 'locked' };
  }
}
