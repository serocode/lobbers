// App-wide audio: unlock on the first gesture, menu vs battle music by route, UI click sounds.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { installAudioUnlock } from '../audio/engine';
import { playMusic } from '../audio/music';
import { sfx } from '../audio/sfx';

let installed = false;

export function AudioDirector(): null {
  const loc = useLocation();
  useEffect(() => {
    if (installed) return;
    installed = true;
    installAudioUnlock();
    document.addEventListener('click', (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, a.btn') : null;
      if (el && !(el as HTMLButtonElement).disabled) sfx.click();
    }, true);
  }, []);
  useEffect(() => {
    const battle = loc.pathname.startsWith('/match/') || loc.pathname === '/hotseat';
    playMusic(loc.pathname.startsWith('/dev/') ? null : battle ? 'battle' : 'menu');
  }, [loc.pathname]);
  return null;
}
