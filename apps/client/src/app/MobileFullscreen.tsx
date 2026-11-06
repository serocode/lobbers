// Phones lose ~50 px of a ~360 px landscape viewport to the browser bar. On touch devices the first tap asks for
// fullscreen (+ landscape lock where supported). Once per page load, so exiting fullscreen sticks; silently does
// nothing where the Fullscreen API is missing (iPhone Safari) or refused. DECISIONS: phone sizing.
import { useEffect } from 'react';

interface LockableOrientation { lock?: (o: 'landscape') => Promise<void> }

export function MobileFullscreen(): null {
  useEffect(() => {
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    if (!coarse || !document.fullscreenEnabled) return;
    const onFirstTap = (): void => {
      window.removeEventListener('pointerup', onFirstTap, true);
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as unknown as LockableOrientation).lock?.('landscape'))
        .catch(() => undefined);
    };
    window.addEventListener('pointerup', onFirstTap, true);
    return () => window.removeEventListener('pointerup', onFirstTap, true);
  }, []);
  return null;
}
