import { defineConfig } from 'vitest/config';
import path from 'path';

const unitTestFiles = [
  'tests/components.test.tsx',
  'tests/github-components.test.tsx',
  'tests/github-setup-banner.test.tsx',
  'tests/github-crypto.test.ts',
  'tests/smoke.test.ts',
  'tests/landing-page.test.tsx',
  'tests/routes-and-auth.test.tsx',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: unitTestFiles,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: unitTestFiles,
          pool: 'forks',
          globalSetup: ['./tests/setup/global-setup.ts'],
          setupFiles: ['./tests/setup/db-worker.ts'],
        },
      },
    ],
  },
});
