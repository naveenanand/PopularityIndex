import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'packages/scoring/vitest.config.ts',
    test: {
      name: '@pai/scoring',
      root: 'packages/scoring',
      include: ['src/**/__tests__/**/*.test.ts'],
    },
  },
]);
