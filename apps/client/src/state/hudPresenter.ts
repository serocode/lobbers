// Turns replayed outcomes into HUD state: HP bars, statuses, turn banner, kill feed, combat log,
// elimination ribbon, hurt vignette. Copy follows Battle.dc.html.
import {
  MACHINES, WEAPONS, type ActionResolvedMsg, type MapDef, type MatchEndedMsg, type SimEvent, type TurnStartedMsg, type UnitState,
} from '@lobbers/shared';
import { TEAM_COLOR, isLocal, unitOf, type LogLine, type MatchStore, type MatchView } from './matchStore';
import type { ReplayPresenter } from './replay';

const MAX_LOG = 7;
const MAX_FEED = 3;

export function createHudPresenter(store: MatchStore, map: () => MapDef | null): ReplayPresenter {
  let seq = 1;
  let firedThisTurn = false;
  let prevActive: string | null = null;
  const get = (): MatchView => store.getState();
  const name = (id: string | null): string => (id ? unitOf(get(), id)?.name ?? '?' : '?');
  const teamCol = (id: string | null): string => { const u = id ? unitOf(get(), id) : undefined; return u ? TEAM_COLOR[u.team] : '#A9B3CC'; };
  const tag = (): string => `T${get().turnNumber} · `;
  const log = (text: string, color: string): void => store.setState((s) => ({ log: [{ id: seq++, text, color } satisfies LogLine, ...s.log].slice(0, MAX_LOG) }));
  const patchUnit = (id: string, p: (u: UnitState) => UnitState): void => store.setState((s) => ({ units: s.units.map((u) => (u.id === id ? p(u) : u)) }));
  const isHotSeat = (): boolean => get().localPlayerIds.length > 1;

  return {
    turnStarted(msg: TurnStartedMsg) {
      const s = get();
      if (prevActive && !firedThisTurn) {
        const pu = unitOf(s, prevActive);
        if (pu?.alive) log(`${tag()}${pu.name} ran out of time`, '#8A93A8');
      }
      firedThisTurn = false;
      prevActive = msg.activeUnitId;
      const u = unitOf(s, msg.activeUnitId);
      const mine = isLocal(s, u);
      const arrow = msg.wind === 0 ? '' : msg.wind > 0 ? ' →' : ' ←';
      const secs = s.settings?.turnSeconds ?? 30;
      // Online: YOUR TURN / {NAME}. Hot seat: hand the device over (DESIGN_SPEC §3.9 "PASS TO {NAME}").
      const title = isHotSeat() ? `PASS TO ${(u?.name ?? '').toUpperCase()}` : mine ? 'YOUR TURN' : (u?.name ?? '').toUpperCase();
      const color = mine && !isHotSeat() ? '#FFD166' : u ? TEAM_COLOR[u.team] : '#FFD166';
      store.setState({
        turnNumber: msg.turnNumber, activeUnitId: msg.activeUnitId, wind: msg.wind, endsAt: msg.endsAt, burnZones: msg.burnZones,
        armed: { special: false, ultimate: false },
        banner: { id: seq++, title, color, sub: `Turn ${msg.turnNumber} · wind ${Math.abs(msg.wind)}${arrow}${mine ? ` · ${secs} seconds` : ' is aiming'}` },
      });
    },

    actionStart(a: ActionResolvedMsg) {
      if (a.kind === 'shot') {
        firedThisTurn = true;
        store.setState({ armed: { special: false, ultimate: false } });
      }
      if (a.kind === 'ability') {
        const u = unitOf(get(), a.unitId);
        if (!u) return;
        const m = MACHINES[u.machine];
        const after = a.units.find((x) => x.id === a.unitId);
        const usedSpecial = !!after && after.specialCooldown > u.specialCooldown;
        const def = usedSpecial ? m.special : m.ultimate;
        const shotMod = def.effects.some((e) => e.type === 'shotModifier');
        if (shotMod) store.setState((s) => ({ armed: { ...s.armed, [usedSpecial ? 'special' : 'ultimate']: true } }));
        log(`${tag()}${u.name} used ${def.name}`, usedSpecial ? '#F28C38' : '#B07CF2');
      }
    },

    event(e: SimEvent) {
      switch (e.t) {
        case 'damage': {
          patchUnit(e.unitId, (u) => ({ ...u, hp: e.hpAfter }));
          const s = get();
          const v = unitOf(s, e.unitId);
          if (v && isLocal(s, v) && (!isHotSeat() || v.id === s.activeUnitId)) store.setState({ hurtAt: performance.now() });
          if (e.cause === 'burn') log(`${tag()}${name(e.unitId)} took ${e.amount} burn damage`, '#FF6B3D');
          return;
        }
        case 'heal':
          patchUnit(e.unitId, (u) => ({ ...u, hp: e.hpAfter }));
          log(`${tag()}${name(e.unitId)} grabbed a repair kit`, '#5ACB91');
          return;
        case 'status':
          patchUnit(e.unitId, (u) => ({ ...u, status: {
            ...u.status,
            frozenTurns: e.status === 'frozen' ? e.value : u.status.frozenTurns,
            shield: e.status === 'shield' ? { reduction: u.status.shield?.reduction ?? 0.5, rounds: e.value } : u.status.shield,
            unlimitedFuel: e.status === 'unlimitedFuel' ? e.value > 0 : u.status.unlimitedFuel,
          } }));
          return;
        case 'eliminated': {
          const victim = unitOf(get(), e.unitId);
          if (!victim) return;
          patchUnit(e.unitId, (u) => ({ ...u, hp: 0, alive: false }));
          const hazard = map()?.hazard.kind;
          const how = e.cause === 'forfeit' ? 'FORFEITED' : e.cause === 'hazard' && hazard === 'void' ? 'FELL INTO THE VOID' : 'ELIMINATED';
          if (e.cause === 'forfeit') log(`${tag()}${victim.name} forfeited`, '#A9B3CC');
          else if (e.cause === 'hazard') log(`${tag()}${victim.name} ${hazard === 'void' ? 'fell into the void' : hazard === 'lava' ? 'sank into the lava' : 'sank into the icy water'}`, '#FFD166');
          else if (e.cause === 'fall') log(`${tag()}${victim.name} did not survive the fall`, '#FFD166');
          else log(`${tag()}${e.byUnitId ? name(e.byUnitId) : 'A barrel'} eliminated ${victim.name}`, '#FFD166');
          store.setState((s) => ({
            elim: { id: seq++, name: victim.name.toUpperCase(), machine: victim.machine, how },
            feed: [...s.feed, { id: seq++, killer: e.byUnitId ? name(e.byUnitId) : e.cause === 'hazard' ? 'Gravity' : e.cause === 'forfeit' ? 'Forfeit' : 'Barrel', killerColor: teamCol(e.byUnitId), victim: victim.name, victimColor: TEAM_COLOR[victim.team] }].slice(-MAX_FEED),
          }));
          return;
        }
        case 'prop':
          if (e.change === 'exploded') log(`${tag()}A barrel exploded`, '#FF8A3D');
          return;
        default:
      }
    },

    matchEnded(m: MatchEndedMsg) {
      store.setState({ result: m, banner: null });
    },

    actionEnd(a: ActionResolvedMsg) {
      store.setState({ units: a.units.map((u) => structuredClone(u)) });
      if (a.kind !== 'shot' || !('tracks' in a.result)) return;
      const shooter = unitOf(get(), a.unitId);
      if (!shooter) return;
      const dmg = a.result.events.filter((e): e is Extract<SimEvent, { t: 'damage' }> => e.t === 'damage' && e.sourceUnitId === a.unitId && e.cause !== 'burn');
      const total = dmg.reduce((n, e) => n + e.amount, 0);
      const names = [...new Set(dmg.map((e) => name(e.unitId)))];
      const exploded = a.result.events.some((e) => e.t === 'explosion');
      const weapon = WEAPONS[a.result.tracks[0]?.weaponId ?? 'standard-rocket'];
      if (total > 0) log(`${tag()}${shooter.name} hit ${names.join(', ')} for ${total}`, TEAM_COLOR[shooter.team]);
      else if (!exploded) log(`${tag()}${shooter.name} sailed off the map`, '#8A93A8');
      else log(`${tag()}${shooter.name} missed with ${weapon.name}`, '#8A93A8');
    },
  };
}
