import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface StageProps {
  width: number;
  height: number;
  children: ReactNode;
  /** Optional label for screen readers. */
  label?: string;
  /**
   * `auto` (menus, default): fit the whole artboard, unless that would shrink it below SHORT_SCREEN_SCALE while the
   * width alone allows a much bigger scale — then fit the width and scroll vertically (phones in landscape).
   * `contain` (battle): always fit the whole artboard, never scroll.
   */
  fit?: 'auto' | 'contain';
}

/** Below this whole-artboard scale, a short wide screen switches to width-fit + vertical scroll. */
export const SHORT_SCREEN_SCALE = 0.55;

/** The uniform scale for an artboard in a viewport, and whether it scrolls vertically (DESIGN_SPEC §0 Stage). */
export function stageScale(vw: number, vh: number, w: number, h: number, fit: 'auto' | 'contain'): { scale: number; scroll: boolean } {
  const whole = Math.min(vw / w, vh / h);
  const byWidth = Math.min(vw / w, 1);
  if (fit === 'auto' && whole < SHORT_SCREEN_SCALE && byWidth > whole * 1.25) return { scale: byWidth, scroll: true };
  return { scale: whole, scroll: false };
}

/** Scales a fixed-size artboard uniformly, centred and letterboxed (#101522). Never reflows. */
export function Stage({ width, height, children, label, fit = 'auto' }: StageProps): JSX.Element {
  const [view, setView] = useState({ scale: 1, scroll: false });
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      const next = stageScale(r.width, r.height, width, height, fit);
      setView((v) => (v.scale === next.scale && v.scroll === next.scroll ? v : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, fit]);

  const { scale, scroll } = view;
  const outer: CSSProperties = {
    position: 'fixed', inset: 0, background: '#101522', display: 'flex', justifyContent: 'center',
    alignItems: scroll ? 'flex-start' : 'center', overflowX: 'hidden', overflowY: scroll ? 'auto' : 'hidden',
  };
  const box: CSSProperties = { width: width * scale, height: height * scale, position: 'relative', flex: 'none' };
  const art: CSSProperties = { width, height, position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0' };
  return (
    <div ref={host} style={outer} aria-label={label}>
      <div style={box}>
        <div style={art} data-stage-scale={scale.toFixed(4)} data-stage-scroll={scroll ? 'true' : undefined}>{children}</div>
      </div>
    </div>
  );
}
