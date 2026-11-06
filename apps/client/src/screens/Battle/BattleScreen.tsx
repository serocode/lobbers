// The battlefield screen: picks the desktop / tablet / phone layout, scales its artboard to the window,
// mounts the Phaser canvas in the field rect and the React HUD over it. Transport-agnostic.
import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { MatchStartedMsg } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { Panel } from '../../components';
import { LAYOUTS, pickLayout, type LayoutId } from '../../game/layouts';
import { BattleProvider, useBattle, type BattleCtx } from '../../hud/BattleContext';
import { useFpsProbe } from '../../hud/Overlays';
import { DesktopHud } from '../../hud/desktop/DesktopHud';
import { PhoneHud } from '../../hud/phone/PhoneHud';
import { TabletHud } from '../../hud/tablet/TabletHud';
import { useBattleKeys } from '../../hud/useBattleKeys';
import { useBattleUi } from '../../state/uiStores';
import { createBattleAudio } from '../../audio/battleAudio';
import { sfx } from '../../audio/sfx';

function useViewport(): { w: number; h: number } {
  const [s, set] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = (): void => set({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

function Field({ layout, start }: { layout: LayoutId; start: MatchStartedMsg }): JSX.Element {
  const { match, controls } = useBattle();
  const host = useRef<HTMLDivElement>(null);
  const L = LAYOUTS[layout];
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let game: Phaser.Game | null = null, cancelled = false;
    const stageScale = el.getBoundingClientRect().width / L.field.w || 1;
    void import('../../game/PhaserHost').then(({ mountBattle }) => mountBattle(el, { match, controls, start, layout: L, stageScale })).then((g) => {
      if (cancelled) g.destroy(true); else { game = g; match.transport.ready(); }
    });
    const ro = new ResizeObserver(() => game?.scale.refresh());
    ro.observe(el);
    return () => { cancelled = true; ro.disconnect(); game?.destroy(true); };
  }, [match, controls, start, L]);
  return <div ref={host} data-testid="battlefield" style={{ position: 'absolute', left: L.field.x, top: L.field.y, width: L.field.w, height: L.field.h, overflow: 'hidden', background: '#101522', touchAction: 'none' }} />;
}

function RotateCard(): JSX.Element {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101522', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Panel style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
        <span className="fd" style={{ fontSize: 30 }}>ROTATE YOUR PHONE</span>
        <span style={{ color: '#C9D1E0', fontWeight: 600 }}>Lobbers plays in landscape.</span>
      </Panel>
    </div>
  );
}

function Battle(): JSX.Element {
  const { match } = useBattle();
  const vp = useViewport();
  const [start, setStart] = useState<MatchStartedMsg | null>(null);
  useEffect(() => match.onStarted(setStart), [match]);
  useEffect(() => {
    const off = match.addPresenter(createBattleAudio(match));
    const offEmote = match.store.subscribe((s, p) => { if (s.emotes.length && s.emotes !== p.emotes) sfx.emote(); });
    return () => { off(); offEmote(); };
  }, [match]);
  useEffect(() => () => useBattleUi.getState().reset(), []);
  useBattleKeys();
  useFpsProbe();
  const layout = pickLayout(vp.w, vp.h);
  if (layout === 'phone' && vp.h > vp.w) return <RotateCard />;
  const L = LAYOUTS[layout];
  return (
    <Stage width={L.stage.w} height={L.stage.h} fit="contain" label="Battlefield. Arrow keys aim and move, Q and E change power, Space fires, W armory, F focus camera, Z overview. Drag the field to look around.">
      <div className="root" style={{ width: L.stage.w, height: L.stage.h, position: 'relative', overflow: 'hidden', background: '#101522', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        {start && <Field key={layout} layout={layout} start={start} />}
        {layout === 'desktop' && <DesktopHud />}
        {layout === 'tablet' && <TabletHud />}
        {layout === 'phone' && <PhoneHud />}
      </div>
    </Stage>
  );
}

export function BattleScreen({ value }: { value: BattleCtx }): JSX.Element {
  return <BattleProvider value={value}><Battle /></BattleProvider>;
}
