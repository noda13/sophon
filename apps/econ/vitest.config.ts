import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'frontend/src/**/*.test.ts', 'frontend/*.test.ts', 'backend/src/**/*.test.ts'],
  },
});
