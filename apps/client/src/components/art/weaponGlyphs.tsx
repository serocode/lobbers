// Weapon icon glyphs, ported verbatim from design/mockup/WeaponIcon.dc.html (64×64 viewBox).
import type { ReactElement } from 'react';
import type { WeaponIconId } from '@lobbers/shared';

function Explosive({ col }: { col: string }): ReactElement {
  return (
    <>
      <g transform="rotate(-35 32 32)">
          <path d="M12 24 H38 Q54 32 38 40 H12 Z" fill={col}></path>
          <rect x="8" y="22" width="9" height="20" rx="2" fill="#5B6378"></rect>
          <rect x="26" y="24" width="5" height="16" fill="#151B2B" opacity=".35" stroke="none"></rect>
          <path d="M18 28 H36" stroke="#fff" strokeWidth="2.5" opacity=".5"></path>
        </g>
    </>
  );
}

function Cluster({ col }: { col: string }): ReactElement {
  return (
    <>
      <circle cx="28" cy="36" r="17" fill={col}></circle>
        <path d="M38 22 Q44 12 52 14" fill="none" stroke="#C9A26B" strokeWidth="3"></path>
        <circle cx="52" cy="40" r="6" fill={col}></circle><circle cx="46" cy="54" r="5" fill={col}></circle><circle cx="12" cy="16" r="5" fill={col}></circle>
        <path d="M20 30 Q24 24 30 23" fill="none" stroke="#fff" strokeWidth="3" opacity=".5"></path>
    </>
  );
}

function Guided({ col }: { col: string }): ReactElement {
  return (
    <>
      <circle cx="46" cy="18" r="11" fill="none" stroke={col} strokeWidth="3"></circle>
        <path d="M46 4 V10 M46 26 V32 M32 18 H38 M54 18 H60" stroke={col} strokeWidth="3"></path>
        <g transform="rotate(-40 30 36)">
          <path d="M10 31 H40 Q50 36 40 41 H10 Z" fill="#E6E9F2"></path>
          <path d="M14 31 L8 22 H16 L22 31 Z M14 41 L8 50 H16 L22 41 Z" fill={col}></path>
          <rect x="30" y="31" width="4" height="10" fill={col} stroke="none"></rect>
        </g>
    </>
  );
}

function Electric({ col }: { col: string }): ReactElement {
  return (
    <>
      <circle cx="32" cy="32" r="22" fill="#2A3045"></circle>
        <circle cx="32" cy="32" r="22" fill="none" stroke={col} strokeWidth="3" opacity=".6" strokeDasharray="6 6"></circle>
        <path d="M35 10 L20 36 H31 L27 54 L44 26 H33 Z" fill={col}></path>
    </>
  );
}

function Fire({ col }: { col: string }): ReactElement {
  return (
    <>
      <path d="M32 6 Q40 20 48 26 Q56 36 50 46 Q44 58 32 58 Q18 58 13 46 Q8 34 18 24 Q20 32 26 32 Q22 18 32 6 Z" fill={col}></path>
        <path d="M32 30 Q38 38 40 44 Q40 52 32 52 Q24 52 24 44 Q24 38 32 30 Z" fill="#FFD166" strokeWidth="2.5"></path>
    </>
  );
}

function Ice({ col }: { col: string }): ReactElement {
  return (
    <>
      <path d="M32 4 L42 22 L32 60 L22 22 Z" fill={col}></path>
        <path d="M12 20 L22 30 L18 50 L6 34 Z" fill={col} opacity=".85"></path>
        <path d="M52 20 L58 34 L46 50 L42 30 Z" fill={col} opacity=".85"></path>
        <path d="M32 10 L36 22 L32 44" fill="none" stroke="#fff" strokeWidth="2.5"></path>
    </>
  );
}

function Special({ col }: { col: string }): ReactElement {
  return (
    <>
      <path d="M14 56 H50 L44 42 H20 Z" fill="#5B6378"></path>
        <rect x="26" y="20" width="12" height="22" fill="#3B4257"></rect>
        <circle cx="32" cy="16" r="8" fill={col}></circle>
        <path d="M16 8 Q10 16 16 24 M48 8 Q54 16 48 24 M10 4 Q2 16 10 28 M54 4 Q62 16 54 28" fill="none" stroke={col} strokeWidth="3"></path>
    </>
  );
}

function Drill({ col }: { col: string }): ReactElement {
  return (
    <>
      <g transform="rotate(40 32 32)">
          <rect x="24" y="4" width="16" height="14" rx="3" fill="#5B6378"></rect>
          <path d="M20 18 H44 L32 60 Z" fill={col}></path>
          <path d="M22 26 L42 22 M24 34 L40 30 M27 42 L37 39 M29 50 L35 48" fill="none" stroke="#151B2B" strokeWidth="2.5"></path>
          <path d="M26 20 L31 52" fill="none" stroke="#fff" strokeWidth="2" opacity=".55"></path>
        </g>
    </>
  );
}

function Gravity({ col }: { col: string }): ReactElement {
  return (
    <>
      <ellipse cx="32" cy="34" rx="28" ry="9" fill="none" stroke={col} strokeWidth="3" transform="rotate(-18 32 34)"></ellipse>
        <circle cx="32" cy="32" r="16" fill="#2A3045"></circle>
        <circle cx="32" cy="32" r="8" fill={col}></circle>
        <path d="M5 42 A28 9 -18 0 0 59 25" fill="none" stroke={col} strokeWidth="3" strokeDasharray="4 5"></path>
        <circle cx="55" cy="20" r="3.5" fill="#F5F1E8"></circle>
    </>
  );
}

export const WEAPON_GLYPHS: Record<WeaponIconId, (p: { col: string }) => ReactElement> = {
  Explosive, Cluster, Guided, Electric, Fire, Ice, Special, Drill, Gravity,
};
