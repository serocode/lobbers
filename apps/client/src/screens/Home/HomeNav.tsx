// Bottom nav (Main.dc.html <nav>): Home · Machines · Inventory · Missions · Leaderboards · Settings.
// Inventory, Missions and Leaderboards need accounts (Phase 4) and stay disabled with the reason.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './home.module.css';

const PHASE4 = 'Arrives with accounts (Phase 4)';

const Icon = ({ d, fill = false, children }: { d?: string; fill?: boolean; children?: ReactNode }): JSX.Element => (
  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">{d && <path d={d} />}{children}</svg>
);

export function HomeNav({ onSettings }: { onSettings: () => void }): JSX.Element {
  return (
    <nav aria-label="Main" className="panel" style={{ position: 'absolute', left: 24, top: 800, width: 1012, height: 80, padding: 6, display: 'flex', gap: 8 }}>
      <Link to="/" className={`btn ${s.navi} ${s.on}`} aria-current="page"><Icon d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" />Home</Link>
      <Link to="/machines" className={`btn ${s.navi}`}><Icon d="M5 14l2-5h9l2 5M12 9V6h8"><rect x="2" y="14" width="20" height="6" rx="3" /></Icon>Machines</Link>
      <button type="button" className={`btn ${s.navi}`} disabled title={PHASE4}><Icon d="M3 8h18v12H3zM8 8V5h8v3M3 13h18" />Inventory</button>
      <button type="button" className={`btn ${s.navi}`} disabled title={PHASE4}><Icon d="M5 21V4M5 4h12l-3 4 3 4H5" />Missions</button>
      <button type="button" className={`btn ${s.navi}`} disabled title={PHASE4}><Icon d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H3a4 4 0 0 0 4 4M17 6h4a4 4 0 0 1-4 4M12 14v4M8 21h8" />Leaderboards</button>
      <button type="button" className={`btn ${s.navi}`} onClick={onSettings}><Icon d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"><circle cx="12" cy="12" r="3.2" /></Icon>Settings</button>
    </nav>
  );
}
