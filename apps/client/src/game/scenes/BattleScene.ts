// The battlefield (Phaser draws; @lobbers/shared decides). Builds the world from the start snapshot +
// the client mirror, then plays the replay timeline every frame.
import Phaser from 'phaser';
import { MACHINES, MAPS, hitCenter, type MatchStartedMsg, type ShotModifier, type UnitState } from '@lobbers/shared';
import type { ClientMatch } from '../../state/ClientMatch';
import type { BattleControls } from '../../state/battleControls';
import { cameraBus } from '../../state/cameraBus';
import { canControl, unitOf, type MatchView } from '../../state/matchStore';
import { useSettings, useBattleUi, type Settings } from '../../state/uiStores';
import type { LayoutSpec } from '../layouts';
import { CameraDirector } from '../render/CameraDirector';
import { Decorations } from '../render/Decorations';
import { FieldInput } from '../render/FieldInput';
import { Fx } from '../render/Fx';
import { Preview } from '../render/Preview';
import { PropViews } from '../render/PropViews';
import { ShotView } from '../render/ShotView';
import { TerrainPainter } from '../render/TerrainPainter';
import { UnitView } from '../render/UnitView';
import { backgroundUrl, decorTextures, machineTextures, spriteTextures } from '../render/svgSources';
import { createScenePresenter } from './scenePresenter';

export interface BattleSceneData {
  match: ClientMatch;
  controls: BattleControls;
  start: MatchStartedMsg;
  layout: LayoutSpec;
  /** Canvas px per layout px. */
  density: number;
  /** Texture px per world px. */
  texScale: number;
  reducedMotion: boolean;
}

const D = { bg: 0, terrain: 10, deco: 12, flames: 14, preview: 16, props: 18, units: 30, shots: 40, fx: 50 } as const;

export class BattleScene extends Phaser.Scene {
  d!: BattleSceneData;
  layout!: LayoutSpec;
  director!: CameraDirector;
  fx!: Fx;
  shots!: ShotView;
  props!: PropViews;
  readonly unitViews = new Map<string, UnitView>();
  readonly paths = new Map<string, { start: number; points: Array<[number, number]> }>();
  private terrain!: TerrainPainter;
  private decos!: Decorations;
  private preview!: Preview;
  private input2!: FieldInput;
  private bg!: Phaser.GameObjects.Image;
  private bgScale = 1;
  private terrainVersion = 0;
  private pendingVanish = new Set<string>();
  private cleanups: Array<() => void> = [];

  constructor() { super('battle'); }

  init(d: BattleSceneData): void { this.d = d; this.layout = d.layout; }

  preload(): void {
    const { start, texScale: k } = this.d;
    const kinds = start.units.map((u) => u.machine), teams = start.units.map((u) => u.team);
    for (const t of [...machineTextures(kinds, teams, k), ...spriteTextures(k), ...decorTextures(start.mapId, k)]) this.load.svg(t.key, t.url, { width: t.width, height: t.height });
    const map = MAPS[start.mapId];
    const gl = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const max = typeof gl.getMaxTextureSize === 'function' ? gl.getMaxTextureSize() : 4096;
    this.bgScale = Math.max(0.5, Math.min(k, max / map.width, max / map.height));
    this.load.svg('bg', backgroundUrl(start.mapId), { width: Math.round(map.width * this.bgScale), height: Math.round(map.height * this.bgScale) });
  }

  create(): void {
    const { match, start, texScale: k, reducedMotion, density } = this.d;
    const world = match.world;
    if (!world) throw new Error('match not started');
    const map = MAPS[start.mapId];
    this.cameras.main.setBackgroundColor(map.palette.skyTop);
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0).setScale(1 / this.bgScale).setDepth(D.bg);
    this.terrain = new TerrainPainter(this, start.mapId, k, world.terrain, D.terrain);
    this.decos = new Decorations(this, start.mapId, k, D.deco, reducedMotion);
    this.props = new PropViews(this, world.props, k, D.props, reducedMotion);
    const res = density;
    for (const u of this.view().units) this.unitViews.set(u.id, new UnitView(this, u, this.layout, k, D.units, res, reducedMotion));
    this.shots = new ShotView(this, D.shots, k);
    this.fx = new Fx(this, D.fx, res, k, reducedMotion);
    this.fx.syncBurnZones(this.view().burnZones, world.terrain);
    this.preview = new Preview(this, D.preview, this.layout);
    this.director = new CameraDirector(this, { view: { w: this.layout.field.w, h: this.layout.field.h }, playZoom: this.layout.zoom, density, map });
    const v = this.view();
    if (v.turnNumber > 0 && v.activeUnitId) { this.director.endIntro(); const a = unitOf(v, v.activeUnitId); if (a) this.director.focusOn(a.x, a.y, 'focus', false); } else this.director.intro();
    this.input2 = new FieldInput(this, this.director, {
      density,
      aimUnit: () => (canControl(this.view()) && !useBattleUi.getState().armoryOpen ? unitOf(this.view(), this.view().activeUnitId) ?? null : null),
      setAim: (angle, power) => this.d.controls.setAim({ angle, power }),
    });
    this.cleanups.push(match.addPresenter(createScenePresenter(this)));
    this.cleanups.push(match.store.subscribe((s, p) => { if (s.burnZones !== p.burnZones && match.world) this.fx.syncBurnZones(s.burnZones, match.world.terrain); }));
    this.cleanups.push(cameraBus.onCommand((c) => {
      const a = unitOf(this.view(), this.view().activeUnitId);
      if (c.t === 'focusActive' && a && !this.director.flying) { if (this.director.fit) this.director.toggleOverview({ x: a.x, y: a.y }); else this.director.focusOn(a.x, a.y); }
      if (c.t === 'toggleOverview' && !this.director.flying) this.director.toggleOverview(a ? { x: a.x, y: a.y } : null);
      if (c.t === 'lookAt') this.director.lookAt(c.x, c.y);
    }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  view(): MatchView { return this.d.match.store.getState(); }
  settings(): Settings { return useSettings.getState(); }
  unitState(id: string | null): UnitState | undefined { return unitOf(this.view(), id); }

  shake(): void {
    if (this.settings().screenShake && !this.d.reducedMotion) this.cameras.main.shake(450, 0.0045);
  }

  carve(x: number, y: number, r: number): void {
    const t0 = performance.now();
    this.terrain.carve(x, y, r);
    if (import.meta.env.DEV) {
      const w = window as unknown as { __lobbersPerf?: { carves: number; maxCarveMs: number } };
      const p = (w.__lobbersPerf ??= { carves: 0, maxCarveMs: 0 });
      p.carves++;
      p.maxCarveMs = Math.max(p.maxCarveMs, Math.round((performance.now() - t0) * 100) / 100);
    }
    this.terrainVersion++;
    const w = this.d.match.world;
    if (w) this.decos.afterCarve(w.terrain, x, y, r);
  }

  vanishAfterPath(id: string): void { this.pendingVanish.add(id); }

  override update(_t: number, dt: number): void {
    const v = this.view();
    const replay = this.d.match.replay;
    const tick = replay.tick;
    // Projectiles + camera follow.
    if (replay.action?.kind === 'shot') {
      const lead = this.shots.update(tick);
      this.director.setShell(lead);
      if (!lead && this.director.flying) this.director.hold();
    }
    if (this.director.mode === 'hold' && v.sync.phase === 'acting' && !replay.busy) {
      const a = unitOf(v, v.activeUnitId);
      if (a) this.director.focusOn(a.x, a.y);
    }
    this.input2.update(dt);
    this.director.update(dt);
    const bp = this.director.backdropPos();
    this.bg.setPosition(bp.x, bp.y);
    this.updateUnits(v, tick, dt);
    this.updatePreview(v, dt);
    this.terrain.flush();
  }

  private updateUnits(v: MatchView, tick: number, dt: number): void {
    const online = v.localPlayerIds.length === 1;
    const mine = online ? v.units.find((u) => u.playerId === v.localPlayerIds[0]) : undefined;
    const ownTeam = mine?.team ?? 'red';
    for (const u of v.units) {
      const view = this.unitViews.get(u.id);
      if (!view) continue;
      const path = this.paths.get(u.id);
      if (path) {
        const i = Math.max(0, Math.min(path.points.length - 1, Math.floor(tick - path.start)));
        view.setPos(path.points[i][0], path.points[i][1]);
        if (i >= path.points.length - 1 && this.pendingVanish.has(u.id)) { this.pendingVanish.delete(u.id); view.vanish(); }
      } else {
        view.setPos(u.x, u.y);
        if (this.pendingVanish.has(u.id)) { this.pendingVanish.delete(u.id); view.vanish(); }
      }
      const active = u.id === v.activeUnitId && u.alive && !v.result;
      const aim = v.aim[u.id], remote = v.remoteAim[u.id];
      const angle = (v.localPlayerIds.includes(u.playerId) ? aim?.angle : remote?.angle) ?? aim?.angle ?? (u.facing > 0 ? 30 : 150);
      const c = hitCenter(u);
      const burning = v.burnZones.some((z) => Math.hypot(c.x - z.x, c.y - z.y) < z.radius);
      view.update(u, { angle, active, you: !!mine && mine.id === u.id, ownTeam, burning });
    }
    if (this.director.mode === 'focus') {
      const a = unitOf(v, v.activeUnitId), av = a ? this.unitViews.get(a.id) : undefined;
      if (a && av && this.paths.has(a.id)) this.director.track(av.x, av.y, dt);
    }
  }

  private updatePreview(v: MatchView, dt: number): void {
    const w = this.d.match.world, id = v.activeUnitId, aim = id ? v.aim[id] : undefined;
    if (!w || !id || !aim || !canControl(v) || !this.settings().trajectoryPreview || useBattleUi.getState().armoryOpen) { this.preview.hide(); return; }
    const u = unitOf(v, id);
    const mods: ShotModifier[] = [];
    if (u) {
      const m = MACHINES[u.machine];
      for (const [slot, def] of [['special', m.special], ['ultimate', m.ultimate]] as const) {
        if (v.armed[slot]) for (const e of def.effects) if (e.type === 'shotModifier') mods.push(e);
      }
    }
    this.preview.update(w, id, aim, mods, dt, this.terrainVersion);
  }

  private teardown(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.input2?.destroy();
  }
}
