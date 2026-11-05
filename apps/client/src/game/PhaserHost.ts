// Creates / destroys the Phaser game for the battlefield canvas. The canvas renders at device density
// (`density` canvas px per layout px) and is displayed at the field's layout size.
import Phaser from 'phaser';
import type { MatchStartedMsg } from '@lobbers/shared';
import type { ClientMatch } from '../state/ClientMatch';
import type { BattleControls } from '../state/battleControls';
import type { LayoutSpec } from './layouts';
import { BattleScene, type BattleSceneData } from './scenes/BattleScene';
import { cosmeticTextures } from './render/svgSources';
import { DENSITY_CAP, useSettings } from '../state/uiStores';

export interface MountOptions {
  match: ClientMatch;
  controls: BattleControls;
  start: MatchStartedMsg;
  layout: LayoutSpec;
  /** CSS px per layout px (the Stage scale). */
  stageScale: number;
}

const FONTS = ['700 12px Fredoka', '400 36px "Lilita One"', '700 12px "JetBrains Mono"'];

export async function mountBattle(parent: HTMLElement, o: MountOptions): Promise<Phaser.Game> {
  await Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => [])));
  const extra = await cosmeticTextures(o.start, 1).catch(() => []);
  const density = Math.max(1, Math.min(DENSITY_CAP[useSettings.getState().graphics], (window.devicePixelRatio || 1) * o.stageScale));
  const texScale = Math.max(1, Math.min(2, Math.ceil(o.layout.zoom * density * 4) / 4));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { w, h } = o.layout.field;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round(w * density),
    height: Math.round(h * density),
    backgroundColor: '#101522',
    banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / density },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
    disableContextMenu: true,
    fps: { target: 60, smoothStep: true },
  });
  const data: BattleSceneData = { match: o.match, controls: o.controls, start: o.start, layout: o.layout, density, texScale, reducedMotion, extraTextures: extra };
  game.scene.add('battle', BattleScene, true, data);
  return game;
}
