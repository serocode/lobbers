// Keyboard (Battle.dc.html onKey + DESIGN_SPEC): ↑/↓ angle, ←/→ move (hold), Q/E power, Space fire,
// W armory, 1–4 quick slots, J jump, F focus, Z overview, Esc pause / close.
import { useEffect } from 'react';
import { cameraBus } from '../state/cameraBus';
import { useBattleUi } from '../state/uiStores';
import { useBattle } from './BattleContext';

const typing = (t: EventTarget | null): boolean => t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox';

export function useBattleKeys(): void {
  const { controls, match } = useBattle();
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const ui = useBattleUi.getState();
      const k = e.key;
      if (k === 'Escape') { if (ui.armoryOpen) ui.set({ armoryOpen: false }); else if (!match.store.getState().result) ui.set({ paused: !ui.paused, confirmLeave: false }); return; }
      if (ui.paused || match.store.getState().result) return;
      if (k === 'w' || k === 'W') { ui.set({ armoryOpen: !ui.armoryOpen }); return; }
      if (k === 'f' || k === 'F') { cameraBus.command({ t: 'focusActive' }); return; }
      if (k === 'z' || k === 'Z') { cameraBus.command({ t: 'toggleOverview' }); return; }
      if (ui.armoryOpen || !controls.enabled) return;
      switch (k) {
        case 'ArrowUp': e.preventDefault(); controls.nudgeElevation(1); break;
        case 'ArrowDown': e.preventDefault(); controls.nudgeElevation(-1); break;
        case 'ArrowLeft': e.preventDefault(); if (!e.repeat) controls.startMove(-1); break;
        case 'ArrowRight': e.preventDefault(); if (!e.repeat) controls.startMove(1); break;
        case 'q': case 'Q': controls.nudgePower(-2); break;
        case 'e': case 'E': controls.nudgePower(2); break;
        case 'j': case 'J': controls.jump(); break;
        case ' ': e.preventDefault(); if (!e.repeat) controls.fire(); break;
        default: if (k >= '1' && k <= '4') controls.quickSlot(+k - 1);
      }
    };
    const up = (e: KeyboardEvent): void => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') controls.stopMove(); };
    const blur = (): void => controls.stopMove();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [controls, match]);
}
