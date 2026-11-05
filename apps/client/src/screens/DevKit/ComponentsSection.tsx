import { useEffect, useState } from 'react';
import {
  Button, ButtonLink, CloseButton, FireButton, HudPanel, Meter, Modal, Panel, PlayButton, Segmented, Switch, TimerRing, Toast,
} from '../../components';
import { Section } from './Section';

const label = { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#A9B3CC' } as const;
const row = { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' } as const;

export function ComponentsSection(): JSX.Element {
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<null | 'ok' | 'error'>(null);
  const [sw, setSw] = useState(true);
  const [seg, setSeg] = useState<'low' | 'medium' | 'high'>('medium');
  const [tab, setTab] = useState<'all' | 'owned' | 'locked'>('all');
  const [chip, setChip] = useState<'red' | 'blue'>('red');
  const [pct, setPct] = useState(64);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Section title="Components" note="Shared UI from design/tokens/components.css and the screen mockups.">
      <div style={row}>
        <Button style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Default</Button>
        <Button variant="primary" style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Primary</Button>
        <Button variant="success" style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Success</Button>
        <Button variant="info" style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Info</Button>
        <Button variant="danger" style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Danger</Button>
        <Button disabled style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Disabled</Button>
        <ButtonLink to="#hotseat" style={{ height: 50, padding: '0 20px', fontSize: 17 }}>Link button</ButtonLink>
      </div>
      <div style={{ ...row, alignItems: 'flex-start' }}>
        <div style={{ width: 470 }}><PlayButton title="PLAY NOW" subtitle="Ranked 4v4 · est. queue 0:42" onClick={() => setToast('ok')} icon={
          <svg aria-hidden="true" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#101522" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" fill="#101522" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" /></svg>
        } /></div>
        <FireButton label="FIRE" ready disabled={false} onFire={() => setToast('ok')} />
        <FireButton label="WAIT" ready={false} disabled onFire={() => undefined} />
      </div>
      <div style={{ ...row, alignItems: 'stretch' }}>
        <Panel style={{ width: 300, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>PANEL</span>
          <Switch label="Screen shake" checked={sw} onChange={setSw} />
          <Button variant="primary" onClick={() => setModal(true)} style={{ height: 44 }}>Open modal</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => setToast('ok')} style={{ height: 40, flex: 1 }}>Toast</Button>
            <Button onClick={() => setToast('error')} style={{ height: 40, flex: 1 }}>Error toast</Button>
          </div>
        </Panel>
        <HudPanel label="HUD panel" style={{ width: 340, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>HUD PANEL · METER · TIMER RING</span>
          <Meter pct={pct} color="#5ACB91" label="HP" />
          <Meter pct={pct} color="#F45B55" height={14} />
          <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(+e.target.value)} aria-label="Meter value" />
          <div style={{ display: 'flex', gap: 12 }}><TimerRing seconds={26} total={30} /><TimerRing seconds={9} total={30} /><TimerRing seconds={4} total={30} /></div>
        </HudPanel>
        <Panel style={{ width: 420, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={label}>SEGMENTED · TABS · CHIPS</span>
          <Segmented label="Graphics quality" value={seg} onChange={setSeg} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
          <Segmented kind="tab" label="Filter" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }, { value: 'locked', label: 'Locked' }]} />
          <Segmented kind="chip" label="Team" value={chip} onChange={setChip} options={[{ value: 'red', label: 'Team Red' }, { value: 'blue', label: 'Team Blue' }]} />
        </Panel>
      </div>
      {modal && (
        <Modal label="Example modal" onClose={() => setModal(false)} style={{ width: 520, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>Modal</h2>
            <CloseButton onClick={() => setModal(false)} />
          </div>
          <p style={{ margin: 0, color: '#C9D1E0' }}>Scrim, pop-in, Esc to close, focus trapped inside.</p>
          <Button variant="primary" onClick={() => setModal(false)} style={{ height: 52, fontSize: 18 }}><span className="fd">GOT IT</span></Button>
        </Modal>
      )}
      {toast && <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 0 }}><Toast kind={toast} message={toast === 'ok' ? 'Room code copied' : 'Server rejected: not your turn'} /></div>}
    </Section>
  );
}
