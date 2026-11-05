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
  build: { chunkSizeWarningLimit: 1600 },
});
