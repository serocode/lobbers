import type { AimInput, ShotModifier, UnitState } from '../types.ts';
import { BOT_RULES, BOT_TUNING, type BotDifficulty } from '../config/bots.ts';
import type { HostClock } from '../host/clock.ts';
import type { PeerClient } from '../net/client.ts';
import { WorldMirror } from '../net/mirror.ts';
import { createRng, type Rng } from '../sim/rng.ts';
import { abilityModifiers, approachDir, chooseAbility, planShot } from './brain.ts';

export interface BotDriverOptions {
  client: PeerClient;
  clock: HostClock;
  difficulty: BotDifficulty;
  seed: number;
}

interface TurnPlan { key: string; acted: boolean; abilityDone: boolean; movesLeft: number | null; modifiers: ShotModifier[]; rejections: number }

const ticksToMs = (ticks: number): number => Math.ceil((ticks / 60) * 1000);
const fresh = (key: string): TurnPlan => ({ key, acted: false, abilityDone: false, movesLeft: null, modifiers: [], rejections: 0 });

/**
 * Plays one bot seat. It sees the match exactly like a human peer — through its PeerClient (matchStarted /
 * actionResolved / matchState) and a WorldMirror — and acts only by sending intents. Per turn:
 * think → maybe use an ability → maybe walk (no shot from here) → sweep the barrel → fire.
 * After each of its own actions it waits for the host's `actionResolved`, lets the animation play, then re-checks.
 */
export class BotDriver {
  private mirror: WorldMirror | null = null;
  private timer: unknown = null;
  private busy = false;
  private turn: TurnPlan = fresh('');
  private disposed = false;
  private readonly rng: Rng;
  private readonly off: Array<() => void> = [];
  private difficulty: BotDifficulty;

  private readonly opts: BotDriverOptions;

  constructor(opts: BotDriverOptions) {
    this.opts = opts;
    this.difficulty = opts.difficulty;
    this.rng = createRng(opts.seed || 1);
    const c = opts.client;
    this.off.push(
      c.on('matchStarted', (m) => {
        if (m.t !== 'matchStarted') return;
        this.mirror = new WorldMirror(m.data);
        this.reset();
        c.send({ t: 'loaded' });
      }),
      c.on('turnStarted', (m) => {
        if (m.t !== 'turnStarted' || !this.mirror) return;
        this.mirror.world.wind = m.data.wind;
        this.mirror.world.burnZones = m.data.burnZones.map((z) => ({ ...z }));
      }),
      c.on('matchState', (m) => {
        if (m.t !== 'matchState') return;
        this.mirror?.applyView(m.data);
        this.consider();
      }),
      c.on('actionResolved', (m) => {
        if (m.t !== 'actionResolved' || !this.mirror) return;
        this.mirror.applyAction(m.data);
        if (m.data.unitId === this.me()?.id && this.busy) {
          this.busy = false;
          this.later(ticksToMs(m.data.result.durationTicks) + BOT_RULES.settleMs);
        }
      }),
      c.on('rejected', () => {
        if (!this.busy) return;
        this.busy = false;
        this.turn.rejections++;
        this.later(BOT_RULES.settleMs);
      }),
      c.on('matchEnded', () => this.reset()),
      c.on('closed', () => this.dispose()),
    );
  }

  setDifficulty(d: BotDifficulty): void { this.difficulty = d; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const f of this.off) f();
  }

  // ------------------------------------------------------------------
  private me(): UnitState | undefined {
    const id = this.opts.client.playerId;
    return id ? this.mirror?.world.units.find((u) => u.playerId === id) : undefined;
  }

  private reset(): void { this.clear(); this.busy = false; this.turn = fresh(''); }
  private clear(): void { if (this.timer !== null) this.opts.clock.clearTimeout(this.timer); this.timer = null; }

  /** Current turn key if it is this bot's turn and the host is accepting actions, else null. */
  private myTurnKey(): string | null {
    const v = this.opts.client.match, me = this.me();
    if (this.disposed || !v || !this.mirror || v.paused || v.phase !== 'acting' || !me?.alive || v.activeUnitId !== me.id) return null;
    return `${v.matchId}:${v.turnNumber}`;
  }

  private later(ms: number): void {
    this.clear();
    this.timer = this.opts.clock.setTimeout(() => { this.timer = null; this.consider(); }, ms);
  }

  private consider(): void {
    const key = this.myTurnKey();
    if (!key) return;
    if (key !== this.turn.key) { this.clear(); this.busy = false; this.turn = fresh(key); }
    if (this.busy || this.timer !== null) return;
    const [lo, hi] = BOT_TUNING[this.difficulty].thinkMs;
    const delay = this.turn.acted ? 0 : lo + this.rng.next() * (hi - lo);
    this.timer = this.opts.clock.setTimeout(() => { this.timer = null; this.act(key); }, delay);
  }

  private send(intent: Parameters<PeerClient['send']>[0]): void {
    this.turn.acted = true;
    this.busy = true;
    this.opts.client.send(intent);
  }

  private act(key: string): void {
    if (this.myTurnKey() !== key || this.busy) return;
    const world = this.mirror!.world, me = this.me()!;
    const t = BOT_TUNING[this.difficulty];
    if (this.turn.rejections >= BOT_RULES.maxRejections) { this.turn.acted = true; this.opts.client.send({ t: 'skipTurn' }); return; }
    const hurry = this.opts.client.turnMsLeft() < BOT_RULES.hurryMs;
    if (!this.turn.abilityDone && !hurry) {
      this.turn.abilityDone = true;
      const slot = chooseAbility(world, me.id, t, this.rng);
      if (slot) { this.turn.modifiers = abilityModifiers(world, me.id, slot); this.send({ t: 'useAbility', slot }); return; }
    }
    const plan = planShot(world, me.id, t, this.rng, this.turn.modifiers);
    if (!plan) { this.turn.acted = true; this.opts.client.send({ t: 'skipTurn' }); return; }
    if (this.turn.movesLeft === null) this.turn.movesLeft = plan.expected >= BOT_RULES.viableShot ? 0 : t.maxMoves;
    if (this.turn.movesLeft > 0 && !hurry && me.fuel > 0 && me.status.frozenTurns === 0) {
      this.turn.movesLeft--;
      this.send({ t: 'move', dir: approachDir(world, me.id), ticks: 10 });
      return;
    }
    if (hurry) this.fire(key, plan.aim); else this.sweep(key, plan.aim, 1);
  }

  /** Swing the barrel toward the solution so other players see the bot aim (cosmetic `aim` relays). */
  private sweep(key: string, aim: AimInput, step: number): void {
    if (this.myTurnKey() !== key) return;
    const n = BOT_RULES.aimSweepSteps;
    if (step > n) { this.fire(key, aim); return; }
    const me = this.me()!;
    const from = me.facing > 0 ? 45 : 135;
    const k = step / n;
    this.opts.client.send({ t: 'aim', angle: from + (aim.angle - from) * k, power: aim.power * k, weaponId: aim.weaponId });
    this.turn.acted = true;
    this.timer = this.opts.clock.setTimeout(() => { this.timer = null; this.sweep(key, aim, step + 1); }, BOT_RULES.aimSweepMs);
  }

  private fire(key: string, aim: AimInput): void {
    if (this.myTurnKey() !== key) return;
    this.turn.modifiers = [];
    this.send({ t: 'fire', aim });
  }
}
