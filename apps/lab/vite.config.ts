import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`../../packages/rosee/src/${p}`, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // Develop against the library source; the package ships dist.
    alias: [
      { find: /^rosee\/gl$/, replacement: src('gl/index.ts') },
      { find: /^rosee$/, replacement: src('index.ts') },
    ],
  },
  server: { host: '::', port: 5197 },
  test: { include: ['src/**/*.test.ts'] },
});
