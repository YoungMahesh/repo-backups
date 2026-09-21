import { describe, it, expect } from 'vitest';
import { db } from '@/db';
import { user, githubInstallations, backupJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  extractTimestampFromDbName,
  checkServerAccess,
  parseServerUrl,
} from './setup/db-admin';

describe('Isolated Remote PostgreSQL Test Harness', () => {
  it('assigns a unique, dynamic isolated database URL to this worker process', () => {
    const dbUrl = process.env.DATABASE_URL;
    expect(dbUrl).toBeDefined();

    const url = new URL(dbUrl!);
    const dbName = url.pathname.replace(/^\//, '');

    // Database name must follow test_db_<timestamp>_<rand>
    expect(dbName).toMatch(/^test_db_\d+_[a-z0-9]+$/);

    const timestamp = extractTimestampFromDbName(dbName);
    expect(timestamp).not.toBeNull();
    // Timestamp must be recent (within the last 10 minutes)
    expect(Date.now() - timestamp!).toBeLessThan(10 * 60 * 1000);
  });

  it('proves Drizzle schema migrations are fully applied and operable in the cloned database', async () => {
    const testUserId = `isolation-test-user-${Date.now()}`;
    const testEmail = `user-${Date.now()}@example.com`;

    // 1. Insert into migrated user table
    const [inserted] = await db
      .insert(user)
      .values({
        id: testUserId,
        name: 'Harness User',
        email: testEmail,
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBe(testUserId);
    expect(inserted.email).toBe(testEmail);

    // 2. Query back to verify persistence in this isolated database
    const [found] = await db
      .select()
      .from(user)
      .where(eq(user.id, testUserId));
    expect(found).toBeDefined();
    expect(found?.id).toBe(testUserId);

    // 3. Verify other migrated tables (githubInstallations, backupJobs) are accessible
    const installations = await db.select().from(githubInstallations);
    expect(Array.isArray(installations)).toBe(true);

    const jobs = await db.select().from(backupJobs);
    expect(Array.isArray(jobs)).toBe(true);
  });

  describe('Pre-flight sweep timestamp parsing', () => {
    it('accurately parses timestamps from test_db and test_tpl patterns', () => {
      const ts = 1790000000000;
      expect(extractTimestampFromDbName(`test_db_${ts}_abc123`)).toBe(ts);
      expect(extractTimestampFromDbName(`test_tpl_${ts}_xyz`)).toBe(ts);
      expect(extractTimestampFromDbName(`test_db_${ts}`)).toBe(ts);
    });

    it('returns null for non-test or non-timestamped databases to prevent accidental purging', () => {
      expect(extractTimestampFromDbName('postgres')).toBeNull();
      expect(extractTimestampFromDbName('production')).toBeNull();
      expect(extractTimestampFromDbName('test_db_invalid_name')).toBeNull();
      expect(extractTimestampFromDbName('my_test_db')).toBeNull();
    });
  });

  describe('Administrative fail-fast server accessibility checks', () => {
    it('correctly resolves administrative postgres URLs with query parameters preserved', () => {
      const server = 'postgresql://user:pass@example.com:5432?sslmode=require';
      const resolved = parseServerUrl(server, 'postgres');
      expect(resolved).toBe('postgresql://user:pass@example.com:5432/postgres?sslmode=require');

      const cloneUrl = parseServerUrl(server, 'test_db_123');
      expect(cloneUrl).toBe('postgresql://user:pass@example.com:5432/test_db_123?sslmode=require');
    });

    it('fails fast when attempting to connect to an unreachable server address', async () => {
      const badServer = 'postgresql://invalid_user:invalid_pass@127.0.0.1:59999/postgres';
      await expect(checkServerAccess(badServer)).rejects.toThrow(/Cannot access TEST_DATABASE_SERVER/);
    });

    it('fails fast when TEST_DATABASE_SERVER is empty or missing', async () => {
      await expect(checkServerAccess('')).rejects.toThrow(/TEST_DATABASE_SERVER is not defined/);
    });
  });
});
