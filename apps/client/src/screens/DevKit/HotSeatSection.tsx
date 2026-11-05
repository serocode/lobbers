import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MACHINE_LIST, MAP_LIST, ROOM_LIMITS, SETTING_OPTIONS, type MachineId, type TeamId } from '@lobbers/shared';
import { Button, ChevronLeft, ChevronRight, MachineArt, Panel, Segmented, SceneBackdrop } from '../../components';
import { DEFAULT_LOCAL, encodeLocalConfig, type LocalMatchConfig } from '../../state/localMatchConfig';
import { PRESETS, PRESET_IDS, type PresetId } from '../../state/cosmeticPresets';
import { Section } from './Section';

const TEAM = { red: { col: '#F45B55', dark: '#3A2230', name: 'TEAM RED' }, blue: { col: '#4C9AFF', dark: '#1E2D4E', name: 'TEAM BLUE' } } as const;
const ids = MACHINE_LIST.map((m) => m.id);
const cycle = (id: MachineId, d: 1 | -1): MachineId => ids[(ids.indexOf(id) + d + ids.length) % ids.length];

function TeamPicker({ team, list, onChange }: { team: TeamId; list: MachineId[]; onChange: (l: MachineId[]) => void }): JSX.Element {
  const t = TEAM[team];
  const set = (i: number, id: MachineId): void => onChange(list.map((m, k) => (k === i ? id : m)));
  return (
    <Panel style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} label={t.name}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="fd" style={{ background: t.col, color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '1px 10px', fontSize: 16 }}>{t.name}</span>
        <span className="mono" style={{ fontSize: 13 }}>{list.length}/{ROOM_LIMITS.maxPerTeam}</span>
        <span style={{ flex: 1 }} />
        <Button aria-label={`Remove a ${team} player`} disabled={list.length <= 1} onClick={() => onChange(list.slice(0, -1))} style={{ width: 36, height: 32 }}>−</Button>
        <Button aria-label={`Add a ${team} player`} disabled={list.length >= ROOM_LIMITS.maxPerTeam} onClick={() => onChange([...list, ids[(list.length * 3 + (team === 'red' ? 0 : 4)) % ids.length]])} style={{ width: 36, height: 32 }}>+</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        {list.map((id, i) => (
          <div key={i} style={{ background: t.dark, border: '2px solid #0B0F1A', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <MachineArt kind={id} tint={t.col} size={84} flip={team === 'blue'} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Button aria-label={`Previous machine for ${team} ${i + 1}`} onClick={() => set(i, cycle(id, -1))} style={{ width: 28, height: 26 }}><ChevronLeft size={11} /></Button>
              <span style={{ fontSize: 12, fontWeight: 700, width: 66, textAlign: 'center' }}>{MACHINE_LIST.find((m) => m.id === id)?.name}</span>
              <Button aria-label={`Next machine for ${team} ${i + 1}`} onClick={() => set(i, cycle(id, 1))} style={{ width: 28, height: 26 }}><ChevronRight size={11} /></Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Dev harness for Phase 1: start a hot-seat match on one screen (all players local). */
export function HotSeatSection(): JSX.Element {
  const nav = useNavigate();
  const [c, setC] = useState<LocalMatchConfig>(DEFAULT_LOCAL);
  const patch = (p: Partial<LocalMatchConfig>): void => setC((x) => ({ ...x, ...p }));
  return (
    <Section id="hotseat" title="Hot-seat match" note="Phase 1 harness — every player on one screen; controls only work for the active machine. Phase 2 replaces this with the real lobby.">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {MAP_LIST.map((m) => (
          <button key={m.id} type="button" className="btn" aria-pressed={c.mapId === m.id} onClick={() => patch({ mapId: m.id })}
            style={{ padding: 4, flexDirection: 'column', gap: 4, background: c.mapId === m.id ? '#2A2A1E' : '#1C2338', borderColor: c.mapId === m.id ? '#FFD166' : '#0B0F1A' }}>
            <SceneBackdrop map={m.id} w={220} h={110} />
            <span style={{ fontSize: 13 }}>{m.name}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <TeamPicker team="red" list={c.red} onChange={(red) => patch({ red })} />
        <TeamPicker team="blue" list={c.blue} onChange={(blue) => patch({ blue })} />
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['red', 'blue'] as const).map((t) => (
          <label key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>{t.toUpperCase()} COSMETICS
            <select aria-label={`${t} cosmetics`} data-testid={`look-${t}`} value={c.look[t]} onChange={(e) => patch({ look: { ...c.look, [t]: e.target.value as PresetId } })}
              style={{ height: 36, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 8, color: '#F5F1E8', padding: '0 8px', fontFamily: 'Fredoka,sans-serif' }}>
              {PRESET_IDS.map((id) => <option key={id} value={id}>{PRESETS[id].label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>TURN TIMER</span>
        <Segmented kind="chip" label="Turn timer" value={String(c.turnSeconds)} onChange={(v) => patch({ turnSeconds: Number(v) as LocalMatchConfig['turnSeconds'] })}
          options={SETTING_OPTIONS.turnSeconds.map((s) => ({ value: String(s), label: `${s}s` }))} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>WIND</span>
        <Segmented kind="chip" label="Wind" value={c.wind} onChange={(wind) => patch({ wind })} options={SETTING_OPTIONS.wind.map((w) => ({ value: w, label: w[0].toUpperCase() + w.slice(1) }))} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>ITEMS</span>
        <Segmented kind="chip" label="Items" value={c.itemsEnabled ? 'on' : 'off'} onChange={(v) => patch({ itemsEnabled: v === 'on' })} options={[{ value: 'on', label: 'On (all 10)' }, { value: 'off', label: 'Off (loadout)' }]} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#A9B3CC' }}>SEED</span>
        <input className="mono" aria-label="Seed" type="number" min={1} value={c.seed} onChange={(e) => patch({ seed: Math.max(1, Math.floor(+e.target.value || 1)) })}
          style={{ width: 110, height: 36, background: '#0E1320', border: '3px solid #0B0F1A', borderRadius: 8, color: '#F5F1E8', padding: '0 8px' }} />
        <span style={{ flex: 1 }} />
        <Button variant="primary" data-testid="start-hotseat" onClick={() => nav(encodeLocalConfig(c))} style={{ height: 56, padding: '0 30px', fontSize: 22 }}><span className="fd">START HOT-SEAT</span></Button>
      </div>
    </Section>
  );
}
