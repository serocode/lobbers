import { defineConfig } from 'vitest/config';

// `threads`: Colyseus uses process.send() for IPC when it detects a child process, which collides with
// vitest's default `forks` pool messaging.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node', pool: 'threads', testTimeout: 20_000, fileParallelism: false } });
