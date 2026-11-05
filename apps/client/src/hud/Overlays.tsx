// Turn banner, elimination ribbon, hurt vignette and toasts (Battle.dc.html overlays). Shared by all layouts.
import { useEffect, useState } from 'react';
import { MachineArt, Toast } from '../components';
import { cameraBus } from '../state/cameraBus';
import { useBattle, useMatch } from './BattleContext';
import s from './battle.module.css';

/** Shows a value for `ms` after it changes (by id), then hides it. */
function useTransient<T extends { id: number }>(value: T | null, ms: number): T | null {
  const [shown, setShown] = useState<T | null>(null);
  useEffect(() => {
    if (!value) return;
    setShown(value);
    const t = setTimeout(() => setShown((c) => (c?.id === value.id ? null : c)), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return shown;
}

export function TurnBanner({ width, top, scale = 1 }: { width: number; top: number; scale?: number }): JSX.Element | null {
  const banner = useTransient(useMatch((v) => v.banner), 1650);
  if (!banner) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top, width, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
      <div key={banner.id} className={s.banner} role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#101522', border: '4px solid #0B0F1A', boxShadow: '0 7px 0 #0B0F1A', padding: `${10 * scale}px ${60 * scale}px ${12 * scale}px`, borderTop: `8px solid ${banner.color}` }}>
        <span className="fd" style={{ fontSize: 64 * scale, lineHeight: 1, color: banner.color, WebkitTextStroke: '4px #0B0F1A', paintOrder: 'stroke fill' }}>{banner.title}</span>
        <span style={{ fontSize: 15 * Math.max(0.85, scale), fontWeight: 700, color: '#F5F1E8', letterSpacing: 1 }}>{banner.sub}</span>
      </div>
    </div>
  );
}

export function ElimRibbon({ width, top, scale = 1 }: { width: number; top: number; scale?: number }): JSX.Element | null {
  const elim = useTransient(useMatch((v) => v.elim), 2250);
  if (!elim) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top, width, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 21 }}>
      <div key={elim.id} className={s.elim} role="status" style={{ display: 'flex', alignItems: 'center', gap: 16 * scale, background: '#F45B55', border: '4px solid #0B0F1A', boxShadow: '0 7px 0 #0B0F1A', padding: `8px ${26 * scale}px 8px 10px`, transformOrigin: 'center' }}>
        <span style={{ width: 84 * scale, height: 70 * scale, background: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MachineArt kind={elim.machine} pose="wreck" tint="#8A93A8" size={76 * scale} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', color: '#101522' }}>
          <span className="fd" style={{ fontSize: 40 * scale, lineHeight: 1 }}>{elim.name}</span>
          <span className="fd" style={{ fontSize: 20 * scale, letterSpacing: 4 }}>{elim.how}</span>
        </span>
      </div>
    </div>
  );
}

export function HurtVignette(): JSX.Element | null {
  const hurtAt = useMatch((v) => v.hurtAt);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!hurtAt) return;
    setKey(hurtAt);
    const t = setTimeout(() => setKey(0), 620);
    return () => clearTimeout(t);
  }, [hurtAt]);
  return key ? <div key={key} className={s.hurt} /> : null;
}

/** Rejected intents and other notices (DESIGN_SPEC §3.8): red toast with the server reason. */
export function BattleToast({ bottom }: { bottom: number }): JSX.Element | null {
  const toast = useTransient(useMatch((v) => v.toast), 2200);
  if (!toast) return null;
  return <Toast key={toast.id} kind={toast.kind} message={toast.text} style={{ bottom }} />;
}

/** Dev-only telemetry for checks and Playwright: fps + terrain hash agreement. */
export function useFpsProbe(): void {
  const { match } = useBattle();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let frames = 0, last = performance.now(), raf = 0;
    const tick = (t: number): void => {
      frames++;
      const c = cameraBus.current;
      (window as unknown as { __lobbersCam?: object }).__lobbersCam = { x: Math.round(c.x), y: Math.round(c.y), zoom: c.zoom, mode: c.mode, fit: c.fit };
      if (t - last >= 1000) {
        const st = match.store.getState();
        (window as unknown as { __lobbers?: object }).__lobbers = { fps: Math.round((frames * 1000) / (t - last)), hash: st.hash, phase: st.sync.phase, active: st.activeUnitId, turn: st.turnNumber, result: st.result?.winner ?? null, units: st.units.map((u) => ({ id: u.id, hp: u.hp, alive: u.alive, x: Math.round(u.x), y: Math.round(u.y) })) };
        frames = 0; last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [match]);
}
