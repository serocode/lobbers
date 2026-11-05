import { MACHINE_LIST, MAP_LIST, WEAPON_LIST, type WeaponIconId } from '@lobbers/shared';
import { MachineArt, SceneBackdrop, WeaponIcon } from '../../components';
import { Section } from './Section';

const ICONS: WeaponIconId[] = ['Explosive', 'Cluster', 'Guided', 'Electric', 'Fire', 'Ice', 'Special', 'Drill', 'Gravity'];
const cell = { background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } as const;
const caption = { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#A9B3CC' } as const;

export function MachinesSection(): JSX.Element {
  return (
    <Section title="MachineArt" note="Machine.dc.html — 8 kinds × red / blue / victory / wreck. Reference: screenshots/c1-machine.png (thumper, red, aim 30, 240 px).">
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div data-kit="c1" style={{ width: 240, height: 200, background: '#FFFFFF', flex: 'none' }}><MachineArt kind="thumper" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 140px)', gap: 10 }}>
          {MACHINE_LIST.map((m) => (
            [
              <div key={`${m.id}-r`} style={cell}><MachineArt kind={m.id} tint="#F45B55" size={120} /><span style={caption}>{m.name.toUpperCase()} · RED</span></div>,
              <div key={`${m.id}-b`} style={cell}><MachineArt kind={m.id} tint="#4C9AFF" size={120} flip /><span style={caption}>BLUE · FLIP</span></div>,
              <div key={`${m.id}-v`} style={cell}><MachineArt kind={m.id} tint="#F45B55" size={120} pose="victory" /><span style={caption}>VICTORY</span></div>,
              <div key={`${m.id}-w`} style={cell}><MachineArt kind={m.id} tint="#8A93A8" size={120} pose="wreck" /><span style={caption}>WRECK</span></div>,
            ]
          ))}
        </div>
      </div>
    </Section>
  );
}

export function WeaponsSection(): JSX.Element {
  return (
    <Section title="WeaponIcon" note="WeaponIcon.dc.html — 9 icons; then the 10 launch weapons in their colours. Reference: screenshots/c2-weapon-icon.png (Explosive, #FFB547, 128 px).">
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div data-kit="c2" style={{ width: 128, height: 128, background: '#FFFFFF', flex: 'none' }}><WeaponIcon icon="Explosive" /></div>
        {ICONS.map((i) => <div key={i} style={cell}><WeaponIcon icon={i} size={72} /><span style={caption}>{i.toUpperCase()}</span></div>)}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {WEAPON_LIST.map((w) => <div key={w.id} style={{ ...cell, width: 120 }}><WeaponIcon icon={w.icon} color={w.color} size={54} /><span style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</span></div>)}
      </div>
    </Section>
  );
}

export function ScenesSection(): JSX.Element {
  return (
    <Section title="SceneBackdrop" note="Scene.dc.html — all 6 maps at 1500 px wide (same framing as screenshots/c3-scene-<map>.png).">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {MAP_LIST.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={caption}>{m.name.toUpperCase()} · {m.width}×{m.height}</span>
            <div data-kit={`c3-${m.id}`} style={{ width: 1500, flex: 'none' }}>
              <SceneBackdrop map={m.id} w={1500} h={Math.round((m.height * 1500) / m.width)} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
