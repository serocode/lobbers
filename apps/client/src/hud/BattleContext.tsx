import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { MACHINES, WEAPONS, type MachineDef, type UnitState, type WeaponDef, type WeaponId } from '@lobbers/shared';
import type { ClientMatch } from '../state/ClientMatch';
import type { BattleControls } from '../state/battleControls';
import { canControl, unitOf, type MatchView } from '../state/matchStore';

/** What the pause menu and victory overlay buttons do (hot-seat vs online differ in copy and target). */
export interface BattleNav {
  /** Pause → confirm → surrender. Online: server `forfeit`, then home. */
  surrender(): void;
  surrenderNote: string;
  /** SEE RESULTS; undefined → disabled with `resultsReason`. */
  seeResults?: () => void;
  resultsReason?: string;
  playAgain?: () => void;
  playAgainLabel: string;
  playAgainReason?: string;
  back(): void;
  backLabel: string;
}

export interface BattleCtx { match: ClientMatch; controls: BattleControls; nav: BattleNav }

const Ctx = createContext<BattleCtx | null>(null);

export function BattleProvider({ value, children }: { value: BattleCtx; children: ReactNode }): JSX.Element {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBattle(): BattleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('BattleProvider missing');
  return c;
}

/** Select from the match view store (select primitives or stable references). */
export function useMatch<T>(sel: (v: MatchView) => T): T {
  return useStore(useBattle().match.store, sel);
}

export const useCanControl = (): boolean => useMatch(canControl);
export const useActiveUnit = (): UnitState | undefined => useMatch((v) => unitOf(v, v.activeUnitId));

/**
 * The machine the controls deck shows: online → your own unit; hot-seat → the active unit
 * (whoever holds the device), falling back to the first local unit.
 */
export function useDeckUnit(): UnitState | undefined {
  return useMatch((v) => {
    if (v.localPlayerIds.length === 1) return v.units.find((u) => u.playerId === v.localPlayerIds[0]);
    const a = unitOf(v, v.activeUnitId);
    return a ?? v.units[0];
  });
}

/** Seconds left on the turn timer, from the server's `endsAt` and the transport clock. */
export function useTurnSeconds(): number {
  const { match } = useBattle();
  const endsAt = useMatch((v) => v.endsAt);
  const phase = useMatch((v) => v.sync.phase);
  const [now, setNow] = useState(() => match.transport.serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(match.transport.serverNow()), 250);
    return () => clearInterval(t);
  }, [match]);
  if (!endsAt || phase === 'waiting' || phase === 'ended') return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export interface WeaponInfo { def: WeaponDef; dmgTxt: string; rad: number; ammoTxt: string; ammo: number; cooldown: number }

/** Display numbers for a weapon (cluster / airstrike show N×damage like the mockup). */
export function weaponInfo(id: WeaponId, u: UnitState | undefined): WeaponInfo {
  const def = WEAPONS[id], b = def.behavior;
  const dmgTxt = b.kind === 'cluster' ? `${b.count}×${b.childDamage}` : b.kind === 'airstrike' ? `${b.bombs}×${b.bombDamage}` : String(def.damage);
  const rad = b.kind === 'airstrike' ? b.bombRadius : def.radius;
  const ammo = u?.ammo[id] ?? def.ammo;
  return { def, dmgTxt, rad, ammo, ammoTxt: ammo < 0 ? '∞' : String(ammo), cooldown: u?.weaponCooldowns[id] ?? 0 };
}

export const machineOf = (u: UnitState | undefined): MachineDef => MACHINES[u?.machine ?? 'thumper'];
