import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.smoke.ts'],
    // Load every variable from .env (no VITE_ prefix filter) into process.env.
    env: loadEnv('', process.cwd(), ''),
    // The invoices endpoint takes 8-14s per 500-row page (measured live
    // 2026-09-21), so a multi-page walk needs well over 30s.
    testTimeout: 120_000,
    // The gateway occasionally drops a connection (transient ECONNRESET);
    // one retry keeps flakes out of the weekly validation while real API
    // drift still fails deterministically.
    retry: 1,
  },
});
