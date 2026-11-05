// Replays ShotResult.tracks: one point per tick at 60 Hz. Shell rotated along velocity,
// trail = weapon colour 6 px @55 % + white 2 px @70 % core (Battle.dc.html flight layer).
import Phaser from 'phaser';
import type { ProjectileTrack } from '@lobbers/shared';

interface Flight { track: ProjectileTrack; shell: Phaser.GameObjects.Image; trail: Phaser.GameObjects.Graphics; color: number; done: boolean }

export class ShotView {
  private flights: Flight[] = [];

  private onLand: ((track: ProjectileTrack, at: [number, number]) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly k: number) {}

  start(tracks: ProjectileTrack[], onLand?: (track: ProjectileTrack, at: [number, number]) => void): void {
    this.clear();
    this.onLand = onLand ?? null;
    for (const track of tracks) {
      const isBomb = track.weaponId === 'airstrike' && track.spawnTick > 0;
      const shell = this.scene.add.image(track.points[0][0], track.points[0][1], isBomb ? 'bomb' : `shell-${track.weaponId}`).setScale(1 / this.k).setDepth(this.depth + 1).setVisible(false);
      const trail = this.scene.add.graphics().setDepth(this.depth);
      this.flights.push({ track, shell, trail, color: Phaser.Display.Color.HexStringToColor(track.color).color, done: false });
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
          this.scene.tweens.add({ targets: f.trail, alpha: 0, duration: 700 });
          this.onLand?.(f.track, pts[pts.length - 1]);
        }
        continue;
      }
      const a = pts[i], b = pts[i + 1], fr = t - i;
      const x = a[0] + (b[0] - a[0]) * fr, y = a[1] + (b[1] - a[1]) * fr;
      const isBomb = f.track.weaponId === 'airstrike' && f.track.spawnTick > 0;
      f.shell.setVisible(true).setPosition(x, y).setRotation(isBomb ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]));
      this.drawTrail(f, i, x, y);
      if (!lead) lead = { x, y };
    }
    return lead;
  }

  private drawTrail(f: Flight, i: number, x: number, y: number): void {
    const pts = f.track.points, g = f.trail.clear();
    const from = Math.max(0, i - 400);
    const path = (w: number, color: number, alpha: number): void => {
      g.lineStyle(w, color, alpha).beginPath().moveTo(pts[from][0], pts[from][1]);
      for (let j = from + 1; j <= i; j++) g.lineTo(pts[j][0], pts[j][1]);
      g.lineTo(x, y).strokePath();
    };
    path(6, f.color, 0.55);
    path(2, 0xFFFFFF, 0.7);
  }

  clear(): void {
    for (const f of this.flights) { f.shell.destroy(); const tr = f.trail; this.scene.tweens.add({ targets: tr, alpha: 0, duration: 500, onComplete: () => tr.destroy() }); }
    this.flights = [];
  }
}
