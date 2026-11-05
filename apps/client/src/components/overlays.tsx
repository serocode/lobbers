// Panel, HudPanel, Modal (scrim + pop-in + focus trap + Esc) and Toast.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { CheckIcon, CloseIcon, ErrorIcon } from './icons';
import s from './components.module.css';

type Tag = 'div' | 'section' | 'aside';

export interface PanelProps { as?: Tag; style?: CSSProperties; className?: string; children?: ReactNode; label?: string }

/** `.panel` — navy, 3 px ink border, radius 12, hard shadow. */
export function Panel({ as: T = 'div', style, className, children, label }: PanelProps): JSX.Element {
  return <T className={`panel ${className ?? ''}`} style={style} aria-label={label}>{children}</T>;
}

/** `.hud` — 86 % opaque battle HUD panel. */
export function HudPanel({ as: T = 'section', style, className, children, label }: PanelProps): JSX.Element {
  return <T className={`hud ${className ?? ''}`} style={style} aria-label={label}>{children}</T>;
}

export interface ModalProps {
  label: string;
  onClose?: () => void;
  style?: CSSProperties;
  scrimStyle?: CSSProperties;
  children: ReactNode;
  /** Clicking the scrim closes (default true when onClose is given). */
  closeOnScrim?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** `.scrim` + `.panel.modal`. Esc closes, focus is trapped inside and restored on close. */
export function Modal({ label, onClose, style, scrimStyle, children, closeOnScrim = true }: ModalProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? box.current)?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const els = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const a = els[0], b = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" style={scrimStyle} onClick={closeOnScrim && onClose ? onClose : undefined}>
      <div ref={box} tabIndex={-1} className="panel modal" role="dialog" aria-modal="true" aria-label={label} style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }): JSX.Element {
  return (
    <button type="button" className="btn" aria-label={label} onClick={onClick} style={{ width: 44, height: 44, flex: 'none' }}>
      <CloseIcon />
    </button>
  );
}

export interface ToastProps { message: string; kind?: 'ok' | 'error'; style?: CSSProperties }

/** Bottom-centre toast with green check (or red X for errors). Parent controls lifetime (2–2.2 s). */
export function Toast({ message, kind = 'ok', style }: ToastProps): JSX.Element {
  return (
    <div className={`panel ${s.toast}`} role={kind === 'error' ? 'alert' : 'status'} style={style}>
      {kind === 'error' ? <ErrorIcon /> : <CheckIcon />}
      {message}
    </div>
  );
}
