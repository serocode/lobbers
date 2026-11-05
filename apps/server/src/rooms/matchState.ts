// MatchRoom schema: the small, frequently changing part of a match (docs/NETWORK.md § Match state).
// Unit HP/positions travel in protocol messages (snapshots at the end of each replayed action) so the
// HUD changes in step with the animation; the schema carries turn/phase/timer/wind/connection.
import { MapSchema, Schema, type } from '@colyseus/schema';
import type { MatchStateView, TurnPhase } from '@lobbers/shared';

export class MatchState extends Schema {
  @type('string') phase: TurnPhase = 'waiting';
  @type('uint16') turnNumber = 0;
  @type('string') activeUnitId = '';
  @type('float64') endsAt = 0;
  @type('int8') wind = 0;
  @type('uint8') shotsLeft = 0;
  /** playerId → server epoch ms when the reconnect window closes (present only while offline). */
  @type({ map: 'float64' }) offline = new MapSchema<number>();

  apply(v: MatchStateView): void {
    this.phase = v.phase;
    this.turnNumber = v.turnNumber;
    this.activeUnitId = v.activeUnitId ?? '';
    this.endsAt = v.endsAt;
    this.wind = v.wind;
    this.shotsLeft = v.shotsLeft;
    for (const id of [...this.offline.keys()]) if (!(id in v.offline)) this.offline.delete(id);
    for (const [id, until] of Object.entries(v.offline)) if (this.offline.get(id) !== until) this.offline.set(id, until);
  }
}
