// Explosive barrels and repair crates (Battle.dc.html PROPS block) — follow `prop` events.
import Phaser from 'phaser';
import type { PropState } from '@lobbers/shared';

interface PropView { img: Phaser.GameObjects.Image; state: PropState; bob?: Phaser.Tweens.Tween }

export class PropViews {
  private views = new Map<string, PropView>();

  constructor(private readonly scene: Phaser.Scene, props: PropState[], private readonly k: number, private readonly depth: number, private readonly reducedMotion: boolean) {
    for (const p of props) if (p.alive) this.add(p);
  }

  private add(p: PropState): void {
    const img = this.scene.add.image(p.x, p.y + 2, p.kind === 'barrel' ? 'prop-barrel' : 'prop-crate').setOrigin(0.5, 40 / 40).setScale(1 / this.k).setDepth(this.depth);
    const v: PropView = { img, state: { ...p } };
    if (p.kind === 'crate' && !this.reducedMotion) v.bob = this.scene.tweens.add({ targets: img, y: p.y - 2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.views.set(p.id, v);
  }

  get(id: string): PropState | undefined { return this.views.get(id)?.state; }

  moved(id: string, y: number): void {
    const v = this.views.get(id);
    if (!v) return;
    v.state.y = y;
    v.bob?.stop();
    this.scene.tweens.add({ targets: v.img, y: y + 2, duration: 500, ease: 'Cubic.easeIn' });
  }

  /** destroyed / exploded / collected: pop away with splinters. */
  remove(id: string, how: 'destroyed' | 'exploded' | 'collected'): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    v.bob?.stop();
    if (how === 'collected') {
      this.scene.tweens.add({ targets: v.img, scale: (1.4 / this.k), alpha: 0, y: v.img.y - 30, duration: 350, ease: 'Back.easeIn', onComplete: () => v.img.destroy() });
      return;
    }
    if (v.state.kind === 'crate') this.splinters(v.img.x, v.img.y - 18);
    v.img.destroy();
  }

  private splinters(x: number, y: number): void {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = this.scene.add.rectangle(x, y, 10, 4, 0xC98B4E).setStrokeStyle(2, 0x0B0F1A).setDepth(this.depth + 1).setAngle((a * 180) / Math.PI);
      this.scene.tweens.add({ targets: r, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 46 + 20, angle: r.angle + 200, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
  }

  destroy(): void { for (const v of this.views.values()) { v.bob?.stop(); v.img.destroy(); } this.views.clear(); }
}
