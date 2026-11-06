// Desktop battle HUD (Battle.dc.html, 1440×900): everything around and over the 1440×750 field.
import { FireButton, PauseIcon } from '../../components';
import { unitOf } from '../../state/matchStore';
import { useBattleUi } from '../../state/uiStores';
import { useBattle, useCanControl, useMatch } from '../BattleContext';
import { BattleToast, ElimRibbon, HurtVignette, TurnBanner } from '../Overlays';
import { EmoteWheel } from '../EmoteWheel';
import { AngleDial, Abilities, PowerMeter, WindGauge } from './DeckRight';
import { PlayerCard, WeaponBlock } from './DeckLeft';
import { CameraButtons, CombatLog, EdgeMarker, KillFeed, LogToggle, Minimap, minimapHeight } from './FieldHud';
import { ArmoryModal, PauseMenu, VictoryOverlay } from './Modals';
import { TeamPanel, TurnPanel } from './TopPanels';

function WaitChip(): JSX.Element | null {
  const mine = useCanControl();
  const over = useMatch((v) => !!v.result);
  const act = useMatch((v) => unitOf(v, v.activeUnitId));
  const phase = useMatch((v) => v.sync.phase);
  const replaying = useMatch((v) => v.replaying);
  const paused = useMatch((v) => v.sync.paused);
  if (mine) return null;
  const txt = paused ? 'Host reconnecting…' : over ? 'Match over' : !act ? 'Get ready…' : phase === 'resolving' || replaying ? 'Shot in flight…' : `${act.name} is taking their turn…`;
  return <div className="fd" style={{ position: 'absolute', left: '50%', top: -20, transform: 'translateX(-50%)', background: '#101522', border: '3px solid #0B0F1A', borderRadius: 10, padding: '4px 16px', fontSize: 18, color: '#C9D1E0', zIndex: 3, whiteSpace: 'nowrap' }}>{txt}</div>;
}

function Deck(): JSX.Element {
  const { controls } = useBattle();
  const mine = useCanControl();
  const phase = useMatch((v) => v.sync.phase);
  return (
    <section aria-label="Combat controls" style={{ position: 'absolute', left: 0, top: 750, width: 1440, height: 150, background: '#151B2B', borderTop: '4px solid #0B0F1A', boxShadow: 'inset 0 3px 0 rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' }}>
      <WaitChip />
      <PlayerCard />
      <WeaponBlock />
      <AngleDial />
      <PowerMeter />
      <WindGauge />
      <Abilities />
      <FireButton label={mine ? 'FIRE' : phase === 'resolving' ? '...' : 'WAIT'} ready={mine} disabled={!mine} onFire={() => controls.fire()} />
    </section>
  );
}

export function DesktopHud(): JSX.Element {
  const mapId = useMatch((v) => v.mapId);
  const pause = (): void => useBattleUi.getState().set({ paused: true });
  return (
    <>
      <EdgeMarker fieldW={1440} fieldH={750} />
      <HurtVignette />
      <button type="button" className="btn" aria-label="Pause menu" onClick={pause} style={{ position: 'absolute', left: 14, top: 14, width: 52, height: 52 }}><PauseIcon /></button>
      <TeamPanel team="red" />
      <TurnPanel />
      <TeamPanel team="blue" />
      <Minimap />
      <LogToggle />
      <KillFeed top={120 + minimapHeight(mapId) + 16} />
      <CombatLog />
      <CameraButtons />
      <TurnBanner width={1440} top={280} />
      <ElimRibbon width={1440} top={400} />
      <Deck />
      <BattleToast bottom={170} />
      <ArmoryModal />
      <EmoteWheel layout="desktop" />
      <PauseMenu />
      <VictoryOverlay />
    </>
  );
}
