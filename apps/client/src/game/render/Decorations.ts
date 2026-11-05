// Trees / rocks / columns from Scene.dc.html as sprites standing on the terrain.
// A decoration whose base is no longer on solid ground (cratered away) topples out.
import Phaser from 'phaser';
import type { MapId, Terrain } from '@lobbers/shared';
import { DECOR_BOX } from '../../components/art/sceneArt';
import { sceneModel, type Placed } from '../../components/art/sceneModel';

interface Deco { img: Phaser.GameObjects.Image; x: number; y: number; alive: boolean }

const ORIGIN_Y = -DECOR_BOX.y / DECOR_BOX.h;

export class Decorations {
  private list: Deco[] = [];

  constructor(private readonly scene: Phaser.Scene, mapId: MapId, k: number, depth: number, reducedMotion: boolean) {
    const m = sceneModel(mapId);
    const add = (key: string, p: Placed, sway?: number): void => {
      const img = scene.add.image(p.x, p.y, key).setOrigin(0.5, ORIGIN_Y).setScale(p.scale / k).setDepth(depth);
      if (sway && !reducedMotion) {
        img.setAngle(-2);
        scene.tweens.add({ targets: img, angle: 2, duration: (sway * 1000) / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.list.push({ img, x: p.x, y: p.y, alive: true });
    };
    for (const r of m.rocks) add(`rock-${mapId}`, r);
    for (const t of m.trees) add(`tree-${mapId}-${t.cap}`, t, t.dur);
    for (const c of m.columns) add('column', c);
  }

  /** Re-check ground under every decoration near a crater. */
  afterCarve(t: Terrain, x: number, y: number, r: number): void {
    for (const d of this.list) {
      if (!d.alive || Math.hypot(d.x - x, d.y - y) > r + 60) continue;
      if (t.isSolid(d.x, d.y) || t.isSolid(d.x, d.y + 6) || t.isSolid(d.x - 6, d.y + 2) || t.isSolid(d.x + 6, d.y + 2)) continue;
      d.alive = false;
      this.scene.tweens.killTweensOf(d.img);
      this.scene.tweens.add({ targets: d.img, angle: d.x < x ? -70 : 70, y: d.y + 40, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => d.img.destroy() });
    }
  }

  destroy(): void { for (const d of this.list) d.img.destroy(); this.list = []; }
}
