import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // design/tokens/tokens.css @imports @fontsource/*; resolve those from this package.
      '@fontsource': here('./node_modules/@fontsource'),
      '@design': here('../../design'),
    },
  },
  // Pre-bundle up front so Vite never re-optimises mid-session (avoids duplicate React instances).
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'zustand', 'zustand/vanilla', 'phaser'] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // Output at the repo root (`dist/`): that is where Vercel looks by default for a repo-root project, so the deploy works
  // with or without vercel.json / dashboard overrides (DECISIONS, deploy).
  build: { outDir: here('../../dist'), emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
