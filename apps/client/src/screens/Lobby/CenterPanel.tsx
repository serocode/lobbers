// Centre column (Lobby.dc.html): map preview with ◀ ▶ (host), map info, six setting buttons, chat.
import { useState } from 'react';
import { MAP_LIST, MAPS, type LobbyView } from '@lobbers/shared';
import { SceneBackdrop } from '../../components';
import { lobbyService } from '../../net/online/lobbyService';
import { TEAM_COLOR } from '../../state/matchStore';
import { settingButtons } from './settingsView';
import s from './lobby.module.css';

const HOST_ONLY = 'Only the host can change this';
const Lock = (): JSX.Element => <svg aria-label="Host only" role="img" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A9B3CC" strokeWidth="3" strokeLinecap="round" style={{ position: 'absolute', right: 8, top: 8 }}><rect x="5" y="11" width="14" height="10" rx="2" fill="#A9B3CC" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;

export function CenterPanel({ view, isHost, myId }: { view: LobbyView; isHost: boolean; myId: string }): JSX.Element {
  const [draft, setDraft] = useState('');
  const map = MAPS[view.settings.mapId];
  const idx = MAP_LIST.findIndex((m) => m.id === map.id);
  const changeMap = (d: number): void => lobbyService.send({ t: 'updateSettings', patch: { mapId: MAP_LIST[(idx + d + MAP_LIST.length) % MAP_LIST.length].id } });
  const send = (text: string): void => { const t = text.trim(); if (!t) return; lobbyService.send({ t: 'chat', text: t }); setDraft(''); };
  const chat = view.chat.slice(-4);
  const colOf = (c: LobbyView['chat'][number]): string => (c.team === 'system' ? '#5ACB91' : c.playerId === myId ? '#FFD166' : TEAM_COLOR[c.team]);
  return (
    <div style={{ position: 'absolute', left: 444, top: 104, width: 552, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel" style={{ position: 'relative', height: 286, overflow: 'hidden', padding: 0 }}>
        <div key={map.id} className={s.join} style={{ position: 'absolute', inset: 0 }}><SceneBackdrop map={map.id} w={546} h={280} /></div>
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 8 }}>
          <span className="fd" style={{ background: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, padding: '4px 10px', fontSize: 15, color: '#FFD166' }}>MAP {idx + 1} / {MAP_LIST.length}</span>
          <span className="fd" style={{ background: '#101522', border: '3px solid #0B0F1A', borderRadius: 8, padding: '4px 10px', fontSize: 15 }}>{map.sizeLabel}</span>
        </div>
        <div className="fd" style={{ position: 'absolute', left: 226, top: 110, width: 100, height: 64, background: '#FFD166', color: '#101522', border: '4px solid #0B0F1A', boxShadow: '0 5px 0 #0B0F1A', fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-6deg)', clipPath: 'polygon(8% 0,100% 0,92% 100%,0 100%)' }}>VS</div>
        <button type="button" className="btn" aria-label="Previous map" disabled={!isHost} title={isHost ? undefined : HOST_ONLY} onClick={() => changeMap(-1)} style={{ position: 'absolute', left: 10, bottom: 12, width: 44, height: 44 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
        <button type="button" className="btn" aria-label="Next map" disabled={!isHost} title={isHost ? undefined : HOST_ONLY} onClick={() => changeMap(1)} style={{ position: 'absolute', right: 10, bottom: 12, width: 44, height: 44 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 30, lineHeight: 1 }}>{map.name}</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#C9D1E0', lineHeight: 1.4 }}>{map.description}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
        {settingButtons(view.settings).map((o) => {
          const blocked = !isHost || !o.next;
          return (
            <button key={o.key} type="button" className={`btn ${s.setb}`} disabled={!!isHost && !o.next} aria-disabled={blocked} title={!isHost ? HOST_ONLY : o.reason ?? 'Host: click to change'}
              onClick={() => { if (isHost && o.next) lobbyService.send({ t: 'updateSettings', patch: o.next }); }} style={!isHost ? { cursor: 'default' } : undefined}>
              <span style={{ fontSize: 11, color: '#A9B3CC', letterSpacing: 1.4, fontWeight: 700 }}>{o.label}</span><span style={{ fontSize: 16 }}>{o.value}</span>
              {!isHost && <Lock />}
            </button>
          );
        })}
      </div>
      <div className="panel" style={{ height: 166, display: 'flex', flexDirection: 'column', padding: 10, gap: 8 }}>
        <div aria-live="polite" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, overflow: 'hidden', fontSize: 14 }}>
          {chat.map((c) => <div key={c.id} className={s.msg}><span style={{ fontWeight: 700, color: colOf(c) }}>{c.team === 'system' ? 'SYSTEM' : c.name}:</span> <span style={{ color: '#E6E2D8' }}>{c.text}</span></div>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label htmlFor="chatIn" style={{ position: 'absolute', left: -9999 }}>Lobby chat message</label>
          <input id="chatIn" className={s.inp} placeholder="Say something to the lobby…" value={draft} maxLength={140} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(draft); }} />
          <button type="button" className="btn" onClick={() => send(draft)} style={{ height: 42, padding: '0 14px', fontSize: 14 }}>Send</button>
          <button type="button" className="btn" onClick={() => send('gl hf everyone!')} style={{ height: 42, padding: '0 12px', fontSize: 14 }}>gl hf</button>
        </div>
      </div>
    </div>
  );
}
