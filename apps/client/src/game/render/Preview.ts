// Trajectory preview (own turn only): predictTrajectory from @lobbers/shared — the same force and
// collision code the server runs — first PHYSICS.previewTicks ticks, dotted line + yellow reticle.
import Phaser from 'phaser';
import { PHYSICS, predictTrajectory, type AimInput, type ShotModifier, type World } from '@lobbers/shared';
import type { LayoutSpec } from '../layouts';

export class Preview {
  private readonly g: Phaser.GameObjects.Graphics;
  private key = '';
  private pts: Array<[number, number]> = [];
  private phase = 0;

  constructor(scene: Phaser.Scene, depth: number, private readonly layout: LayoutSpec) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  hide(): void { if (this.key) { this.key = ''; this.g.clear(); } }

  /** `terrainVersion` bumps on every carve (cheap cache key instead of hashing the mask). */
  update(world: World, unitId: string, aim: AimInput, mods: ShotModifier[], dtMs: number, terrainVersion: number): void {
    const u = world.units.find((x) => x.id === unitId);
    if (!u) return this.hide();
    const key = `${unitId}|${aim.angle}|${aim.power}|${aim.weaponId}|${world.wind}|${u.x}|${u.y}|${mods.length}|${terrainVersion}`;
    if (key !== this.key) {
      this.key = key;
      const r = predictTrajectory(world, unitId, aim, mods, PHYSICS.previewTicks);
      this.pts = r.points.filter((_, i) => i % 2 === 0);
    }
    this.phase = (this.phase + dtMs / 600) % 1;
    this.draw();
  }

  /** stroke-dasharray "1 gap" with round caps = dots every `gap` px, animated (dashoffset 0 → −gap in .6 s). */
  private draw(): void {
    const g = this.g.clear(), p = this.layout.preview, pts = this.pts;
    if (pts.length < 2) return;
    const dots: Array<[number, number]> = [];
    let carry = this.phase * p.gap;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      let d = carry;
      while (d <= len) { const t = len ? d / len : 0; dots.push([ax + (bx - ax) * t, ay + (by - ay) * t]); d += p.gap; }
      carry = d - len;
    }
    g.fillStyle(0x0B0F1A, 0.7);
    for (const [x, y] of dots) g.fillCircle(x, y, p.outline / 2);
    g.fillStyle(0xF5F1E8, 1);
    for (const [x, y] of dots) g.fillCircle(x, y, p.core / 2);
    const [ex, ey] = pts[pts.length - 1];
    g.lineStyle(3, 0xFFD166).strokeCircle(ex, ey, 9);
    g.fillStyle(0xFFD166).fillCircle(ex, ey, 2.5);
  }

  destroy(): void { this.g.destroy(); }
}
