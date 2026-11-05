// Every battle input (mouse, keyboard, HUD, touch) goes through here and becomes a ClientIntent.
// Local aim is UI state; the server clamps and validates everything on `fire`.
import {
  DEFAULT_QUICK_SLOTS, MACHINES, canActivate, canUseWeapon, clampAngle, clampPower, isGrounded,
  type WeaponId,
} from '@lobbers/shared';
import type { ClientMatch } from './ClientMatch';
import { arsenalOf, canControl, unitOf, type Aim, type MatchView } from './matchStore';

const MOVE_INTERVAL_MS = 100;
const MOVE_TICKS = 6;
const AIM_SYNC_MS = 100;
export const JUMP_FUEL = 12;

/** Quick slots 1–4: the default slots this unit can use this match, topped up from its arsenal. */
export function quickSlots(arsenal: readonly WeaponId[]): WeaponId[] {
  const slots = DEFAULT_QUICK_SLOTS.filter((w) => arsenal.includes(w));
  for (const w of arsenal) if (slots.length < 4 && !slots.includes(w)) slots.push(w);
  return slots.slice(0, 4);
}

/** Elevation above the horizon on the facing side (0–90 normally; >90 = shooting backwards). */
export const elevationOf = (angle: number): number => (angle <= 90 ? angle : 180 - angle);

export class BattleControls {
  private moveTimer: ReturnType<typeof setInterval> | null = null;
  private moveDir: -1 | 1 = 1;
  private lastAimSync = 0;
  private aimSyncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly match: ClientMatch) {}

  private get v(): MatchView { return this.match.store.getState(); }
  get enabled(): boolean { return canControl(this.v); }

  /** Send one of your equipped emotes (any time; hot-seat: the active player's). Server rate-limits. */
  emote(slot: number): void { this.match.send({ t: 'emote', slot }); }
  activeAim(): Aim | null { const id = this.v.activeUnitId; return id ? this.v.aim[id] ?? null : null; }

  // ---------- aim ----------
  setAim(p: Partial<Aim>): void {
    const id = this.v.activeUnitId;
    if (!id || !this.enabled) return;
    const cur = this.v.aim[id];
    if (!cur) return;
    const next: Aim = {
      angle: p.angle === undefined ? cur.angle : Math.round(clampAngle(p.angle)),
      power: p.power === undefined ? cur.power : Math.round(clampPower(p.power)),
      weaponId: p.weaponId ?? cur.weaponId,
    };
    if (next.angle === cur.angle && next.power === cur.power && next.weaponId === cur.weaponId) return;
    this.match.store.setState((s) => ({ aim: { ...s.aim, [id]: next } }));
    this.syncAim();
  }
  setAngle(a: number): void { this.setAim({ angle: a }); }
  nudgeAngle(d: number): void { const a = this.activeAim(); if (a) this.setAngle(a.angle + d); }
  /** ↑/↓: raise/lower the barrel on the side the machine faces. */
  nudgeElevation(d: number): void {
    const a = this.activeAim();
    if (!a) return;
    this.setAngle(a.angle <= 90 ? Math.min(90, a.angle + d) : Math.max(90, a.angle - d));
  }
  setPower(p: number): void { this.setAim({ power: p }); }
  nudgePower(d: number): void { const a = this.activeAim(); if (a) this.setPower(a.power + d); }

  /** Client-side check for UI state; the server re-validates. */
  canUse(weaponId: WeaponId): boolean {
    const w = this.match.world, id = this.v.activeUnitId;
    if (!w || !id) return false;
    const u = w.units.find((x) => x.id === id);
    return !!u && canUseWeapon(w, id, weaponId).ok;
  }
  selectWeapon(weaponId: WeaponId): void {
    if (!this.enabled || !this.canUse(weaponId)) return;
    this.setAim({ weaponId });
    this.match.send({ t: 'selectWeapon', weaponId });
  }
  quickSlot(i: number): void {
    const u = unitOf(this.v, this.v.activeUnitId);
    if (!u) return;
    const w = quickSlots(arsenalOf(this.v, u))[i];
    if (w) this.selectWeapon(w);
  }

  private syncAim(): void {
    const send = (): void => {
      this.aimSyncTimer = null;
      this.lastAimSync = performance.now();
      const a = this.activeAim();
      if (a && this.enabled) this.match.send({ t: 'aim', angle: a.angle, power: a.power, weaponId: a.weaponId });
    };
    const wait = AIM_SYNC_MS - (performance.now() - this.lastAimSync);
    if (wait <= 0) send();
    else if (!this.aimSyncTimer) this.aimSyncTimer = setTimeout(send, wait);
  }

  // ---------- actions ----------
  fire(): void {
    const id = this.v.activeUnitId, a = this.activeAim();
    if (!this.enabled || !id || !a) return;
    this.stopMove();
    this.match.store.setState((s) => ({ lastPower: { ...s.lastPower, [id]: a.power } }));
    this.match.send({ t: 'fire', aim: { angle: a.angle, power: a.power, weaponId: a.weaponId } });
  }

  useAbility(slot: 'special' | 'ultimate'): void {
    const w = this.match.world, id = this.v.activeUnitId;
    if (!this.enabled || !w || !id || !canActivate(w, id, slot).ok) return;
    this.match.send({ t: 'useAbility', slot });
  }

  canMove(): boolean {
    const u = unitOf(this.v, this.v.activeUnitId);
    return this.enabled && !!u && u.status.frozenTurns === 0 && (u.fuel > 0 || u.status.unlimitedFuel);
  }
  canJump(): boolean {
    const w = this.match.world, u = unitOf(this.v, this.v.activeUnitId);
    const mu = w?.units.find((x) => x.id === u?.id);
    return this.enabled && !!u && !!w && !!mu && u.status.frozenTurns === 0 && (u.fuel >= JUMP_FUEL || u.status.unlimitedFuel) && isGrounded(w, mu);
  }
  jump(): void { if (this.canJump()) this.match.send({ t: 'jump' }); }

  /** Hold-to-walk: one `move` intent every 100 ms (6 ticks) while held. */
  startMove(dir: -1 | 1): void {
    if (!this.canMove()) return;
    this.moveDir = dir;
    this.faceTowards(dir);
    if (this.moveTimer) return;
    const step = (): void => { if (this.canMove()) this.match.send({ t: 'move', dir: this.moveDir, ticks: MOVE_TICKS }); else this.stopMove(); };
    step();
    this.moveTimer = setInterval(step, MOVE_INTERVAL_MS);
  }
  stopMove(): void { if (this.moveTimer) { clearInterval(this.moveTimer); this.moveTimer = null; } }
  /** A single tap step (HUD buttons on click). */
  stepMove(dir: -1 | 1): void {
    if (!this.canMove()) return;
    this.faceTowards(dir);
    this.match.send({ t: 'move', dir, ticks: MOVE_TICKS });
  }

  /** Walking turns the machine; keep the same elevation on the new side. */
  private faceTowards(dir: -1 | 1): void {
    const a = this.activeAim();
    if (!a) return;
    const facingRight = a.angle <= 90;
    if ((dir > 0) !== facingRight) this.setAngle(180 - a.angle);
  }

  dispose(): void { this.stopMove(); if (this.aimSyncTimer) clearTimeout(this.aimSyncTimer); }
}
