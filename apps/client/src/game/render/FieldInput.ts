// Pointer input on the battlefield canvas:
//  · drag (beyond CAMERA.dragThresholdPx) or wheel → free look (never touches aim)
//  · mouse press-and-hold (no drag, 200 ms) on your turn → aim mode: the barrel follows the cursor
//    and power charges while held (0 → 100 → 0 …); release keeps both. Fire with Space / FIRE.
import Phaser from 'phaser';
import { CAMERA, MACHINES, PHYSICS, type UnitState } from '@lobbers/shared';
import type { CameraDirector } from './CameraDirector';

const HOLD_MS = 200;
const CHARGE_PER_SEC = 60;

export interface FieldInputHooks {
  /** The active unit while you may aim it (null otherwise). */
  aimUnit(): UnitState | null;
  setAim(angle: number, power: number): void;
  /** Canvas px per layout px (the canvas renders at device density). */
  density: number;
}

export class FieldInput {
  private down: { x: number; y: number; t: number; mouse: boolean } | null = null;
  private dragging = false;
  private aiming = false;
  private charge = { p: 0, dir: 1 };

  constructor(private readonly scene: Phaser.Scene, private readonly dir: CameraDirector, private readonly hooks: FieldInputHooks) {
    const inp = scene.input;
    inp.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y, t: performance.now(), mouse: !p.wasTouch };
      this.dragging = false;
      this.aiming = false;
    });
    inp.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    inp.on('pointerup', () => this.release());
    inp.on('pointerupoutside', () => this.release());
    inp.on('gameout', () => this.release());
    inp.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (!this.dir.flying) this.dir.drag(-(dx || dy), 0);
    });
  }

  private move(p: Phaser.Input.Pointer): void {
    const d = this.down;
    if (!d || !p.isDown || this.aiming) return;
    const R = this.hooks.density;
    if (!this.dragging && (Math.abs(p.x - d.x) + Math.abs(p.y - d.y)) / R < CAMERA.dragThresholdPx) return;
    this.dragging = true;
    this.dir.drag((p.x - p.prevPosition.x) / R, (p.y - p.prevPosition.y) / R);
  }

  /** Angle from the unit's barrel pivot to the cursor, clamped to the upper half (0 right … 180 left). */
  private cursorAngle(u: UnitState): number {
    const p = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    const py = u.y - PHYSICS.muzzleHeight - MACHINES[u.machine].hover;
    const a = Phaser.Math.RadToDeg(Math.atan2(py - wp.y, wp.x - u.x));
    return a < -90 ? 180 : a < 0 ? 0 : a;
  }

  /** Every frame: enter aim mode after a still hold; while held, follow the cursor and charge power. */
  update(dtMs: number): void {
    const d = this.down;
    if (!d) return;
    const u = this.hooks.aimUnit();
    if (!u) { this.aiming = false; return; }
    if (!this.aiming) {
      if (this.dragging || !d.mouse || performance.now() - d.t < HOLD_MS) return;
      this.aiming = true;
      this.charge = { p: 0, dir: 1 };
    }
    const c = this.charge;
    c.p += c.dir * CHARGE_PER_SEC * (dtMs / 1000);
    if (c.p >= 100) { c.p = 100; c.dir = -1; } else if (c.p <= 0) { c.p = 0; c.dir = 1; }
    this.hooks.setAim(Math.round(this.cursorAngle(u)), Math.round(c.p));
  }

  get charging(): boolean { return this.aiming; }

  private release(): void { this.down = null; this.dragging = false; this.aiming = false; }

  destroy(): void { this.scene.input.removeAllListeners(); }
}
