// Status-effect badges (DESIGN_SPEC §3.5): 16 px circles left of the unit's name tag.
import type Phaser from 'phaser';

export type StatusIcon = 'frozen' | 'shield' | 'burning' | 'fuel';

const FILL: Record<StatusIcon, number> = { frozen: 0x9FE3FF, shield: 0xB07CF2, burning: 0xFF6B3D, fuel: 0x5ACB91 };

export function drawStatusIcon(g: Phaser.GameObjects.Graphics, kind: StatusIcon, cx: number, cy: number): void {
  g.fillStyle(FILL[kind]).fillCircle(cx, cy, 7).lineStyle(1.5, 0x0B0F1A).strokeCircle(cx, cy, 7);
  g.lineStyle(1.4, 0x0B0F1A);
  switch (kind) {
    case 'frozen': // snowflake (Battle.dc.html "Frozen" icon)
      g.lineBetween(cx, cy - 4.5, cx, cy + 4.5).lineBetween(cx - 4, cy - 2.2, cx + 4, cy + 2.2).lineBetween(cx - 4, cy + 2.2, cx + 4, cy - 2.2);
      return;
    case 'shield':
      g.fillStyle(0x0B0F1A).beginPath().moveTo(cx, cy - 4.5).lineTo(cx + 4, cy - 3).lineTo(cx + 3.4, cy + 1.5).lineTo(cx, cy + 4.6).lineTo(cx - 3.4, cy + 1.5).lineTo(cx - 4, cy - 3).closePath().fillPath();
      return;
    case 'burning':
      g.fillStyle(0x0B0F1A).beginPath().moveTo(cx, cy - 5).lineTo(cx + 3.6, cy + 1).lineTo(cx + 2, cy + 4.4).lineTo(cx - 2, cy + 4.4).lineTo(cx - 3.6, cy + 1).closePath().fillPath();
      g.fillStyle(0xFFD166).fillCircle(cx, cy + 2, 1.6);
      return;
    case 'fuel': // bolt
      g.fillStyle(0x0B0F1A).beginPath().moveTo(cx + 1, cy - 5).lineTo(cx - 3, cy + 1).lineTo(cx, cy + 1).lineTo(cx - 1, cy + 5).lineTo(cx + 3, cy - 1).lineTo(cx, cy - 1).closePath().fillPath();
  }
}
