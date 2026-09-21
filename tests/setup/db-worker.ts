import { afterAll } from 'vitest';
import {
  cloneDatabaseFromTemplate,
  dropDatabaseForce,
} from './db-admin';

const serverUrl = process.env.TEST_DATABASE_SERVER;
const templateName = process.env.TEST_TEMPLATE_DB_NAME;

if (!serverUrl) {
  throw new Error(
    '[db-worker] TEST_DATABASE_SERVER is missing from environment. Integration tests require TEST_DATABASE_SERVER.'
  );
}

if (!templateName) {
  throw new Error(
    '[db-worker] TEST_TEMPLATE_DB_NAME is missing from environment. Global setup must run before integration workers.'
  );
}

// 1. Generate unique suite database name with timestamp and random string
const workerDbName = `test_db_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// 2. Clone from template database via top-level await before test file imports
const workerDbUrl = await cloneDatabaseFromTemplate(serverUrl, templateName, workerDbName);

// 3. Inject DATABASE_URL into process.env for this worker process
process.env.DATABASE_URL = workerDbUrl;

// 4. Register process termination cleanup handlers for aborted runs
let isCleanedUp = false;
const cleanupDatabase = async () => {
  if (isCleanedUp) return;
  isCleanedUp = true;
  try {
    const { db } = await import('@/db');
    if (db?.$client && typeof db.$client.end === 'function') {
      await db.$client.end().catch(() => {});
    }
  } catch {}

  await dropDatabaseForce(serverUrl, workerDbName).catch(() => {});
};

process.on('SIGINT', cleanupDatabase);
process.on('SIGTERM', cleanupDatabase);

// 5. Register afterAll hook to drain connection pool and drop the isolated suite database
afterAll(async () => {
  await cleanupDatabase();
});
