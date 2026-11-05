import type { ReactNode } from 'react';

export function Section({ title, note, children, id }: { title: string; note?: string; children: ReactNode; id?: string }): JSX.Element {
  return (
    <section id={id} aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h2 className="fd" style={{ margin: 0, fontSize: 34 }}>{title}</h2>
        {note && <span style={{ fontSize: 14, color: '#A9B3CC' }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}
