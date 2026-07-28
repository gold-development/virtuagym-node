import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.smoke.ts'],
    // Load every variable from .env (no VITE_ prefix filter) into process.env.
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 30_000,
  },
});
