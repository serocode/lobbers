import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface StageProps {
  width: number;
  height: number;
  children: ReactNode;
  /** Optional label for screen readers. */
  label?: string;
}

/** Scales a fixed-size artboard uniformly to fit the window, centred and letterboxed (#101522). Never reflows. */
export function Stage({ width, height, children, label }: StageProps): JSX.Element {
  const [scale, setScale] = useState(1);
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = (): void => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / width, r.height / height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const outer: CSSProperties = { position: 'fixed', inset: 0, background: '#101522', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const box: CSSProperties = { width: width * scale, height: height * scale, position: 'relative', flex: 'none' };
  const art: CSSProperties = { width, height, position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0' };
  return (
    <div ref={host} style={outer} aria-label={label}>
      <div style={box}>
        <div style={art} data-stage-scale={scale.toFixed(4)}>{children}</div>
      </div>
    </div>
  );
}
