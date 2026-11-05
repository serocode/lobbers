// Explosions, lightning bolts, burn-zone flames and floating numbers — the layers and timings of
// Battle.dc.html (.fl flash, .ring, .fb fireball + core, .spk sparks, .smoke, .zap, .flame, .float).
import Phaser from 'phaser';
import type { BurnZone, Terrain } from '@lobbers/shared';

const col = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

export interface FloaterSpec { x: number; y: number; text: string; size: number; color: string; sub?: string }

export class Fx {
  private flames = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly res: number, private readonly k: number, private readonly reducedMotion: boolean) {}

  explosion(x: number, y: number, radius: number, color: string): void {
    const s = this.scene, r = Math.max(24, radius), c = col(color), d = this.depth;
    const flash = s.add.circle(x, y, r * 1.6, 0xFFFFFF).setDepth(d).setScale(0.3);
    s.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    const ring = s.add.circle(x, y, r).setStrokeStyle(6, c).setDepth(d).setScale(0.2);
    s.tweens.add({ targets: ring, scale: 1.9, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const ball = s.add.circle(x, y, r, c).setStrokeStyle(4, 0x0B0F1A).setDepth(d + 1).setScale(0.1);
    s.tweens.add({ targets: ball, scale: 1.25, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ball.destroy() });
    s.tweens.add({ targets: ball, alpha: 0, delay: 280, duration: 420 });
    const core = s.add.circle(x, y, r * 0.55, 0xFFF6D6).setDepth(d + 1).setScale(0.1);
    s.tweens.add({ targets: core, scale: 1.25, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
    for (let i = 0; i < 12; i++) {
      const a = Phaser.Math.DegToRad(i * 30 + 8), dist = 90 * (r / 40);
      const sp = s.add.rectangle(x, y, 10, 10, i % 3 ? c : 0xFFF6D6).setStrokeStyle(2, 0x0B0F1A).setDepth(d + 2);
      s.tweens.add({ targets: sp, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, scale: 0.2, alpha: 0, angle: 90, duration: 550 + (i % 4) * 120, ease: 'Expo.easeOut', onComplete: () => sp.destroy() });
    }
    for (const p of [{ dx: -4, dy: -10, s: 40, dl: 150 }, { dx: 21, dy: -23, s: 34, dl: 250 }, { dx: 17, dy: 3, s: 46, dl: 50 }]) {
      const m = s.add.circle(x + p.dx, y + p.dy, p.s / 2, 0x3B4257, 0.85).setDepth(d).setScale(0.4).setAlpha(0);
      s.tweens.add({ targets: m, delay: p.dl, y: m.y - 70, scale: 1.4, alpha: { from: 0.85, to: 0 }, duration: 1000, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
    }
  }

  /** Jagged sky bolt + chain segments, flickering (`.zap` steps(2)). */
  bolt(x: number, fromY: number, toY: number, chain: Array<{ x: number; y: number }>): void {
    const top = Math.min(fromY, toY - 900);
    const pts: Array<[number, number]> = [[x, top], [x + 14, toY - 500], [x - 10, toY - 200], [x, toY]];
    let prev = { x, y: toY };
    for (const c of chain) { pts.push([(prev.x + c.x) / 2, Math.min(prev.y, c.y) - 90], [c.x, c.y]); prev = c; }
    const g = this.scene.add.graphics().setDepth(this.depth + 3);
    const line = (w: number, color: number): void => {
      g.lineStyle(w, color).beginPath().moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) g.lineTo(px, py);
      g.strokePath();
    };
    line(7, 0xFFE45E);
    line(2.5, 0xFFFFFF);
    const ev = this.scene.time.addEvent({ delay: 75, repeat: 13, callback: () => g.setAlpha(g.alpha > 0.5 ? 0.3 : 1) });
    this.scene.time.delayedCall(1100, () => { ev.remove(); g.destroy(); });
  }

  /** Keep flame sprites in sync with the authoritative burn zones. */
  syncBurnZones(zones: BurnZone[], terrain: Terrain): void {
    const ids = new Set(zones.map((z) => z.id));
    for (const [id, img] of this.flames) if (!ids.has(id)) { this.flames.delete(id); this.scene.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.destroy() }); }
    for (const z of zones) {
      if (this.flames.has(z.id)) continue;
      const gy = terrain.surfaceBelow(z.x, z.y - 40) ?? z.y;
      const img = this.scene.add.image(z.x, gy + 8, 'flame').setOrigin(0.5, 1).setScale(1 / this.k).setDepth(this.depth - 1);
      if (!this.reducedMotion) this.scene.tweens.add({ targets: img, scaleY: { from: 0.85 / this.k, to: 1.15 / this.k }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.flames.set(z.id, img);
    }
  }

  /** Damage / heal / MISS / KABOOM numbers (`.float` + `.dnum`, 1.4 s rise). */
  floater(f: FloaterSpec): void {
    const s = this.scene;
    const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: '"Lilita One"', fontSize: `${size}px`, color, stroke: '#0B0F1A', strokeThickness: 5 + size / 12, resolution: this.res,
      shadow: { offsetX: 0, offsetY: 4, color: '#0B0F1A', fill: true, stroke: true, blur: 0 },
    });
    const parts: Phaser.GameObjects.Text[] = [s.add.text(0, 0, f.text, style(f.size, f.color)).setOrigin(0.5, 0)];
    if (f.sub) parts.push(s.add.text(0, f.size * 0.95, f.sub, style(16, '#FFD166')).setOrigin(0.5, 0));
    const c = s.add.container(f.x, f.y, parts).setDepth(this.depth + 5).setAlpha(0).setScale(0.4);
    const st = { t: 0 };
    s.tweens.add({
      targets: st, t: 1, duration: 1400, onComplete: () => c.destroy(),
      onUpdate: () => {
        const t = st.t;
        // keyframes: 0% (+10, .4, 0) · 15% (−10, 1.25, 1) · 30% (−16, 1) · 80% opacity 1 · 100% (−70, .9, 0)
        const seg = t < 0.15 ? [0, 0.15, 10, -10, 0.4, 1.25] : t < 0.3 ? [0.15, 0.3, -10, -16, 1.25, 1] : [0.3, 1, -16, -70, 1, 0.9];
        const u = Phaser.Math.Easing.Back.Out((t - seg[0]) / (seg[1] - seg[0]));
        c.setY(f.y + Phaser.Math.Linear(seg[2], seg[3], u));
        c.setScale(Phaser.Math.Linear(seg[4], seg[5], Math.min(1, u)));
        c.setAlpha(t < 0.15 ? t / 0.15 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1);
      },
    });
  }

  destroy(): void { for (const f of this.flames.values()) f.destroy(); this.flames.clear(); }
}
