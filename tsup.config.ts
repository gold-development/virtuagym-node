import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'models/index': 'src/models/index.ts',
    'client/index': 'src/client/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  treeshake: true,
});
