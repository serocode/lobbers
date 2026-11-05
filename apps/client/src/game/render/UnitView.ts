// One machine on the battlefield: barrel (rotating about rig.json pivot) behind the body, plus the
// name tag / HP bar / status icons / active arrow from Battle.dc.html. Draws state; never decides it.
import Phaser from 'phaser';
import { MACHINES, type TeamId, type UnitState } from '@lobbers/shared';
import type { LayoutSpec } from '../layouts';
import { drawStatusIcon, type StatusIcon } from './statusIcons';

const ART_W = 120, ART_GROUND = 95, DRAW_W = 100;
const S = DRAW_W / ART_W;
const TEAM = { red: { col: 0xF45B55, dark: 0x3A2230 }, blue: { col: 0x4C9AFF, dark: 0x1E2D4E } } as const;

export interface UnitLook { angle: number; active: boolean; you: boolean; ownTeam: TeamId; burning: boolean }

export class UnitView {
  readonly id: string;
  x: number;
  y: number;
  private readonly body: Phaser.GameObjects.Container;
  private readonly hull: Phaser.GameObjects.Image;
  private readonly barrel: Phaser.GameObjects.Image;
  private readonly ice: Phaser.GameObjects.Graphics;
  private readonly tag: Phaser.GameObjects.Container;
  private readonly tagGfx: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text | null;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly hover: number;
  private bob = { y: 0 };
  private bounce = { v: 0 };
  private arrowBase = -145;
  private key = '';
  private dead = false;
  private gone = false;
  private smoke: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene, u: UnitState, private readonly layout: LayoutSpec, k: number, depth: number, res: number, private readonly reducedMotion: boolean) {
    this.id = u.id;
    this.x = u.x; this.y = u.y;
    const m = MACHINES[u.machine];
    this.hover = m.hover;
    const sc = S / k;
    this.barrel = scene.add.image((m.barrelPivot.x - 60) * S, (m.barrelPivot.y - ART_GROUND) * S, `barrel-${u.machine}`)
      .setOrigin(m.barrelPivot.x / ART_W, m.barrelPivot.y / 100).setScale(sc);
    this.hull = scene.add.image(0, 0, `body-${u.machine}-${u.team}`).setOrigin(0.5, ART_GROUND / 100).setScale(sc);
    this.ice = scene.add.graphics().setVisible(false);
    this.drawIce();
    this.body = scene.add.container(u.x, u.y, [this.barrel, this.hull, this.ice]).setDepth(depth);
    this.tagGfx = scene.add.graphics();
    this.nameText = layout.tag.name
      ? scene.add.text(0, 0, u.name, { fontFamily: 'Fredoka', fontStyle: '700', fontSize: `${layout.tag.font}px`, color: '#F5F1E8', resolution: res }).setOrigin(0.5, 0)
      : null;
    this.arrow = scene.add.graphics();
    this.arrow.fillStyle(0xFFD166).lineStyle(3, 0x0B0F1A).beginPath().moveTo(-11, 0).lineTo(11, 0).lineTo(0, 16).closePath().fillPath().strokePath();
    this.arrow.setVisible(false);
    this.tag = scene.add.container(u.x, u.y, [this.tagGfx, ...(this.nameText ? [this.nameText] : []), this.arrow]).setDepth(depth + 1);
    if (!reducedMotion) scene.tweens.add({ targets: this.bounce, v: -8, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (u.machine === 'whirligig' && !reducedMotion) scene.tweens.add({ targets: this.bob, y: -4, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawIce(): void {
    const g = this.ice;
    const pt = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2((x - 60) * S, (y - ART_GROUND) * S);
    const poly = [pt(12, 92), pt(10, 44), pt(30, 22), pt(70, 16), pt(104, 30), pt(110, 92)];
    g.fillStyle(0x9FE3FF, 0.32).lineStyle(3, 0x0B0F1A, 0.8).fillPoints(poly, true).strokePoints(poly, true);
    g.lineStyle(3, 0xFFFFFF, 0.7).lineBetween(pt(24, 40).x, pt(24, 40).y, pt(38, 28).x, pt(38, 28).y).lineBetween(pt(28, 60).x, pt(28, 60).y, pt(34, 54).x, pt(34, 54).y);
  }

  setPos(x: number, y: number): void { this.x = x; this.y = y; }

  /** Per-frame: position, facing, barrel, tag. Redraws the tag only when its content changes. */
  update(u: UnitState, look: UnitLook): void {
    if (this.gone) return;
    const lift = this.hover + this.bob.y;
    const facing = look.active ? (look.angle <= 90 ? 1 : -1) : u.facing;
    const elev = facing > 0 ? look.angle : 180 - look.angle;
    this.body.setPosition(this.x, this.y - (this.dead ? 0 : lift) + (this.dead ? 5 : 0));
    this.body.scaleX = facing;
    this.barrel.setAngle(this.dead ? 18 : -elev);
    this.tag.setPosition(this.x, this.y - lift);
    const frozen = u.alive && u.status.frozenTurns > 0;
    this.ice.setVisible(frozen);
    if (!u.alive && !this.dead) this.becomeWreck();
    const icons: StatusIcon[] = [];
    if (u.alive) {
      if (frozen) icons.push('frozen');
      if (u.status.shield) icons.push('shield');
      if (look.burning) icons.push('burning');
      if (u.status.unlimitedFuel) icons.push('fuel');
    }
    const key = `${u.alive}|${u.hp}|${u.maxHp}|${look.you}|${look.ownTeam}|${icons.join(',')}`;
    if (key !== this.key) { this.key = key; this.drawTag(u, look, icons); }
    this.arrow.setVisible(u.alive && look.active).setY(this.arrowBase + this.bounce.v);
  }

  private drawTag(u: UnitState, look: UnitLook, icons: StatusIcon[]): void {
    const g = this.tagGfx.clear();
    const t = this.layout.tag;
    const top = -79 - t.top;
    const team = TEAM[u.team];
    if (!u.alive) {
      this.arrow.setVisible(false);
      if (!this.nameText) return;
      this.nameText.setStyle({ fontSize: '11px', color: '#A9B3CC' }).setPosition(0, -97);
      const w = this.nameText.width + 12;
      g.fillStyle(0x101522, 0.8).fillRoundedRect(-w / 2, -97, w, this.nameText.height, 5);
      g.lineStyle(1.5, 0xA9B3CC).lineBetween(-w / 2 + 6, -97 + this.nameText.height / 2 + 1, w / 2 - 6, -97 + this.nameText.height / 2 + 1);
      this.tag.bringToTop(this.nameText);
      return;
    }
    let rowH = 0;
    let iconX = -t.hpW / 2 - 4;
    if (this.nameText) {
      const w = this.nameText.width + 14 + 4, h = this.nameText.height + 2 + 4;
      g.fillStyle(team.dark).fillRoundedRect(-w / 2, top, w, h, 6);
      g.lineStyle(2, look.you ? 0xFFD166 : team.col).strokeRoundedRect(-w / 2, top, w, h, 6);
      this.nameText.setPosition(0, top + 3);
      rowH = h + 2;
      iconX = -w / 2 - 3;
    }
    const hpTop = top + rowH;
    const pct = Math.max(0, Math.min(1, u.hp / u.maxHp));
    const hpCol = pct < 0.3 ? 0xF45B55 : u.team === look.ownTeam ? 0x5ACB91 : 0x4C9AFF;
    const b = t.hpBorder;
    g.fillStyle(0x0B0F1A).fillRoundedRect(-t.hpW / 2, hpTop, t.hpW, t.hpH, t.hpH / 2);
    g.fillStyle(0x0E1320).fillRect(-t.hpW / 2 + b, hpTop + b, t.hpW - 2 * b, t.hpH - 2 * b);
    g.fillStyle(hpCol).fillRect(-t.hpW / 2 + b, hpTop + b, (t.hpW - 2 * b) * pct, t.hpH - 2 * b);
    const iconY = this.nameText ? top + 2 : hpTop - 3;
    for (let i = icons.length - 1; i >= 0; i--) { drawStatusIcon(g, icons[i], iconX - 8, iconY + 8); iconX -= 19; }
    this.arrowBase = this.layout.id === 'phone' ? -133 : top - 28;
  }

  private becomeWreck(): void {
    this.dead = true;
    this.body.setAngle(9);
    for (const img of [this.hull, this.barrel]) {
      const fx = img.preFX?.addColorMatrix();
      if (fx) { fx.grayscale(0.85); fx.brightness(0.65, true); } else img.setTint(0x6E6E6E);
    }
    if (this.reducedMotion) return;
    this.smoke = this.scene.time.addEvent({ delay: 1100, loop: true, callback: () => this.puff() });
    this.puff();
  }

  private puff(): void {
    const c = this.scene.add.circle(this.x - 6 + Math.random() * 12, this.y - 40, 5, 0x5B6378, 0.8).setDepth(this.body.depth + 1);
    this.scene.tweens.add({ targets: c, y: c.y - 48, scale: 3, alpha: 0, duration: 2200, onComplete: () => c.destroy() });
  }

  /** Fell into the void / hazard: drop out of sight. */
  vanish(): void {
    if (this.gone) return;
    this.gone = true;
    this.smoke?.remove();
    this.scene.tweens.add({ targets: [this.body, this.tag], alpha: 0, duration: 900 });
  }

  /** White hit flash + jolt (`.unit.hit .mach`). */
  hit(): void {
    if (this.gone) return;
    this.hull.setTintFill(0xFFFFFF);
    this.scene.time.delayedCall(90, () => this.hull.clearTint());
    this.scene.tweens.add({ targets: this.hull, x: { from: -6, to: 0 }, duration: 420, ease: 'Elastic.easeOut' });
  }

  destroy(): void { this.smoke?.remove(); this.body.destroy(); this.tag.destroy(); }
}
