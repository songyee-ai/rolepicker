import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    // 공정성 시뮬레이션은 시드 200개를 돌리므로 기본 5초로는 부족하다
    testTimeout: 30_000,
    include: ['{back,front,shared}/**/*.test.ts'],
  },
});
