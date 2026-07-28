import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Smoke tests only run locally against the live API.
      exclude: ['src/**/*.spec.ts', 'src/**/*.smoke.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
    },
  },
});
