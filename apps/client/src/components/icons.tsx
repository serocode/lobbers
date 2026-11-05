// Inline stroke icons copied from the mockups (no icon fonts, no emoji).
import type { ReactElement, SVGProps } from 'react';

type P = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;
const base = (size: number, rest: Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>): SVGProps<SVGSVGElement> =>
  ({ 'aria-hidden': true, width: size, height: size, viewBox: '0 0 24 24', ...rest });

export const PauseIcon = ({ size = 20, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="#F5F1E8"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
);
export const CloseIcon = ({ size = 16, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M5 5l14 14M19 5 5 19" /></svg>
);
export const ChevronLeft = ({ size = 14, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
);
export const ChevronRight = ({ size = 14, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
);
/** Jump (DESIGN_SPEC §3.3): chevron-up. */
export const ChevronUp = ({ size = 14, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>
);
export const LogIcon = ({ size = 22, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="#F5F1E8" strokeWidth="2.6" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
);
export const FocusIcon = ({ size = 22, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>
);
export const OverviewIcon = ({ size = 22, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" /></svg>
);
export const StarIcon = ({ size = 34, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="#101522"><path d="M12 2l2.8 6.6L22 9.3l-5.4 4.8L18 21l-6-3.6L6 21l1.4-6.9L2 9.3l7.2-.7z" /></svg>
);
/** Ultimate (DESIGN_SPEC §3.2): crown/burst in the same filled style as the special star. */
export const CrownIcon = ({ size = 34, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="#101522"><path d="M3 18 4.5 7l4.8 4.6L12 4l2.7 7.6L19.5 7 21 18Z" /><rect x="3" y="19" width="18" height="2.6" rx="1.2" /></svg>
);
export const MoreIcon = ({ size = 24, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="#F5F1E8"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
);
export const CheckIcon = ({ size = 20, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="#5ACB91" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
);
export const ErrorIcon = ({ size = 20, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="#F45B55" strokeWidth="3.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
);
/** Skull used on eliminated member chips and in the kill feed (Battle.dc.html). `teeth` is the stroke on the jaw lines. */
export const SkullIcon = ({ size = 22, teeth = '#0B0F1A', ...r }: P & { teeth?: string }): ReactElement => (
  <svg {...base(size, r)}><circle cx="12" cy="11" r="8" fill="#F5F1E8" stroke="#0B0F1A" strokeWidth="2" /><circle cx="9" cy="10" r="2" fill="#0B0F1A" /><circle cx="15" cy="10" r="2" fill="#0B0F1A" /><path d="M9 19v3M12 19v3M15 19v3" stroke={teeth} strokeWidth="2" /></svg>
);
/** wifi-off stroke icon for disconnected badges (DESIGN_SPEC §3.4). */
export const WifiOffIcon = ({ size = 12, ...r }: P): ReactElement => (
  <svg {...base(size, r)} fill="none" stroke="#F5F1E8" strokeWidth="2.6" strokeLinecap="round"><path d="M2 8.5a16 16 0 0 1 20 0M5.5 12.5a11 11 0 0 1 13 0M9 16.5a5.5 5.5 0 0 1 6 0M3 3l18 18" /><circle cx="12" cy="20" r="1" fill="#F5F1E8" /></svg>
);
