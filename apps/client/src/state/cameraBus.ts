// Camera link between the Phaser scene (owner) and the React HUD (minimap, edge marker, buttons).
// The scene publishes its view every frame; the HUD sends commands. No React or Phaser imports here.

export type CameraMode = 'intro' | 'focus' | 'follow' | 'hold' | 'free' | 'overview';

export interface CameraView {
  /** World-space rectangle currently visible. */
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
  mode: CameraMode;
  /** Overview (fit zoom) toggled on. */
  fit: boolean;
  /** Lead projectile while a shot flies (minimap shell dot). */
  shell: { x: number; y: number } | null;
}

export type CameraCommand =
  | { t: 'focusActive' }
  | { t: 'toggleOverview' }
  | { t: 'lookAt'; x: number; y: number };

type Listener<T> = (v: T) => void;

class CameraBus {
  private view: CameraView = { x: 0, y: 0, w: 1440, h: 750, zoom: 1, mode: 'intro', fit: true, shell: null };
  private viewListeners = new Set<Listener<CameraView>>();
  private cmdListeners = new Set<Listener<CameraCommand>>();

  publish(v: CameraView): void {
    this.view = v;
    for (const l of this.viewListeners) l(v);
  }
  get current(): CameraView { return this.view; }
  onView(l: Listener<CameraView>): () => void { this.viewListeners.add(l); return () => this.viewListeners.delete(l); }

  command(c: CameraCommand): void { for (const l of this.cmdListeners) l(c); }
  onCommand(l: Listener<CameraCommand>): () => void { this.cmdListeners.add(l); return () => this.cmdListeners.delete(l); }
}

export const cameraBus = new CameraBus();
