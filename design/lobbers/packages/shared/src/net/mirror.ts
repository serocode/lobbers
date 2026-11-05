import type { ActionResolvedMsg, MatchStartedMsg, MatchView } from '../protocol.ts';
import { Terrain } from '../sim/terrain.ts';
import { createWorld, type SeatInput, type World } from '../sim/world.ts';

/**
 * A peer's local copy of the battlefield. Built from `matchStarted`, kept in step by applying `actionResolved`.
 * Used for: the Phaser terrain texture (carve the same circles), the trajectory preview (`predictTrajectory(mirror.world, …)`),
 * and desync detection (`applyAction` returns false when the local terrain hash differs from the host's).
 * It never decides outcomes — the host's snapshot always wins.
 */
export class WorldMirror {
  world: World;
  desyncs = 0;

  constructor(started: MatchStartedMsg) {
    const seats: SeatInput[] = started.units.map((u) => ({ playerId: u.playerId, name: u.name, team: u.team, machine: u.machine, slot: Number(u.id.split('-')[1] ?? 0) }));
    this.world = createWorld(started.settings, seats, Terrain.decodeRLE(started.width, started.height, started.terrainRLE));
    this.world.units = structuredClone(started.units);
    this.world.props = started.props.map((p) => ({ ...p }));
    this.world.burnZones = started.burnZones.map((z) => ({ ...z }));
    this.world.wind = started.wind;
  }

  /** Apply one resolved action. Returns true if the terrain matches the host afterwards. */
  applyAction(msg: ActionResolvedMsg): boolean {
    for (const e of msg.result.events) {
      if (e.t === 'carve') this.world.terrain.carveCircle(e.x, e.y, e.r);
      else if (e.t === 'burnZone') this.world.burnZones.push({ ...e.zone });
    }
    this.world.units = structuredClone(msg.units);
    this.world.props = msg.props.map((p) => ({ ...p }));
    const ok = this.world.terrain.hash() === msg.result.terrainHash;
    if (!ok) this.desyncs++;
    return ok;
  }

  /** Keep wind/units current between actions (turn start upkeep, reconnects). */
  applyView(view: MatchView): void {
    this.world.wind = view.wind;
    this.world.units = structuredClone(view.units);
  }
}
