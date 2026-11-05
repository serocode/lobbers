// Small shared controls: PlayButton, FireButton, Switch, Segmented, Meter, TimerRing.
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './components.module.css';

// ---------- PlayButton (Main.dc.html .btn.play) ----------
export interface PlayButtonProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

const playStyle: CSSProperties = { position: 'relative', overflow: 'hidden', height: 104, display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', borderWidth: 4, boxShadow: '0 7px 0 #0B0F1A' };

export function PlayButton({ title, subtitle, icon, to, onClick, disabled, style }: PlayButtonProps): JSX.Element {
  const inner = (
    <>
      <span className={s.shine} />
      {icon}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
        <span className="fd" style={{ fontSize: 46, lineHeight: 1 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>{subtitle}</span>}
      </span>
    </>
  );
  const cls = `btn ${s.play}`;
  if (to && !disabled) return <Link to={to} className={cls} style={{ ...playStyle, ...style }}>{inner}</Link>;
  return <button type="button" className={cls} style={{ ...playStyle, ...style }} onClick={onClick} disabled={disabled}>{inner}</button>;
}

// ---------- FireButton (Battle.dc.html .fire) ----------
export interface FireButtonProps {
  label: string;
  ready: boolean;
  disabled: boolean;
  onFire: () => void;
  ariaLabel?: string;
}

export function FireButton({ label, ready, disabled, onFire, ariaLabel = 'Fire (Space)' }: FireButtonProps): JSX.Element {
  return (
    <button type="button" className={`${s.fire} ${ready ? s.ready : ''}`} onClick={onFire} disabled={disabled} aria-label={ariaLabel}>
      <span className={s.face}><span className="fd">{label}</span></span>
      <span className={s.lip} />
    </button>
  );
}

// ---------- Switch (.sw) ----------
export interface SwitchProps { checked: boolean; onChange: (v: boolean) => void; label: string }

export function Switch({ checked, onChange, label }: SwitchProps): JSX.Element {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, padding: '4px 2px' }}>
      {label}
      <span className="sw"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    </label>
  );
}

// ---------- Segmented / Tabs / Chips ----------
export type SegmentKind = 'seg' | 'tab' | 'chip';
export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  kind?: SegmentKind;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, kind = 'seg', label }: SegmentedProps<T>): JSX.Element {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, flexWrap: kind === 'seg' ? 'nowrap' : 'wrap' }}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className={`btn ${s[kind]} ${o.value === value ? s.on : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Meter (inline bars) ----------
export interface MeterProps {
  /** 0–100 */
  pct: number;
  color: string;
  height?: number;
  width?: number | string;
  border?: boolean;
  align?: 'left' | 'right';
  label?: string;
}

export function Meter({ pct, color, height = 10, width = '100%', border = true, align = 'left', label }: MeterProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span role={label ? 'meter' : undefined} aria-label={label} aria-valuenow={label ? Math.round(clamped) : undefined}
      style={{ width, height, border: border ? '2px solid #0B0F1A' : 'none', borderRadius: height / 2, background: '#0E1320', overflow: 'hidden', display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', flex: typeof width === 'string' ? undefined : 'none' }}>
      <span style={{ display: 'block', height: '100%', width: `${clamped}%`, background: color, transition: 'width .6s cubic-bezier(.3,1,.4,1)' }} />
    </span>
  );
}

// ---------- TimerRing (Battle r=24 / Machines r=16) ----------
export interface TimerRingProps { seconds: number; total: number; size?: number; pulse?: boolean }

export const timerColor = (sec: number): string => (sec <= 5 ? '#F45B55' : sec <= 10 ? '#FFD166' : '#5ACB91');

export function TimerRing({ seconds, total, size = 60, pulse = true }: TimerRingProps): JSX.Element {
  const col = timerColor(seconds);
  const off = (150.8 * (1 - Math.max(0, Math.min(1, seconds / Math.max(1, total))))).toFixed(1);
  return (
    <div className={pulse && seconds <= 5 ? s.tlow : ''} style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="24" fill="#0E1320" stroke="#2A3045" strokeWidth="6" />
        <circle cx="30" cy="30" r="24" fill="none" stroke={col} strokeWidth="6" strokeDasharray="150.8" strokeDashoffset={off} transform="rotate(-90 30 30)" strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="mono" aria-label="Seconds left" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size / 3), fontWeight: 700, color: col }}>{seconds}</span>
    </div>
  );
}
