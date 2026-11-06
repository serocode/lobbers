import type { LobbyPlayer } from '../lobby.ts';
import type { PeerProfile } from '../protocol.ts';
import type { BotDifficulty } from '../config/bots.ts';
import { BotDriver } from '../bot/driver.ts';
import { PeerClient } from '../net/client.ts';
import { connectLoopback } from '../net/loopback.ts';
import type { HostClock } from './clock.ts';
import type { HostSession } from './session.ts';

/**
 * The bot seats a HostSession plays in its own tab. Each bot is a PeerClient + BotDriver over an in-memory link bound
 * with `session.connectBot`, so it plays only by sending intents — the host validates them like anyone else's.
 */
export class BotSeats {
  private readonly seats = new Map<string, { driver: BotDriver; link: { drop(): void } }>();

  private readonly session: HostSession;
  private readonly clock: HostClock;
  private readonly random: () => number;

  constructor(session: HostSession, clock: HostClock, random: () => number) {
    this.session = session; this.clock = clock; this.random = random;
  }

  has(playerId: string): boolean { return this.seats.has(playerId); }

  /** Starts the bot player for a lobby bot seat (no-op if it is already running or the seat isn't a bot). */
  attach(p: LobbyPlayer): void {
    if (!p.bot || this.seats.has(p.id)) return;
    const profile: PeerProfile = { id: p.id, name: p.name, level: p.level ?? 1, rating: p.rating ?? 1000, title: null, avatar: null, favoriteMachine: p.machine, cosmetics: {} };
    const client = new PeerClient({ code: this.session.code, profile, clock: this.clock });
    const driver = new BotDriver({ client, clock: this.clock, difficulty: p.bot, seed: Math.floor(this.random() * 2 ** 31) });
    const entry = { driver, link: { drop() {} } };
    this.seats.set(p.id, entry);   // before connecting: connectBot checks the seat synchronously
    entry.link = connectLoopback(this.session, client, { bot: p.id });
  }

  setDifficulty(playerId: string, d: BotDifficulty): void { this.seats.get(playerId)?.driver.setDifficulty(d); }

  /** Stops a bot's driver (the session closes its link). */
  detach(playerId: string): void {
    const b = this.seats.get(playerId);
    if (!b) return;
    this.seats.delete(playerId);
    b.driver.dispose();
  }

  disposeAll(): void { for (const id of [...this.seats.keys()]) this.detach(id); }
}
