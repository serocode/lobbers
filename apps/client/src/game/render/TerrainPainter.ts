// Destructible terrain art. Painted from the same paths as Scene.dc.html into tiled CanvasTextures;
// `carve` erases the exact circle the shared Terrain mask removed (collision = the mask, art = this).
import Phaser from 'phaser';
import { MAPS, Terrain, type MapId } from '@lobbers/shared';
import { sceneModel, type SceneModel } from '../../components/art/sceneModel';

const TILE = 512;
const RIM = 9;

interface Tile { x: number; y: number; w: number; h: number; tex: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D; dirty: boolean }

export class TerrainPainter {
  private readonly tiles: Tile[] = [];
  private readonly m: SceneModel;
  private readonly terrainPath: Path2D;
  private readonly topPath: Path2D;
  private readonly botPath: Path2D | null;
  private readonly images: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene, mapId: MapId, private readonly k: number, current: Terrain, depth: number) {
    this.m = sceneModel(mapId);
    this.terrainPath = new Path2D(this.m.terrainD);
    this.topPath = new Path2D(this.m.topD);
    this.botPath = this.m.isFloat ? new Path2D(this.m.botD) : null;
    const { W, H } = this.m;
    for (let y = 0; y < H; y += TILE) {
      for (let x = 0; x < W; x += TILE) {
        const w = Math.min(TILE, W - x), h = Math.min(TILE, H - y);
        const key = `terrain-${mapId}-${x}-${y}-${Math.random().toString(36).slice(2, 7)}`;
        const tex = scene.textures.createCanvas(key, Math.ceil(w * k), Math.ceil(h * k));
        if (!tex) throw new Error('canvas texture failed');
        const tile: Tile = { x, y, w, h, tex, ctx: tex.getContext(), dirty: true };
        this.paint(tile);
        this.tiles.push(tile);
        this.images.push(scene.add.image(x, y, key).setOrigin(0, 0).setScale(1 / k).setDepth(depth));
      }
    }
    this.eraseExistingHoles(mapId, current);
    this.flush();
  }

  private begin(t: Tile): CanvasRenderingContext2D {
    const c = t.ctx;
    c.setTransform(this.k, 0, 0, this.k, -t.x * this.k, -t.y * this.k);
    c.lineJoin = 'round';
    return c;
  }

  private strokeGrass(c: CanvasRenderingContext2D): void {
    const { P } = this.m;
    c.lineWidth = 20; c.strokeStyle = '#151B2B'; c.stroke(this.topPath);
    c.lineWidth = 14; c.strokeStyle = P.grass; c.stroke(this.topPath);
    c.save(); c.translate(0, -3); c.globalAlpha = 0.9; c.lineWidth = 4; c.strokeStyle = P.grassHi; c.stroke(this.topPath); c.restore();
  }

  /** Same layer order as Scene.dc.html's terrain group. */
  private paint(t: Tile): void {
    const c = this.begin(t);
    const { P } = this.m;
    c.clearRect(t.x - 1, t.y - 1, t.w + 2, t.h + 2);
    c.fillStyle = P.dirt;
    c.fill(this.terrainPath);
    c.save();
    c.clip(this.terrainPath);
    c.strokeStyle = P.dirtDark;
    c.save(); c.translate(0, 70); c.globalAlpha = 0.45; c.lineWidth = 30; c.stroke(this.topPath); c.restore();
    c.save(); c.translate(0, 150); c.globalAlpha = 0.6; c.lineWidth = 44; c.stroke(this.topPath); c.restore();
    if (this.botPath) { c.save(); c.globalAlpha = 0.35; c.lineWidth = 40; c.strokeStyle = '#151B2B'; c.stroke(this.botPath); c.restore(); }
    c.lineWidth = 2.5; c.strokeStyle = '#151B2B'; c.fillStyle = P.rock;
    for (const p of this.m.pebbles) {
      if (p.x + p.r < t.x || p.x - p.r > t.x + t.w || p.y + p.ry < t.y || p.y - p.ry > t.y + t.h) continue;
      c.beginPath(); c.ellipse(p.x, p.y, p.r, p.ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.restore();
    if (this.botPath) { c.lineWidth = 5; c.strokeStyle = '#151B2B'; c.stroke(this.botPath); }
    c.lineCap = 'round'; c.lineWidth = 4; c.strokeStyle = P.trunk;
    for (const d of this.m.roots) c.stroke(new Path2D(d));
    c.lineCap = 'butt';
    this.strokeGrass(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** On (re)mount mid-match the mask already has holes: erase every pixel that was solid but is gone. */
  private eraseExistingHoles(mapId: MapId, current: Terrain): void {
    const pristine = Terrain.fromMap(MAPS[mapId]);
    if (pristine.hash() === current.hash()) return;
    for (const t of this.tiles) {
      const img = new ImageData(t.w, t.h);
      let any = false;
      for (let y = 0; y < t.h; y++) {
        for (let x = 0; x < t.w; x++) {
          const i = (t.y + y) * current.width + (t.x + x);
          if (pristine.mask[i] === 1 && current.mask[i] === 0) { img.data[(y * t.w + x) * 4 + 3] = 255; any = true; }
        }
      }
      if (!any) continue;
      const tmp = document.createElement('canvas');
      tmp.width = t.w; tmp.height = t.h;
      tmp.getContext('2d')?.putImageData(img, 0, 0);
      const c = t.ctx;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out';
      c.drawImage(tmp, 0, 0, t.w * this.k, t.h * this.k);
      c.restore();
      t.dirty = true;
    }
  }

  /** Crater: dark rim inside the remaining ground, grass edge re-stroked over it, then the hole. */
  carve(x: number, y: number, r: number): void {
    const x0 = Math.round(x), y0 = Math.round(y), rr = Math.round(r);
    if (rr <= 0) return;
    const reach = rr + RIM + 14;
    for (const t of this.tiles) {
      if (x0 + reach < t.x || x0 - reach > t.x + t.w || y0 + reach < t.y || y0 - reach > t.y + t.h) continue;
      const c = this.begin(t);
      c.save();
      c.globalCompositeOperation = 'source-atop';
      c.save(); c.clip(this.terrainPath); c.beginPath(); c.arc(x0, y0, rr + RIM, 0, Math.PI * 2); c.fillStyle = 'rgba(21,27,43,.55)'; c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(x0, y0, reach, 0, Math.PI * 2); c.clip(); this.strokeGrass(c); c.restore();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(x0, y0, rr, 0, Math.PI * 2); c.fill();
      c.restore();
      c.setTransform(1, 0, 0, 1, 0, 0);
      t.dirty = true;
    }
  }

  /** Upload changed tiles (call once per frame). */
  flush(): void {
    for (const t of this.tiles) if (t.dirty) { t.tex.refresh(); t.dirty = false; }
  }

  destroy(): void {
    for (const i of this.images) i.destroy();
    for (const t of this.tiles) t.tex.destroy();
  }
}
