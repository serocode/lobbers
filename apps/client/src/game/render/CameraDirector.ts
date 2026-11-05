// Gunbound camera (DESIGN_SPEC §2.4, config/camera.ts): intro overview → focus active machine →
// follow the shell → hold on impact → focus the next player; drag/wheel free look, F focus, Z overview.
import Phaser from 'phaser';
import { CAMERA, cameraFor, fitZoom, type MapDef } from '@lobbers/shared';
import { cameraBus, type CameraMode } from '../../state/cameraBus';

export interface DirectorOptions {
  /** Field size in layout px and the layout's play zoom. */
  view: { w: number; h: number };
  playZoom: number;
  /** Device pixels per layout px (canvas is rendered at this density). */
  density: number;
  map: MapDef;
}

interface Pan { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; t: number; ms: number }

export class CameraDirector {
  mode: CameraMode = 'intro';
  fit = true;
  private x = 0;
  private y = 0;
  private z: number;
  private pan: Pan | null = null;
  private shell: { x: number; y: number } | null = null;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, private readonly o: DirectorOptions) {
    this.cam = scene.cameras.main;
    this.z = this.fitZ();
    const t = this.target(o.map.width / 2, o.map.height / 2, this.z, true);
    this.x = t.x; this.y = t.y;
    this.apply();
  }

  private fitZ(): number { return fitZoom(this.o.view, this.o.map); }
  private zoomNow(): number { return this.fit ? this.fitZ() : this.o.playZoom; }

  /** Top-left world point for centring (x, y) at zoom z; the fit view is centred and letterboxed. */
  private target(x: number, y: number, z: number, fit: boolean): { x: number; y: number } {
    if (fit) return { x: (this.o.map.width - this.o.view.w / z) / 2, y: (this.o.map.height - this.o.view.h / z) / 2 };
    return cameraFor(x, y, z, this.o.view, this.o.map);
  }

  private panTo(x: number, y: number, z: number, ms = CAMERA.panMs): void {
    this.pan = { from: { x: this.x, y: this.y, z: this.z }, to: { x, y, z }, t: 0, ms };
  }

  /** Look at a world point (unit feet → focus point `focusAboveUnit` above). */
  focusOn(x: number, feetY: number, mode: CameraMode = 'focus', animate = true): void {
    if (this.fit) return;
    this.mode = mode;
    this.shell = null;
    const t = this.target(x, feetY - CAMERA.focusAboveUnit, this.o.playZoom, false);
    if (animate) this.panTo(t.x, t.y, this.o.playZoom); else { this.pan = null; this.x = t.x; this.y = t.y; this.z = this.o.playZoom; }
  }

  /** Keep a moving unit (walking, knocked back) centred while in focus mode. */
  track(x: number, feetY: number, dtMs: number): void {
    if (this.fit || this.mode !== 'focus' || this.pan) return;
    const t = this.target(x, feetY - CAMERA.focusAboveUnit, this.o.playZoom, false);
    const k = 1 - Math.pow(1 - 0.15, dtMs / (1000 / 60));
    this.x += (t.x - this.x) * k;
    this.y += (t.y - this.y) * k;
  }

  /** Free look: pan to an arbitrary world point (minimap click, member chip). */
  lookAt(x: number, y: number): void {
    if (this.fit || this.mode === 'follow') return;
    this.mode = 'free';
    const t = this.target(x, y, this.o.playZoom, false);
    this.panTo(t.x, t.y, this.o.playZoom);
  }

  /** Start of the match: the whole map, then the first turn flies in. */
  intro(): void { this.fit = true; this.mode = 'intro'; }

  endIntro(): void { if (this.mode === 'intro') this.fit = false; }

  toggleOverview(focus: { x: number; y: number } | null): void {
    if (this.mode === 'follow') return;
    this.fit = !this.fit;
    this.mode = this.fit ? 'overview' : 'focus';
    const z = this.zoomNow();
    const t = this.fit ? this.target(0, 0, z, true) : this.target(focus?.x ?? this.o.map.width / 2, (focus?.y ?? this.o.map.height / 2) - CAMERA.focusAboveUnit, z, false);
    this.panTo(t.x, t.y, z);
  }

  follow(enabled: boolean): void { if (enabled && !this.fit) { this.mode = 'follow'; this.pan = null; } }
  setShell(p: { x: number; y: number } | null): void { this.shell = p; }
  hold(): void { if (this.mode === 'follow') this.mode = 'hold'; this.shell = null; }

  /** Drag in layout px (already divided by the stage scale). */
  drag(dx: number, dy: number): void {
    if (this.fit || this.mode === 'follow') return;
    this.mode = 'free';
    this.pan = null;
    const t = this.clamp(this.x - dx / this.z, this.y - dy / this.z);
    this.x = t.x; this.y = t.y;
  }

  private clamp(x: number, y: number): { x: number; y: number } {
    const m = this.o.map, v = this.o.view, z = this.z;
    return { x: Phaser.Math.Clamp(x, 0, Math.max(0, m.width - v.w / z)), y: Phaser.Math.Clamp(y, 0, Math.max(0, m.height - v.h / z)) };
  }

  get flying(): boolean { return this.mode === 'follow'; }

  /** World position for the parallax backdrop (mockup: translate(ox − cam × parallaxBack × z)). */
  backdropPos(): { x: number; y: number } {
    const k = CAMERA.parallaxBack;
    const bx = this.x - Math.min(0, this.x) - k * Math.max(0, this.x);
    const by = this.y - Math.min(0, this.y) - k * Math.max(0, this.y);
    return { x: bx, y: by };
  }

  update(dtMs: number): void {
    if (this.pan) {
      const p = this.pan;
      p.t = Math.min(1, p.t + dtMs / p.ms);
      const e = Phaser.Math.Easing.Cubic.InOut(p.t);
      this.x = Phaser.Math.Linear(p.from.x, p.to.x, e);
      this.y = Phaser.Math.Linear(p.from.y, p.to.y, e);
      this.z = Phaser.Math.Linear(p.from.z, p.to.z, e);
      if (p.t >= 1) this.pan = null;
    } else if (this.mode === 'follow' && this.shell) {
      const t = this.target(this.shell.x, this.shell.y, this.o.playZoom, false);
      const k = 1 - Math.pow(1 - 0.12, dtMs / (1000 / 60));
      this.x += (t.x - this.x) * k;
      this.y += (t.y - this.y) * k;
    } else if (this.fit) {
      const t = this.target(0, 0, this.fitZ(), true);
      this.x = t.x; this.y = t.y; this.z = this.fitZ();
    }
    this.apply();
  }

  private apply(): void {
    const c = this.cam, zoom = this.z * this.o.density;
    c.setZoom(zoom);
    // Phaser zooms about the viewport centre: scroll so the view's top-left lands on (x, y).
    c.setScroll(this.x + c.width / (2 * zoom) - c.width / 2, this.y + c.height / (2 * zoom) - c.height / 2);
    cameraBus.publish({ x: this.x, y: this.y, w: this.o.view.w / this.z, h: this.o.view.h / this.z, zoom: this.z, mode: this.mode, fit: this.fit, shell: this.shell });
  }
}
