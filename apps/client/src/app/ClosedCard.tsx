// DESIGN_SPEC §3.8: every way a room can end for you → one card in the modal style with "Back to Home".
// Rendered over any screen (lobby, battle, results) as soon as the room reports a close reason.
import { useNavigate } from 'react-router-dom';
import { Button, Panel } from '../components';
import { closedText, lobbyService, useLobby } from '../net/p2p/roomService';

export function ClosedCard(): JSX.Element | null {
  const nav = useNavigate();
  const reason = useLobby((v) => v.closedReason);
  if (!reason) return null;
  const home = (): void => { lobbyService.clearClosed(); void lobbyService.leave(); nav('/'); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,20,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }} role="alertdialog" aria-label={closedText(reason)}>
      <Panel className="modal" style={{ width: 440, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <h2 className="fd" data-testid="closed-reason" style={{ margin: 0, fontSize: 32 }}>{closedText(reason)}</h2>
        <Button variant="primary" onClick={home} style={{ height: 52, padding: '0 26px', fontSize: 18 }}><span className="fd">BACK TO HOME</span></Button>
      </Panel>
    </div>
  );
}
