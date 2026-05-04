import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@tests': path.resolve(__dirname, '__tests__'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    globals: false,
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
