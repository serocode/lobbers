// Replays ShotResult.tracks: one point per tick at 60 Hz. Shell rotated along velocity.
// Default trail (Smoke Ring) = weapon colour 6 px @55 % + white 2 px @70 % core (Battle.dc.html flight
// layer). Equipped trails (Inventory "Projectile Trails") restyle it; weapon skins recolour the shell.
import Phaser from 'phaser';
import { WEAPONS, type ProjectileTrack, type TrailStyle, type UnitCosmetics } from '@lobbers/shared';
import { shellKey } from './svgSources';

interface Flight { track: ProjectileTrack; shell: Phaser.GameObjects.Image; trail: Phaser.GameObjects.Graphics; color: number; done: boolean }
export type ShotLook = Pick<UnitCosmetics, 'trail' | 'shellColors'>;

const RAINBOW = [0xF45B55, 0xFF8A3D, 0xFFD166, 0x5ACB91, 0x4C9AFF, 0xB07CF2];
const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;

export class ShotView {
  private flights: Flight[] = [];
  private style: TrailStyle = 'smoke';
  private trailColor = 0xA9B3CC;
  private onLand: ((track: ProjectileTrack, at: [number, number]) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly k: number) {}

  start(tracks: ProjectileTrack[], onLand?: (track: ProjectileTrack, at: [number, number]) => void, look?: ShotLook): void {
    this.clear();
    this.onLand = onLand ?? null;
    this.style = look?.trail.style ?? 'smoke';
    this.trailColor = hex(look?.trail.color ?? '#A9B3CC');
    for (const track of tracks) {
      const isBomb = track.weaponId === 'airstrike' && track.spawnTick > 0;
      const skin = look?.shellColors[WEAPONS[track.weaponId].category];
      const key = shellKey(track.weaponId, skin);
      const tex = isBomb ? 'bomb' : this.scene.textures.exists(key) ? key : `shell-${track.weaponId}`;
      const shell = this.scene.add.image(track.points[0][0], track.points[0][1], tex).setScale(1 / this.k).setDepth(this.depth + 1).setVisible(false);
      const trail = this.scene.add.graphics().setDepth(this.depth);
      this.flights.push({ track, shell, trail, color: hex(skin ?? track.color), done: false });
    }
  }

  /** Position every shell at `tick`. Returns the lead shell (camera target) or null when all landed. */
  update(tick: number): { x: number; y: number } | null {
    let lead: { x: number; y: number } | null = null;
    for (const f of this.flights) {
      const pts = f.track.points;
      const t = tick - f.track.spawnTick;
      if (t < 0) continue;
      const i = Math.floor(t);
      if (i >= pts.length - 1) {
        if (!f.done) {
          f.done = true;
          f.shell.setVisible(false);
          this.scene.tweens.add({ targets: f.trail, alpha: 0, duration: this.style === 'stars' ? 1600 : 700 });
          this.onLand?.(f.track, pts[pts.length - 1]);
        }
        continue;
      }
      const a = pts[i], b = pts[i + 1], fr = t - i;
      const x = a[0] + (b[0] - a[0]) * fr, y = a[1] + (b[1] - a[1]) * fr;
      const isBomb = f.track.weaponId === 'airstrike' && f.track.spawnTick > 0;
      f.shell.setVisible(true).setPosition(x, y).setRotation(isBomb ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]));
      this.drawTrail(f, i, x, y, tick);
      if (!lead) lead = { x, y };
    }
    return lead;
  }

  private drawTrail(f: Flight, i: number, x: number, y: number, tick: number): void {
    const pts = f.track.points, g = f.trail.clear();
    const from = Math.max(0, i - 400);
    const path = (w: number, color: number, alpha: number, a = from): void => {
      g.lineStyle(w, color, alpha).beginPath().moveTo(pts[a][0], pts[a][1]);
      for (let j = a + 1; j <= i; j++) g.lineTo(pts[j][0], pts[j][1]);
      g.lineTo(x, y).strokePath();
    };
    const c = this.trailColor;
    switch (this.style) {
      case 'smoke':
        path(6, f.color, 0.55);
        path(2, 0xFFFFFF, 0.7);
        return;
      case 'sparks': // fizzing embers: thin streak + flickering spark squares along the recent path
        path(3, c, 0.6, Math.max(from, i - 90));
        for (let j = Math.max(from, i - 60); j <= i; j += 4) {
          const jit = ((j * 7919 + Math.floor(tick / 3)) % 9) - 4;
          g.fillStyle(j % 8 ? c : 0xFFD166, 1 - (i - j) / 64).fillRect(pts[j][0] + jit - 2, pts[j][1] - jit - 2, 4, 4);
        }
        return;
      case 'bubbles':
        for (let j = Math.max(from, i - 140); j <= i; j += 10) {
          const r = 3 + ((j * 31) % 5), wob = Math.sin((j + tick) * 0.2) * 3;
          g.lineStyle(2, 0x0B0F1A, 0.6).fillStyle(c, 0.35).fillCircle(pts[j][0], pts[j][1] + wob, r).strokeCircle(pts[j][0], pts[j][1] + wob, r);
        }
        return;
      case 'dash': // chunky retro dashes
        for (let j = from; j < i; j += 12) {
          const e = Math.min(i, j + 6);
          g.lineStyle(6, c, 0.85).lineBetween(pts[j][0], pts[j][1], pts[e][0], pts[e][1]);
        }
        return;
      case 'rainbow':
        for (let j = from; j < i; j += 3) {
          const e = Math.min(i, j + 3);
          g.lineStyle(7, RAINBOW[Math.floor((j + tick) / 6) % RAINBOW.length], 0.75).lineBetween(pts[j][0], pts[j][1], pts[e][0], pts[e][1]);
        }
        path(2, 0xFFFFFF, 0.7);
        return;
      case 'stars':
        path(2, c, 0.4);
        for (let j = from; j <= i; j += 16) this.star(g, pts[j][0], pts[j][1], 4 + (j % 3), c, (j + tick) % 20 < 10 ? 1 : 0.55);
    }
  }

  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: number, alpha: number): void {
    const p: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; p.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr)); }
    g.fillStyle(c, alpha).fillPoints(p, true).lineStyle(1.5, 0x0B0F1A, alpha).strokePoints(p, true);
  }

  clear(): void {
    for (const f of this.flights) { f.shell.destroy(); const tr = f.trail; this.scene.tweens.add({ targets: tr, alpha: 0, duration: 500, onComplete: () => tr.destroy() }); }
    this.flights = [];
  }
}
