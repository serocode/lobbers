// Scene.dc.html `layer="back"`: sky, celestial body, far scenery, clouds, islands, hills, hazard strip.
import type { MapId } from '@lobbers/shared';
import { translate, type SceneModel } from './sceneModel';

export function SceneBackLayer({ m, id, skyId }: { m: SceneModel; id: MapId; skyId: string }): JSX.Element {
  const { P, W, H } = m;
  const celT = `translate(${m.cel.x} ${m.cel.y})`;
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={`url(#${skyId})`} />
      {m.stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F5F1E8"><animate attributeName="opacity" values=".2;1;.2" dur={`${s.dur}s`} repeatCount="indefinite" /></circle>
      ))}
      {id === 'cobalt' && (
        <g transform={celT}>
          <circle cx="-880" cy="-40" r="20" fill="#F5F1E8" opacity=".75" />
          <ellipse cx="0" cy="0" rx="128" ry="24" fill="none" stroke="#F5D7A1" strokeWidth="9" opacity=".7" transform="rotate(-16)" />
          <circle cx="0" cy="0" r="74" fill="#F2A65A" stroke="#151B2B" strokeWidth="4" />
          <path d="M-68 -22 Q0 -38 68 -18 M-72 10 Q0 -4 72 16" fill="none" stroke="#D9783A" strokeWidth="10" opacity=".7" />
          <path d="M-40 -54 Q-20 -66 8 -68" fill="none" stroke="#FFE2B8" strokeWidth="6" strokeLinecap="round" opacity=".7" />
          <path d="M-124 36 A128 24 -16 0 0 122 -38" fill="none" stroke="#F5D7A1" strokeWidth="9" opacity=".95" />
        </g>
      )}
      {id === 'ember' && (
        <g>
          <g transform={celT}><circle cx="0" cy="0" r="190" fill="#FFB45E" opacity=".16" /><circle cx="0" cy="0" r="135" fill="#FFB45E" opacity=".9" /><circle cx="0" cy="0" r="135" fill="none" stroke="#FFE29A" strokeWidth="6" opacity=".6" /></g>
          {m.volcanoes.map((v, i) => (
            <g key={i} transform={translate(v)}><path d="M-130 150 L-40 0 L-10 14 L20 -6 L40 0 L130 150 Z" fill="#3A1A30" /><path d="M-14 8 Q5 -20 26 6" fill="none" stroke="#FF8A3D" strokeWidth="7"><animate attributeName="opacity" values=".4;1;.4" dur="2s" repeatCount="indefinite" /></path><path d="M6 -4 Q2 40 -8 90" fill="none" stroke="#FF6B3D" strokeWidth="5" opacity=".7" /></g>
          ))}
        </g>
      )}
      {id === 'glacier' && (
        <g>
          <path d={m.aurora[0].a} fill="none" stroke="#5ACB91" strokeWidth="56" opacity=".22" strokeLinecap="round"><animate attributeName="d" values={`${m.aurora[0].a};${m.aurora[0].b};${m.aurora[0].a}`} dur="16s" repeatCount="indefinite" /></path>
          <path d={m.aurora[1].a} fill="none" stroke="#8FE3FF" strokeWidth="34" opacity=".18" strokeLinecap="round"><animate attributeName="d" values={`${m.aurora[1].a};${m.aurora[1].b};${m.aurora[1].a}`} dur="12s" repeatCount="indefinite" /></path>
          <g transform={celT}><circle cx="0" cy="0" r="52" fill="#EAF2FF" stroke="#151B2B" strokeWidth="4" /><circle cx="-16" cy="-12" r="10" fill="#C9D8F0" /><circle cx="16" cy="14" r="13" fill="#C9D8F0" /></g>
        </g>
      )}
      {id === 'dunes' && (
        <g>
          <g transform={celT}><circle cx="0" cy="0" r="210" fill="#FFF3C4" opacity=".18" /><circle cx="0" cy="0" r="120" fill="#FFF3C4" opacity=".95" /></g>
          {m.pyramids.map((p, i) => <g key={i} transform={translate(p)}><path d="M-150 0 L0 -150 L150 0 Z" fill="#C98458" /><path d="M0 -150 L150 0 L40 0 Z" fill="#A86A38" opacity=".7" /></g>)}
        </g>
      )}
      {id === 'skyreach' && (
        <g transform={celT}>
          <circle cx="0" cy="0" r="140" fill="#FFFFFF" opacity=".25" />
          <circle cx="0" cy="0" r="62" fill="#FFF6C8" stroke="#FFD166" strokeWidth="6" />
          <g stroke="#FFF6C8" strokeWidth="8" strokeLinecap="round" opacity=".7"><path d="M0 -96 V-78 M0 78 V96 M-96 0 H-78 M78 0 H96 M-68 -68 L-55 -55 M55 55 L68 68 M-68 68 L-55 55 M55 -55 L68 -68" /><animateTransform attributeName="transform" type="rotate" values="0;45" dur="8s" repeatCount="indefinite" /></g>
        </g>
      )}
      {id === 'hollow' && (
        <g transform={celT}><circle cx="0" cy="0" r="150" fill="#B07CF2" opacity=".14" /><circle cx="0" cy="0" r="74" fill="#E6D9F2" stroke="#151B2B" strokeWidth="4" /><circle cx="-22" cy="-16" r="12" fill="#CDBEE6" /><circle cx="20" cy="20" r="16" fill="#CDBEE6" /></g>
      )}
      {m.farD && <path d={m.farD} fill={P.far} />}
      {m.skyIsles.map((s, i) => (
        <g key={i} transform={translate(s)} opacity=".75"><path d="M-90 0 Q-60 50 0 70 Q60 50 90 0 Q0 -18 -90 0 Z" fill={P.far} /><path d="M-92 0 Q0 -22 92 0" fill="none" stroke="#DDEBFF" strokeWidth="8" strokeLinecap="round" /></g>
      ))}
      {m.clouds.map((c, i) => (
        <g key={i} opacity={c.op}>
          <animateTransform attributeName="transform" type="translate" values={`-360 ${c.y};${W + 360} ${c.y}`} dur={`${c.dur}s`} begin={`${c.begin}s`} repeatCount="indefinite" />
          <path d="M0 30 Q0 10 22 12 Q30 -6 52 2 Q70 -8 86 10 Q108 8 108 30 Z" fill={P.cloud} transform={`scale(${c.scale})`} />
        </g>
      ))}
      <rect x="0" y={m.hazeY} width={W} height={m.hazeH} fill={P.skyBot} opacity=".22" />
      <path d={m.midD} fill={P.mid} opacity={m.midOp} />
      {m.bgShrooms.map((s, i) => (
        <g key={i} transform={translate(s)}><rect x="-16" y="-260" width="32" height="260" fill="#2E1E52" /><path d="M-120 -250 Q0 -360 120 -250 Q0 -226 -120 -250 Z" fill="#3E2470" />
          <circle cx="-50" cy="-276" r="9" fill="#A8FFD8" opacity=".7"><animate attributeName="opacity" values=".3;.9;.3" dur={`${s.dur}s`} repeatCount="indefinite" /></circle><circle cx="30" cy="-296" r="7" fill="#A8FFD8" opacity=".6" /><circle cx="70" cy="-266" r="6" fill="#FF7EB6" opacity=".7" /></g>
      ))}
      <path d={m.nearD} fill={P.near} opacity={m.nearOp} />
      {m.islands.map((it, i) => (
        <g key={i} transform={translate(it)}>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur={`${it.dur}s`} repeatCount="indefinite" />
            <rect x="46" y="10" width="16" height="190" fill={P.fall} opacity=".55" />
            <path d="M50 10 V200 M57 10 V200" stroke="#fff" strokeWidth="2" strokeDasharray="10 14" opacity=".6"><animate attributeName="stroke-dashoffset" values="0;-48" dur=".8s" repeatCount="indefinite" /></path>
            <g stroke="#151B2B" strokeWidth="4" strokeLinejoin="round">
              <path d="M-80 4 Q-64 50 -24 84 Q-4 108 10 82 Q44 60 80 4 Z" fill={P.dirtDark} />
              <path d="M-82 2 L82 2 L72 18 L-72 18 Z" fill={P.dirt} />
              <path d="M-86 4 Q-82 -10 -60 -8 Q-30 -15 0 -10 Q40 -17 70 -9 Q90 -8 86 6 Z" fill={P.grass} />
            </g>
            <path d="M-40 30 Q-44 54 -36 70 M20 40 Q26 62 18 84 M-10 70 Q-12 90 -4 104" fill="none" stroke={P.trunk} strokeWidth="3" strokeLinecap="round" />
            <g transform="translate(-34 -8)" stroke="#151B2B" strokeWidth="3">
              <rect x="-4" y="-26" width="8" height="26" fill={P.trunk} />
              <circle cx="0" cy="-36" r="18" fill={P.foliage} /><circle cx="10" cy="-28" r="12" fill={P.foliageDark} />
            </g>
          </g>
        </g>
      ))}
      {m.hazard === 'lava' && (
        <g><rect x="0" y={m.hzY} width={W} height="80" fill="#FF6B3D" /><rect x="0" y={m.hzY} width={W} height="80" fill="#FFD166" opacity=".4"><animate attributeName="opacity" values=".15;.5;.15" dur="2.4s" repeatCount="indefinite" /></rect><path d={m.hzWave} fill="none" stroke="#FFE29A" strokeWidth="5" opacity=".8" /></g>
      )}
      {m.hazard === 'water' && (
        <g><rect x="0" y={m.hzY} width={W} height="80" fill="#2E6FA8" /><path d={m.hzWave} fill="none" stroke="#D7F3FF" strokeWidth="4" opacity=".7"><animateTransform attributeName="transform" type="translate" values="0 0;-60 0;0 0" dur="5s" repeatCount="indefinite" /></path></g>
      )}
    </g>
  );
}

/** Floating motes drawn above the terrain (Scene.dc.html, back layer only). */
export function SceneMotes({ m }: { m: SceneModel }): JSX.Element {
  return (
    <g>
      {m.motes.map((mo, i) => (
        <circle key={i} cx={mo.x} cy={mo.y} r={mo.r} fill={m.P.mote} opacity=".8">
          <animate attributeName="cy" values={`${mo.from};${mo.to}`} dur={`${mo.dur}s`} begin={`${mo.begin}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;.9;0" dur={`${mo.dur}s`} begin={`${mo.begin}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}
