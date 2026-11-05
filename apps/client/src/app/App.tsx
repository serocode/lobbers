import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

const DevKit = lazy(() => import('../screens/DevKit'));
const LocalMatch = lazy(() => import('../screens/Battle/LocalMatchRoute'));

export function App(): JSX.Element {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#101522' }} />}>
        <Routes>
          {/* Home (Main.dc.html) is ported in Phase 2; until then the app opens on the component kit. */}
          <Route path="/" element={<Navigate to="/dev/kit" replace />} />
          <Route path="/dev/kit" element={<DevKit />} />
          <Route path="/match/local" element={<LocalMatch />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
