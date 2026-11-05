import { memo, useId, useMemo, type CSSProperties } from 'react';
import { MAPS, type MapId } from '@lobbers/shared';
import { sceneModel, translate } from './sceneModel';
import { SceneBackLayer, SceneMotes } from './SceneBackLayer';
import { TREE_GROUP_ATTRS, columnMarkup, rockMarkup, treeMarkup } from './sceneArt';

export interface Crater { x: number; y: number; r: number }

export interface SceneBackdropProps {
  map: MapId;
  layer?: 'all' | 'back' | 'terrain';
  /** Rendered size; the scene is drawn at world size and cropped with `xMidYMid slice` like the mockup. */
  w?: number;
  h?: number;
  craters?: Crater[];
  style?: CSSProperties;
}

const groupAttrs = (attrs: string): Record<string, string> =>
  Object.fromEntries(Array.from(attrs.matchAll(/([a-z-]+)="([^"]*)"/g)).map(([, k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v]));

/** Scene.dc.html: map backdrop + terrain + decorations. Used by menus (Home, Lobby, thumbnails) and /dev/kit. */
export const SceneBackdrop = memo(function SceneBackdrop({ map, layer = 'all', w = 1440, h = 750, craters = [], style }: SceneBackdropProps): JSX.Element {
  const m = sceneModel(map);
  const { P, W, H } = m;
  const showBack = layer !== 'terrain', showTerrain = layer !== 'back';
  const treeAttrs = useMemo(() => groupAttrs(TREE_GROUP_ATTRS), []);
  const uid = `${map}-${useId().replace(/:/g, '')}`;
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8', background: layer === 'terrain' ? 'transparent' : P.skyTop, ...style }}>
      <svg width={w} height={h} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`${MAPS[map].name} battlefield`}>
        <defs>
          <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.skyTop} /><stop offset=".55" stopColor={P.skyMid} /><stop offset="1" stopColor={P.skyBot} />
          </linearGradient>
          <clipPath id={`tc-${uid}`}><path d={m.terrainD} /></clipPath>
          <mask id={`cm-${uid}`} maskUnits="userSpaceOnUse" x="-50" y="-50" width={W + 100} height={H + 100}>
            <rect x="-50" y="-50" width={W + 100} height={H + 100} fill="#fff" />
            {craters.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="#000" />)}
          </mask>
        </defs>
        {showBack && <SceneBackLayer m={m} id={map} skyId={`sky-${uid}`} />}
        {showTerrain && (
          <g mask={`url(#cm-${uid})`}>
            <path d={m.terrainD} fill={P.dirt} />
            <g clipPath={`url(#tc-${uid})`}>
              <path d={m.topD} transform="translate(0 70)" fill="none" stroke={P.dirtDark} strokeWidth="30" opacity=".45" />
              <path d={m.topD} transform="translate(0 150)" fill="none" stroke={P.dirtDark} strokeWidth="44" opacity=".6" />
              {m.isFloat && <path d={m.botD} fill="none" stroke="#151B2B" strokeWidth="40" opacity=".35" />}
              {m.pebbles.map((p, i) => <ellipse key={i} cx={p.x} cy={p.y} rx={p.r} ry={p.ry} fill={P.rock} stroke="#151B2B" strokeWidth="2.5" />)}
              {craters.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r + 9} fill="#151B2B" opacity=".55" />)}
            </g>
            {m.isFloat && <path d={m.botD} fill="none" stroke="#151B2B" strokeWidth="5" strokeLinejoin="round" />}
            {m.roots.map((d, i) => <path key={i} d={d} fill="none" stroke={P.trunk} strokeWidth="4" strokeLinecap="round" />)}
            <path d={m.topD} fill="none" stroke="#151B2B" strokeWidth="20" strokeLinejoin="round" />
            <path d={m.topD} fill="none" stroke={P.grass} strokeWidth="14" strokeLinejoin="round" />
            <path d={m.topD} transform="translate(0 -3)" fill="none" stroke={P.grassHi} strokeWidth="4" strokeLinejoin="round" opacity=".9" />
            {m.rocks.map((r, i) => <g key={i} transform={translate(r)} dangerouslySetInnerHTML={{ __html: rockMarkup(P) }} />)}
            {m.trees.map((t, i) => <g key={i} transform={translate(t)} {...treeAttrs} dangerouslySetInnerHTML={{ __html: treeMarkup(m.treeKind, P, t.cap, t.dur) }} />)}
            {m.columns.map((c, i) => <g key={i} transform={translate(c)} dangerouslySetInnerHTML={{ __html: columnMarkup() }} />)}
          </g>
        )}
        {showBack && <SceneMotes m={m} />}
      </svg>
    </div>
  );
});
