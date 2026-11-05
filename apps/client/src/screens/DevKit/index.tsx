import { MachinesSection, ScenesSection, WeaponsSection } from './ArtSections';
import { ComponentsSection } from './ComponentsSection';
import { HotSeatSection } from './HotSeatSection';

/** /dev/kit — storybook-like page: every shared component and every piece of game art (Phase 0 check). */
export default function DevKit(): JSX.Element {
  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#101522' }}>
      <div style={{ padding: '28px 32px 80px', display: 'flex', flexDirection: 'column', gap: 40, minWidth: 1600 }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 className="fd" style={{ margin: 0, fontSize: 52, letterSpacing: 1 }}><span style={{ color: '#FFD166' }}>LOB</span>BERS <span style={{ fontSize: 30, color: '#A9B3CC' }}>dev kit</span></h1>
          <a href="#hotseat" style={{ fontWeight: 600 }}>Hot-seat match ↓</a>
        </header>
        <ComponentsSection />
        <MachinesSection />
        <WeaponsSection />
        <ScenesSection />
        <HotSeatSection />
      </div>
    </main>
  );
}
