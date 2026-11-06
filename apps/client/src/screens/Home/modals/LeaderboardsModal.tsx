// Leaderboards (Main.dc.html; DESIGN_SPEC §2.1): Friends = you + your recent players by rating (`localLeaderboard`,
// ratings as last seen in a lobby). Global needs a server — disabled with the reason (DECISIONS).
import { localLeaderboard } from '@lobbers/shared';
import { CloseButton, MachineArt, Modal } from '../../../components';
import { useProfile } from '../../../state/profile';
import { lastMachine } from '../../Friends/model';
import { avatarKind } from '../../Profile/model';

const RANK_COL = ['#FFD166', '#D9DEE8', '#F28C38'];

export function LeaderboardsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const p = useProfile((v) => v.profile);
  const rows = p ? localLeaderboard(p) : [];
  return (
    <Modal label="Leaderboards" onClose={onClose} style={{ width: 620, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Leaderboards</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn seg" disabled title="Needs a server — not in this version">Global</button>
        <button type="button" className="btn seg on" aria-pressed="true">Friends</button>
      </div>
      {rows.length === 1 && <span style={{ fontSize: 14, color: '#A9B3CC' }}>Finish a match with friends to see them ranked here.</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflow: 'auto' }}>
        {rows.map((l, i) => (
          <div key={l.id} data-testid={l.you ? 'leader-you' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', borderRadius: 8, background: l.you ? '#2A2A1E' : '#1C2338', border: `2px solid ${l.you ? '#FFD166' : '#0B0F1A'}` }}>
            <span className="fd" style={{ width: 34, fontSize: 22, color: RANK_COL[i] ?? '#A9B3CC' }}>{i + 1}</span>
            <span style={{ width: 42, height: 42, background: '#232B42', border: '2px solid #0B0F1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={p && l.you ? avatarKind(p) : p ? lastMachine(p, l.id) : 'thumper'} size={36} tint="#FFD166" /></span>
            <span style={{ flex: 1, fontWeight: 600 }}>{l.name}{l.you ? ' (you)' : ''}</span>
            <span className="mono" style={{ width: 80, textAlign: 'right', color: '#FFD166' }}>{l.rating.toLocaleString('en-US')}</span>
            <span className="mono" style={{ width: 56, textAlign: 'right', color: '#A9B3CC', fontSize: 13 }}>LV {l.level}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
