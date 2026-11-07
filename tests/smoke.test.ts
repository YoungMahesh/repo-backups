import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { user } from '@/db/schema';
import {
  executeGitCloneAndBundle,
  setMockGitRunner,
} from '@/lib/backup/engine';

describe('vitest setup', () => {
  it('runs tests and verifies assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves @/ path aliases correctly', () => {
    expect(user).toBeDefined();
  });
});

describe('executeGitCloneAndBundle environment and temp dir configuration', () => {
  afterEach(() => {
    setMockGitRunner(null);
    delete process.env.BACKUP_TEMP_DIR;
  });

  it('uses BACKUP_TEMP_DIR when provided', async () => {
    const customTempBase = path.join(os.tmpdir(), `custom-test-backup-${Date.now()}`);
    process.env.BACKUP_TEMP_DIR = customTempBase;

    setMockGitRunner({
      runBundle: async () => ({
        commitSha: 'mock-sha-1234',
        bundleSizeBytes: 24,
        bundleContent: Buffer.from('mock-bundle-binary-bytes'),
      }),
    });

    const result = await executeGitCloneAndBundle('owner/repo', 'token123');
    try {
      expect(result.commitSha).toBe('mock-sha-1234');
      expect(result.bundleSizeBytes).toBe(24);
      expect(result.bundlePath.startsWith(customTempBase)).toBe(true);
      expect(fs.existsSync(result.bundlePath)).toBe(true);
    } finally {
      await result.cleanup();
      await fs.promises.rm(customTempBase, { recursive: true, force: true }).catch(() => {});
    }

    expect(fs.existsSync(result.bundlePath)).toBe(false);
  });
});
