// Minimap, kill feed, combat log, camera buttons, off-screen marker (Battle.dc.html field HUD).
import { useEffect, useMemo, useState } from 'react';
import { CAMERA, MAPS, type MapId, type Terrain } from '@lobbers/shared';
import { FocusIcon, LogIcon, OverviewIcon, SkullIcon } from '../../components';
import { EmoteButton } from '../EmoteWheel';
import { cameraBus, type CameraView } from '../../state/cameraBus';
import { TEAM_COLOR, unitOf } from '../../state/matchStore';
import { useBattleUi } from '../../state/uiStores';
import { useBattle, useMatch } from '../BattleContext';
import s from '../battle.module.css';

export const minimapHeight = (mapId: MapId, width = CAMERA.minimap.width): number => Math.round((width * MAPS[mapId].height) / MAPS[mapId].width);

/** Live camera view for HUD widgets (state updates only when the rounded rect changes). */
export function useCameraView(): CameraView {
  const [v, setV] = useState(cameraBus.current);
  useEffect(() => cameraBus.onView((n) => setV((o) => (Math.round(o.x) === Math.round(n.x) && Math.round(o.y) === Math.round(n.y) && o.zoom === n.zoom && o.mode === n.mode && o.fit === n.fit && !n.shell && !o.shell ? o : n))), []);
  return v;
}

/** Terrain silhouette from the mirror mask (reflects craters), sampled every 20 px. */
function silhouette(t: Terrain): string {
  let d = '';
  let open = false;
  const pts: string[] = [];
  const bottoms: string[] = [];
  const close = (): void => { if (open) d += `M${pts.join(' L')} L${bottoms.reverse().join(' L')} Z `; pts.length = 0; bottoms.length = 0; open = false; };
  for (let x = 0; x <= t.width; x += 20) {
    const cx = Math.min(t.width - 1, x);
    const top = t.surfaceBelow(cx, 0);
    if (top === null) { close(); continue; }
    let bot = top;
    while (bot < t.height && t.isSolid(cx, bot)) bot += 4;
    pts.push(`${cx} ${top}`); bottoms.push(`${cx} ${Math.min(t.height, bot)}`); open = true;
  }
  close();
  return d;
}

export function Minimap(): JSX.Element {
  const { match } = useBattle();
  const mapId = useMatch((v) => v.mapId);
  const units = useMatch((v) => v.units);
  const props = useMatch((v) => v.props);
  const active = useMatch((v) => v.activeUnitId);
  const checks = useMatch((v) => v.hash.checks);
  const youId = useMatch((v) => (v.localPlayerIds.length === 1 ? v.units.find((u) => u.playerId === v.localPlayerIds[0])?.id : undefined));
  const cam = useCameraView();
  const m = MAPS[mapId], h = minimapHeight(mapId);
  const d = useMemo(() => (match.world ? silhouette(match.world.terrain) : ''), [match, checks]);
  const click = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (cam.fit || cam.mode === 'follow') return;
    const r = e.currentTarget.getBoundingClientRect();
    cameraBus.command({ t: 'lookAt', x: ((e.clientX - r.left) / r.width) * m.width, y: ((e.clientY - r.top) / r.height) * m.height });
  };
  return (
    <button type="button" className={`hud ${s.mini}`} onClick={click} aria-label={`Minimap of ${m.name}. Click to move the camera there.`} style={{ position: 'absolute', right: 14, top: 120, width: 266, height: h + 6 }}>
      <svg aria-hidden="true" width="260" height={h} viewBox={`0 0 ${m.width} ${m.height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <rect x="0" y="0" width={m.width} height={m.height} fill={m.palette.skyTop} opacity=".55" />
        <path d={d} fill="#3B4257" stroke="#F5F1E8" strokeWidth="10" strokeOpacity=".35" />
        {props.filter((p) => p.alive).map((p) => <rect key={p.id} x={p.x - 20} y={p.y - 40} width="40" height="40" fill={p.kind === 'barrel' ? '#FF8A3D' : '#5ACB91'} />)}
        {units.filter((u) => u.alive).map((u) => (
          <circle key={u.id} cx={u.x} cy={u.y - 30} r={Math.round(m.width / 85)} fill={u.id === youId ? '#FFD166' : TEAM_COLOR[u.team]} stroke="#0B0F1A" strokeWidth="10">
            {u.id === active && <animate attributeName="r" values={`${Math.round(m.width / 85)};${Math.round(m.width / 60)};${Math.round(m.width / 85)}`} dur="1s" repeatCount="indefinite" />}
          </circle>
        ))}
        {cam.shell && <circle cx={cam.shell.x} cy={cam.shell.y} r={Math.round(m.width / 140)} fill="#F5F1E8" stroke="#0B0F1A" strokeWidth="8" />}
        <rect x={Math.max(0, cam.x)} y={Math.max(0, cam.y)} width={Math.min(m.width, cam.w)} height={Math.min(m.height, cam.h)} fill="#FFD166" fillOpacity=".08" stroke="#FFD166" strokeWidth="14" />
      </svg>
      <span className="mono" style={{ position: 'absolute', left: 8, top: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#F5F1E8', textShadow: '0 1px 0 #0B0F1A' }}>{m.name.toUpperCase()}</span>
    </button>
  );
}

export function KillFeed({ top }: { top: number }): JSX.Element {
  const feed = useMatch((v) => v.feed);
  return (
    <div style={{ position: 'absolute', right: 14, top, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {feed.map((k) => (
        <div key={k.id} className={`${s.feed} hud`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 14, fontWeight: 700, borderRadius: 8 }}>
          <span style={{ color: k.killerColor }}>{k.killer}</span>
          <SkullIcon size={18} teeth="#F5F1E8" role="img" aria-label="eliminated" />
          <span style={{ color: k.victimColor, textDecoration: 'line-through' }}>{k.victim}</span>
        </div>
      ))}
    </div>
  );
}

export function CombatLog(): JSX.Element | null {
  const open = useBattleUi((u) => u.logOpen);
  const log = useMatch((v) => v.log);
  const mapName = useMatch((v) => MAPS[v.mapId].name);
  if (!open) return null;
  return (
    <section aria-label="Combat log" className="hud" style={{ position: 'absolute', right: 14, bottom: 166, width: 300, maxHeight: 214, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#A9B3CC' }}>COMBAT LOG</span><span className="mono" style={{ fontSize: 11, color: '#A9B3CC' }}>{mapName} · TDM</span></div>
      <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
        {log.map((l) => (
          <div key={l.id} className={s.feed} style={{ fontSize: 13, lineHeight: 1.3, display: 'flex', gap: 7, alignItems: 'baseline' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, flex: 'none', background: l.color, transform: 'translateY(-1px)' }} /><span style={{ color: '#E6E2D8' }}>{l.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LogToggle(): JSX.Element {
  const set = useBattleUi((u) => u.set), open = useBattleUi((u) => u.logOpen);
  return <button type="button" className="btn" aria-label="Toggle combat log" aria-pressed={open} onClick={() => set({ logOpen: !open })} style={{ position: 'absolute', right: 14, top: 14, width: 52, height: 52 }}><LogIcon /></button>;
}

export function CameraButtons({ top = 690 }: { top?: number }): JSX.Element {
  const cam = useCameraView();
  const hint = cam.mode === 'follow' ? 'Camera following the shot' : cam.fit ? 'Overview · Z to zoom back in' : 'Drag to look around · F focus · Z overview · T emotes';
  return (
    <div style={{ position: 'absolute', left: 14, top, display: 'flex', gap: 8, alignItems: 'center' }}>
      <button type="button" className="btn" onClick={() => cameraBus.command({ t: 'focusActive' })} aria-label="Focus camera on the active machine (F)" title="Focus (F)" style={{ width: 46, height: 46 }}><FocusIcon /></button>
      <button type="button" className={`btn ${s.cam} ${cam.fit ? s.on : ''}`} onClick={() => cameraBus.command({ t: 'toggleOverview' })} aria-pressed={cam.fit} aria-label="Toggle whole-map overview (Z)" title="Overview (Z)" style={{ width: 46, height: 46 }}><OverviewIcon /></button>
      <EmoteButton />
      <span className="hud" style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 9, color: '#C9D1E0' }}>{hint}</span>
    </div>
  );
}

/** Yellow arrow + name pinned to the field edge when the active machine is off screen. */
export function EdgeMarker({ fieldW, fieldH }: { fieldW: number; fieldH: number }): JSX.Element | null {
  const cam = useCameraView();
  const act = useMatch((v) => unitOf(v, v.activeUnitId));
  const youName = useMatch((v) => (v.localPlayerIds.length === 1 && act && v.localPlayerIds[0] === act.playerId ? 'You' : act?.name ?? ''));
  if (!act || !act.alive || cam.fit || cam.mode === 'follow' || cam.mode === 'intro') return null;
  const ins = CAMERA.edgeMarkerInset;
  const sx = (act.x - cam.x) * cam.zoom, sy = (act.y - 40 - cam.y) * cam.zoom;
  if (sx >= 30 && sx <= fieldW - 30 && sy >= 130 && sy <= fieldH - 20) return null;
  const ex = Math.max(ins.x, Math.min(fieldW - ins.x, sx)), ey = Math.max(ins.top, Math.min(fieldH - ins.bottom, sy));
  const rot = (Math.atan2(sy - ey, sx - ex) * 180) / Math.PI;
  return (
    <div className={s.edge} style={{ position: 'absolute', left: ex, top: ey, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
      <svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30" style={{ transform: `rotate(${rot.toFixed(0)}deg)` }}><path d="M4 6 L26 15 L4 24 L10 15 Z" fill="#FFD166" stroke="#0B0F1A" strokeWidth="3" strokeLinejoin="round" /></svg>
      <span className="hud" style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>{youName}</span>
    </div>
  );
}
