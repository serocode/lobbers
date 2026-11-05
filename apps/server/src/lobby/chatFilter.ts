// Chat hygiene hook (docs/NETWORK.md: "chat length 140 and profanity filter hook"). Collapses
// whitespace, strips control characters, caps length and masks a small blocklist. Swap the list or
// plug a real service in here; rooms only call `cleanChat`.
import { ROOM_LIMITS } from '@lobbers/shared';

const BLOCKLIST = ['fuck', 'shit', 'cunt', 'nigger', 'faggot', 'retard', 'bitch'];
const pattern = new RegExp(`\\b(${BLOCKLIST.join('|')})\\w*`, 'gi');

export function cleanChat(raw: string): string {
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ROOM_LIMITS.chatMaxLength);
  return text.replace(pattern, (w) => w[0] + '*'.repeat(Math.max(0, w.length - 1)));
}
