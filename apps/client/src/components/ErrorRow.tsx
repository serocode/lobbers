// Inline error row in the panel style (DESIGN_SPEC §3.8: "Server errors on REST → inline error row").
import type { ReactNode } from 'react';
import { ErrorIcon } from './icons';

export function ErrorRow({ children, action }: { children: ReactNode; action?: ReactNode }): JSX.Element {
  return (
    <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#3A2230', border: '2px solid #0B0F1A', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontWeight: 600, color: '#F5F1E8' }}>
      <ErrorIcon /><span style={{ flex: 1 }}>{children}</span>{action}
    </div>
  );
}
