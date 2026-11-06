// Results — ported from design/mockup/Results.dc.html (screenshots/05*.png). Everything shown is the host's
// MatchEndedMsg (computeResults + MatchTally): from the match just played (the room's feed), or the compact
// summary in profile.history on a revisit. Rewards are applied to YOUR local profile with creditMatch
// (idempotent per match id) and the panel animates from what it returned.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MAPS, REWARDS, creditMatch, resultFromHistory, resultScore, type MatchEndedMsg, type PlayerResult } from '@lobbers/shared';
import { Stage } from '../../app/Stage';
import { Button, ErrorRow, MachineArt } from '../../components';
import { codeOfMatch, lobbyService, useLobby } from '../../net/p2p/roomService';
import { useProfile } from '../../state/profile';
import { TEAM_COLOR } from '../../state/matchStore';
import { MatchDetailsModal } from './MatchDetailsModal';
import { ResultsTable } from './ResultsTable';
import s from './results.module.css';

const MODE = { 'team-deathmatch': 'Team Deathmatch', 'capture-the-hill': 'Capture the Hill' } as const;
const BURST = { red: ['#3A1F2C', '#2A1824'], blue: ['#1E2D4E', '#16223C'], draw: ['#262B3D', '#1C2131'] } as const;
const CONF = ['#F45B55', '#4C9AFF', '#FFD166', '#5ACB91', '#FF7EB6', '#F5F1E8'];
const PODIUM = [{ x: 330, b: 130, size: 150, fs: 26, dl: 0 }, { x: 175, b: 100, size: 124, fs: 20, dl: 0.15 }, { x: 485, b: 84, size: 118, fs: 18, dl: 0.22 }, { x: 20, b: 70, size: 110, fs: 18, dl: 0.3 }];

interface Rewards { level: number; xp: number; xpFrom: number; levelsGained: number; xpGained: number; coinsGained: number; rating: number; ratingChange: number }

/** The result (live from the room, or from history) and the rewards it gave this profile. */
function useResult(matchId: string): { result: MatchEndedMsg | null; error: string; rewards: Rewards | null } {
  const [state, set] = useState<{ result: MatchEndedMsg | null; error: string; rewards: Rewards | null }>({ result: null, error: '', rewards: null });
  useEffect(() => {
    const live = lobbyService.client?.ended;
    const profile = useProfile.getState().profile;
    if (!profile) return;
    if (live && live.matchId === matchId) {
      const others = (useLobby.getState().view?.players ?? []).map((p) => ({ id: p.id, name: p.name, level: p.level ?? 1, rating: p.rating ?? 1000, title: p.title ?? null }));
      const out = creditMatch(profile, live, others);
      if (out.credited) useProfile.getState().update(() => out.profile);
      const after = out.credited ? out.profile : profile;
      set({ result: live, error: '', rewards: { level: after.level, xp: after.xp, xpFrom: out.levelsGained ? 0 : profile.xp, levelsGained: out.levelsGained, xpGained: out.xpGained, coinsGained: out.coinsGained, rating: after.rating, ratingChange: out.ratingChange } });
      return;
    }
    const entry = profile.history.find((h) => h.matchId === matchId);
    const past = entry ? resultFromHistory(entry) : null;
    if (!past) { set({ result: null, error: 'This match isn’t in your history on this device.', rewards: null }); return; }
    set({ result: past, error: '', rewards: { level: profile.level, xp: profile.xp, xpFrom: profile.xp, levelsGained: 0, xpGained: entry?.xp ?? 0, coinsGained: entry?.coins ?? 0, rating: profile.rating, ratingChange: 0 } });
  }, [matchId]);
  return state;
}

export default function Results(): JSX.Element {
  const { matchId = '' } = useParams();
  const nav = useNavigate();
  const myId = useProfile((v) => v.profile?.id ?? '');
  const lobby = useLobby((v) => v.view);
  const { result, error, rewards } = useResult(matchId);
  const [details, setDetails] = useState(false);
  const [t, setT] = useState(0);
  const confetti = useMemo(() => { let seed = 3; const rnd = (): number => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; return Array.from({ length: 30 }, (_, i) => ({ x: Math.round(rnd() * 1440), col: CONF[i % 6], d: (4 + rnd() * 4).toFixed(1), dl: (-rnd() * 8).toFixed(1) })); }, []);
  useEffect(() => { const iv = setInterval(() => setT((v) => (v >= 40 ? v : v + 1)), 40); return () => clearInterval(iv); }, []);

  const me = result?.players.find((p) => p.playerId === myId);

  if (!result) {
    return (
      <Stage width={1440} height={900} label="Results">
        <div style={{ width: 1440, height: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#101522', color: '#A9B3CC' }}>
          {error ? <div style={{ width: 520, display: 'flex', flexDirection: 'column', gap: 14 }}><ErrorRow>{error}</ErrorRow><Button onClick={() => nav('/')} style={{ height: 52 }}>Return Home</Button></div> : <span style={{ fontSize: 20, fontWeight: 600 }}>Loading results…</span>}
        </div>
      </Stage>
    );
  }

  const w = result.winner;
  const lost = !!me && w !== 'draw' && w !== me.team;
  const head = w === 'draw' ? 'DRAW' : lost ? 'DEFEAT' : 'VICTORY!';
  const winners = w === 'draw' ? [] : result.players.filter((p) => p.team === w).sort((a, b) => resultScore(b) - resultScore(a));
  const losers = result.players.filter((p) => w === 'draw' || p.team !== w);
  const loserTeam = w === 'draw' ? null : w === 'red' ? 'blue' : 'red';
  const mvp = result.players.find((p) => p.mvp);
  const dur = `${Math.floor(result.durationSec / 60)}:${String(result.durationSec % 60).padStart(2, '0')}`;
  const ease = 1 - Math.pow(1 - Math.min(1, t / 40), 3);
  const xp = { level: rewards?.level ?? 1, xp: rewards?.xp ?? 0, levelsGained: rewards?.levelsGained ?? 0 };
  const need = REWARDS.xpForLevel(xp.level);
  const fromPct = `${(((rewards?.xpFrom ?? 0) / need) * 100).toFixed(1)}%`;
  const inLobby = !!lobby && lobby.phase === 'open' && lobby.code === codeOfMatch(matchId);
  const toLobby = (ready: boolean): void => {
    if (!lobby) return;
    if (ready && !lobby.players.find((p) => p.id === myId)?.isHost) lobbyService.send({ t: 'setReady', ready: true });
    nav(`/lobby/${encodeURIComponent(lobby.code)}`);
  };
  const home = (): void => { void lobbyService.leave(); nav('/'); };

  return (
    <Stage width={1440} height={900} label="Match results">
      <div style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden', background: '#101522', fontFamily: 'Fredoka,system-ui,sans-serif', color: '#F5F1E8' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 900, overflow: 'hidden' }}><div className={s.burst} style={{ position: 'absolute', left: -440, top: -620, width: 1600, height: 1800, background: `repeating-conic-gradient(from 0deg at 50% 60%,${BURST[w][0]} 0deg 10deg,${BURST[w][1]} 10deg 20deg)` }} /></div>
        {!lost && confetti.map((c, i) => <span key={i} className={s.conf} aria-hidden="true" style={{ left: c.x, background: c.col, animationDuration: `${c.d}s`, animationDelay: `${c.dl}s` }} />)}

        <div style={{ position: 'absolute', left: 40, top: 28, width: 660, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <h1 className={`fd ${s.vic}`} style={{ margin: 0, fontSize: 148, lineHeight: 0.9, color: lost ? '#4C9AFF' : '#FFD166', WebkitTextStroke: '10px #0B0F1A', paintOrder: 'stroke fill', textShadow: '0 12px 0 #0B0F1A' }}>{head}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <span className="fd" style={{ background: w === 'draw' ? '#A9B3CC' : TEAM_COLOR[w], color: '#101522', border: '3px solid #0B0F1A', boxShadow: '0 4px 0 #0B0F1A', padding: '4px 16px', fontSize: 24 }}>{w === 'draw' ? 'NO TEAM WINS' : `TEAM ${w.toUpperCase()} WINS`}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{MODE[result.mode]} · {MAPS[result.mapId].name} · {result.turns} turns · <span className="mono">{dur}</span></span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 40, top: 250, width: 660, height: 330 }}>
          <svg aria-hidden="true" width="660" height="140" viewBox="0 0 660 140" style={{ position: 'absolute', left: 0, bottom: 0 }}>
            <g stroke="#0B0F1A" strokeWidth="4" strokeLinejoin="round"><rect x="20" y="70" width="150" height="70" fill="#2E3856" /><rect x="175" y="40" width="150" height="100" fill="#3B4766" /><rect x="330" y="10" width="150" height="130" fill="#FFD166" /><rect x="485" y="56" width="150" height="84" fill="#2E3856" /></g>
            <text x="95" y="118" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="34" fill="#F5F1E8">4</text><text x="250" y="102" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="40" fill="#F5F1E8">2</text>
            <text x="405" y="90" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="56" fill="#101522">1</text><text x="560" y="110" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="36" fill="#F5F1E8">3</text>
          </svg>
          {winners.slice(0, 4).map((p, i) => <PodiumSpot key={p.unitId} p={p} spot={PODIUM[i]} />)}
        </div>

        {mvp && (
          <div className={`panel ${s.rise}`} style={{ position: 'absolute', left: 40, top: 600, width: 660, height: 96, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: '#241F14', animationDelay: '.3s' }}>
            <span className="fd" style={{ background: '#FFD166', color: '#101522', border: '3px solid #0B0F1A', padding: '6px 12px', fontSize: 28, transform: 'rotate(-4deg)' }}>MVP</span>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span className="fd" style={{ fontSize: 28, lineHeight: 1 }}>{mvp.name}</span><span style={{ fontSize: 13, color: '#E6D9B8' }}>{result.mvpHighlight}</span></span>
            <span style={{ display: 'flex', gap: 8 }}>
              {([[mvp.damageDealt.toLocaleString('en-US'), 'DAMAGE'], [String(mvp.eliminations), 'ELIMS'], [`${mvp.accuracy}%`, 'ACCURACY']] as const).map(([v, k]) => (
                <span key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#101522', border: '2px solid #0B0F1A', borderRadius: 8, padding: '4px 10px' }}><span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{v}</span><span style={{ fontSize: 10, fontWeight: 700, color: '#A9B3CC' }}>{k}</span></span>
              ))}
            </span>
          </div>
        )}

        <div className={s.rise} style={{ position: 'absolute', left: 40, top: 712, width: 660, height: 68, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(21,27,43,.9)', border: '3px solid #0B0F1A', borderRadius: 12, padding: '6px 14px', animationDelay: '.45s' }}>
          <span className="fd" style={{ fontSize: 16, color: loserTeam ? TEAM_COLOR[loserTeam] : '#A9B3CC', width: 96, lineHeight: 1.05 }}>{loserTeam ? <>TEAM {loserTeam.toUpperCase()}<br />DEFEATED</> : <>BOTH TEAMS<br />DEFEATED</>}</span>
          {losers.slice(0, 4).map((l) => (
            <span key={l.unitId} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}><span style={{ width: 60, height: 52, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MachineArt kind={l.machine} tint={TEAM_COLOR[l.team]} size={58} pose="wreck" flip={l.team === 'blue'} /></span><span style={{ fontSize: 13, fontWeight: 600, color: '#A9B3CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span></span>
          ))}
        </div>

        <ResultsTable players={result.players} myId={myId} />

        <section aria-label="Your rewards" className={`panel ${s.rise}`} style={{ position: 'absolute', left: 724, top: 596, width: 692, height: 184, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '.35s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><h2 className="fd" style={{ margin: 0, fontSize: 24 }}>Your Rewards</h2><span style={{ fontSize: 13, color: '#A9B3CC' }}>Win bonus ×{REWARDS.winMultiplier} · MVP bonus +{REWARDS.mvpBonusXp} XP</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`fd ${xp.levelsGained ? s.levelUp : ''}`} style={{ background: '#FFD166', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 8px', fontSize: 16 }}>LV {xp.level}</span>
            <span style={{ flex: 1, height: 20, border: '3px solid #0B0F1A', borderRadius: 10, background: '#0E1320', overflow: 'hidden', display: 'block', position: 'relative' }}>
              <span className={s.xp} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((xp.xp / need) * 100).toFixed(1)}%`, background: '#5ACB91', ['--xp-from' as string]: fromPct }} />
            </span>
            <span className="mono" style={{ fontSize: 14, width: 130, textAlign: 'right' }}>{Math.round((rewards?.xpFrom ?? 0) + (xp.xp - (rewards?.xpFrom ?? 0)) * ease).toLocaleString('en-US')} / {need.toLocaleString('en-US')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
            <div style={{ background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1 }}>EXPERIENCE</span><span className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#5ACB91' }}>+{Math.round((rewards?.xpGained ?? me?.xp ?? 0) * ease)}</span></div>
            <div style={{ background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1 }}>COINS</span><span className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#FFD166' }}>+{Math.round((rewards?.coinsGained ?? me?.coins ?? 0) * ease)}</span></div>
            <div style={{ background: '#1C2338', border: '3px solid #0B0F1A', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#A9B3CC', letterSpacing: 1 }}>RATING</span><span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{(rewards?.rating ?? 1000).toLocaleString('en-US')} <span style={{ fontSize: 14, color: (rewards?.ratingChange ?? 0) >= 0 ? '#5ACB91' : '#F45B55' }}>{(rewards?.ratingChange ?? 0) >= 0 ? '+' : ''}{rewards?.ratingChange ?? 0}</span></span></div>
          </div>
        </section>

        <footer style={{ position: 'absolute', left: 40, top: 804, width: 1376, height: 72, display: 'flex', gap: 14, alignItems: 'center' }}>
          <Button className="dark" disabled={!inLobby} title={inLobby ? 'Back to your room, ready for the next match' : 'The room has closed'} onClick={() => toLobby(true)} style={{ height: 68, padding: '0 34px', background: '#FFD166', fontSize: 26 }}><span className="fd">PLAY AGAIN</span></Button>
          <Button disabled={!inLobby} title={inLobby ? undefined : 'The room has closed'} onClick={() => toLobby(false)} style={{ height: 60, padding: '0 22px', fontSize: 17 }}>Return to Lobby</Button>
          <Button onClick={home} style={{ height: 60, padding: '0 22px', fontSize: 17 }}>Return Home</Button>
          <div style={{ flex: 1 }} />
          <Link to="/profile" className="btn" style={{ height: 60, padding: '0 22px', fontSize: 17 }}>My Profile</Link>
          <Button onClick={() => setDetails(true)} style={{ height: 60, padding: '0 22px', fontSize: 17, background: '#2E3856' }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>View Match Details</Button>
        </footer>
        {details && <MatchDetailsModal details={result.details} onClose={() => setDetails(false)} />}
      </div>
    </Stage>
  );
}

function PodiumSpot({ p, spot }: { p: PlayerResult; spot: (typeof PODIUM)[number] }): JSX.Element {
  return (
    <div style={{ position: 'absolute', left: spot.x, bottom: spot.b, width: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {p.mvp && <svg aria-label="MVP" role="img" width="56" height="40" viewBox="0 0 18 14" className={s.jump} style={{ animationDelay: '.1s' }}><path d="M1 12 L2 3 L6 7 L9 1 L12 7 L16 3 L17 12 Z" fill="#FFD166" stroke="#0B0F1A" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
      <span className="fd" style={{ fontSize: spot.fs, WebkitTextStroke: '4px #0B0F1A', paintOrder: 'stroke fill', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
      <div className={s.jump} style={{ animationDelay: `${spot.dl}s` }}><MachineArt kind={p.machine} tint={TEAM_COLOR[p.team]} size={spot.size} pose={p.survived ? 'victory' : 'wreck'} flip={p.team === 'blue'} /></div>
    </div>
  );
}
