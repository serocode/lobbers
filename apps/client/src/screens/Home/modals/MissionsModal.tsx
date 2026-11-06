// Daily Missions (Main.dc.html Missions modal; DESIGN_SPEC §2.1): today's local missions from profile.progress,
// reset at local midnight, Claim pays coins/gems into the local profile once.
import { useEffect, useState } from 'react';
import { claimMission, missionStatus } from '@lobbers/shared';
import { CloseButton, Modal } from '../../../components';
import { useProfile } from '../../../state/profile';

const hms = (ms: number): string => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':'); };

export function MissionsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const p = useProfile((v) => v.profile);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const list = p ? missionStatus(p, now) : [];
  const claim = (id: string): void => {
    if (!p) return;
    const r = claimMission(p, id, Date.now());
    if (!r.ok) { setToast(r.reason); return; }
    useProfile.getState().update(() => r.value);
    const m = list.find((x) => x.def.id === id)!;
    setToast('coins' in m.def.reward ? `+${m.def.reward.coins} coins claimed` : `+${m.def.reward.gems} gems claimed`);
  };
  return (
    <Modal label="Missions" onClose={onClose} style={{ width: 640, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Daily Missions</h2><span className="mono" data-testid="missions-reset" style={{ fontSize: 13, color: '#A9B3CC' }}>Resets in {hms((list[0]?.resetAt ?? now) - now)}</span></div>
        {toast && <span role="status" style={{ fontWeight: 600, color: '#5ACB91' }}>{toast}</span>}
        <CloseButton onClick={onClose} />
      </div>
      {list.map((m) => {
        const pct = Math.round((m.value / m.def.goal) * 100);
        const ready = m.done && !m.claimed;
        const reward = 'coins' in m.def.reward ? `${m.def.reward.coins} ¢` : `${m.def.reward.gems} gems`;
        return (
          <div key={m.def.id} data-testid={`mission-${m.def.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{m.def.text}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, height: 12, background: '#0E1320', border: '2px solid #0B0F1A', borderRadius: 6, overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: m.done ? '#5ACB91' : '#4C9AFF' }} /></span>
                <span className="mono" style={{ fontSize: 12, color: '#A9B3CC' }}>{m.value.toLocaleString('en-US')} / {m.def.goal.toLocaleString('en-US')}</span>
              </span>
            </div>
            <span className="mono" style={{ fontSize: 14, color: '#FFD166', width: 76, textAlign: 'right' }}>{reward}</span>
            <button type="button" className="btn" onClick={() => claim(m.def.id)} disabled={!ready} style={{ height: 42, width: 96, fontSize: 14, background: ready ? '#FFD166' : '#232B42', color: ready ? '#101522' : '#A9B3CC' }}>{m.claimed ? 'Claimed' : m.done ? 'Claim' : 'Locked'}</button>
          </div>
        );
      })}
    </Modal>
  );
}
