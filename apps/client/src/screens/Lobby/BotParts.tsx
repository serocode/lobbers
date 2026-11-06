// Bot seats in the lobby (DESIGN_SPEC §3.11): the host's open slot gains an "Add bot" button; bot slots show a
// BOT tag and a difficulty pill (host clicks it to cycle Easy → Normal → Hard).
import { BOT_DIFFICULTIES, BOT_LABEL, type BotDifficulty, type LobbyPlayer, type TeamId } from '@lobbers/shared';
import { lobbyService } from '../../net/p2p/roomService';
import s from './lobby.module.css';

const PILL = { fontSize: 13, border: '2px solid #0B0F1A', borderRadius: 6, padding: '2px 6px' } as const;

export const nextDifficulty = (d: BotDifficulty): BotDifficulty => BOT_DIFFICULTIES[(BOT_DIFFICULTIES.indexOf(d) + 1) % BOT_DIFFICULTIES.length];

/** Small chip-head glyph in the mockup's stroke style (used on the Add bot button). */
const BotGlyph = (): JSX.Element => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9 14h.01M15 14h.01" />
  </svg>
);

/** Empty seat. Everyone can invite; the host can also fill it with a bot (Normal; cycle on the slot). */
export function OpenSlot({ team, isHost, onInvite }: { team: TeamId; isHost: boolean; onInvite: () => void }): JSX.Element {
  const invite = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', border: '3px dashed #5B6378', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFD166" strokeWidth="3.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}><span className="fd" style={{ fontSize: 20, color: '#F5F1E8' }}>Open slot</span><span style={{ fontSize: 14 }}>{isHost ? 'Invite a friend or add a bot' : 'Click to invite a friend'}</span></span>
    </span>
  );
  const base = { width: '100%', height: 136, borderRadius: 12, color: '#A9B3CC', fontFamily: 'Fredoka,sans-serif', display: 'flex', alignItems: 'center' } as const;
  if (!isHost) return <button type="button" className={s.dash} onClick={onInvite} style={{ ...base, cursor: 'pointer', justifyContent: 'center', gap: 16 }}>{invite}</button>;
  return (
    <div className={s.dash} style={{ ...base, padding: '0 16px 0 0', gap: 8 }}>
      <button type="button" onClick={onInvite} aria-label="Open slot — invite a friend" style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{invite}</button>
      <button type="button" className="btn" data-testid={`add-bot-${team}`} onClick={() => lobbyService.send({ t: 'addBot', team, difficulty: 'normal' })}
        style={{ height: 40, padding: '0 14px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BotGlyph /><span className="fd">Add bot</span>
      </button>
    </div>
  );
}

/** "BOT" tag next to the name (where YOU sits for your own slot). */
export const BotTag = (): JSX.Element => (
  <span className="fd" style={{ fontSize: 13, background: '#A9B3CC', color: '#101522', border: '2px solid #0B0F1A', borderRadius: 6, padding: '0 6px' }}>BOT</span>
);

/** Replaces the LV pill on a bot slot. The host cycles the difficulty by clicking it. */
export function DifficultyPill({ p, isHost }: { p: LobbyPlayer; isHost: boolean }): JSX.Element {
  const d = p.bot ?? 'normal';
  const label = BOT_LABEL[d].toUpperCase();
  if (!isHost) return <span className="fd" style={{ ...PILL, background: '#0E1320' }}>{label}</span>;
  return (
    <button type="button" className="btn fd" data-testid={`bot-difficulty-${p.id}`} title="Change difficulty" aria-label={`${p.name} difficulty ${BOT_LABEL[d]} — change`}
      onClick={() => lobbyService.send({ t: 'setBot', playerId: p.id, difficulty: nextDifficulty(d) })} style={{ ...PILL, height: 'auto', background: '#0E1320', cursor: 'pointer' }}>
      {label}
    </button>
  );
}
