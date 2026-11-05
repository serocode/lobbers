// The animated part of the hazard strip from Scene.dc.html (the rasterised backdrop keeps it static):
// lava glow pulses .15 → .5 over 2.4 s; the icy-water wave line drifts −60 px over 5 s. Drawn in
// backdrop space so it moves with the parallax layer it belongs to. Void maps have no strip.
import Phaser from 'phaser';
import { MAPS, type MapId } from '@lobbers/shared';
import { sceneModel } from '../../components/art/sceneModel';

export class HazardView {
  private readonly root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, mapId: MapId, depth: number, reducedMotion: boolean) {
    const map = MAPS[mapId];
    const m = sceneModel(mapId);
    this.root = scene.add.container(0, 0).setDepth(depth);
    if (!m.hazard) return;
    const W = map.width, y = m.hzY;
    if (m.hazard === 'lava') {
      const glow = scene.add.rectangle(0, y, W, 80, 0xFFD166, 0.15).setOrigin(0, 0);
      const wave = scene.add.graphics();
      this.wave(wave, W, y, 0xFFE29A, 5, 0.8);
      this.root.add([glow, wave]);
      if (!reducedMotion) scene.tweens.add({ targets: glow, fillAlpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const wave = scene.add.graphics();
      this.wave(wave, W + 60, y, 0xD7F3FF, 4, 0.7);
      this.root.add(wave);
      if (!reducedMotion) scene.tweens.add({ targets: wave, x: -60, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Same scallop as sceneModel's hzWave: quadratic humps every 30 px, ±6 px. */
  private wave(g: Phaser.GameObjects.Graphics, W: number, y: number, color: number, width: number, alpha: number): void {
    g.lineStyle(width, color, alpha).beginPath().moveTo(0, y);
    for (let x = 0; x <= W + 60; x += 30) {
      const cy = y + ((x / 30) % 2 ? 6 : -6);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(x + 15, cy), new Phaser.Math.Vector2(x + 30, y));
      for (const p of curve.getPoints(6).slice(1)) g.lineTo(p.x, p.y);
    }
    g.strokePath();
  }

  setPosition(x: number, y: number): void { this.root.setPosition(x, y); }
}
