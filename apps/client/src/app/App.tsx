import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AudioDirector } from './AudioDirector';
import { ClosedCard } from './ClosedCard';
import { MobileFullscreen } from './MobileFullscreen';
import { NetworkWatcher } from './NetworkWatcher';

const Home = lazy(() => import('../screens/Home'));
const Lobby = lazy(() => import('../screens/Lobby'));
const Machines = lazy(() => import('../screens/Machines'));
const NetMatch = lazy(() => import('../screens/Battle/NetMatchRoute'));
const Results = lazy(() => import('../screens/Results'));
const DevKit = lazy(() => import('../screens/DevKit'));
const LocalMatch = lazy(() => import('../screens/Battle/LocalMatchRoute'));
const Inventory = lazy(() => import('../screens/Inventory'));
const Profile = lazy(() => import('../screens/Profile'));
const Friends = lazy(() => import('../screens/Friends'));

export function App(): JSX.Element {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NetworkWatcher />
      <AudioDirector />
      <ClosedCard />
      <MobileFullscreen />
      <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#101522' }} />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/lobby/:code/machine" element={<Machines />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/hotseat" element={<LocalMatch />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/match/:matchId" element={<NetMatch />} />
          <Route path="/results/:matchId" element={<Results />} />
          <Route path="/dev/kit" element={<DevKit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
