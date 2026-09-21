import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  checkServerAccess,
  createTemplateDatabase,
  lockTemplateDatabase,
  dropDatabaseForce,
  sweepOrphanedTestDatabases,
} from './db-admin';

let activeTemplateName: string | null = null;
let activeServerUrl: string | null = null;

export async function setup(): Promise<void> {
  const serverUrl = process.env.TEST_DATABASE_SERVER;

  if (!serverUrl) {
    const errorMsg =
      '\n============================================================\n' +
      '[TEST DATABASE ERROR] TEST_DATABASE_SERVER environment variable is not defined.\n' +
      'Integration testing immediately halts.\n' +
      'Please set TEST_DATABASE_SERVER in your .env or run unit tests with `pnpm test:unit`.\n' +
      '============================================================\n';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  activeServerUrl = serverUrl;

  try {
    // 1. Validate connectivity and CREATEDB permissions
    console.log('[TEST DATABASE] Validating TEST_DATABASE_SERVER connectivity and permissions...');
    await checkServerAccess(serverUrl);
    console.log('[TEST DATABASE] Connected to TEST_DATABASE_SERVER with CREATEDB permissions.');

    // 2. Pre-flight sweep for orphaned test databases older than 1 hour (3600 * 1000 ms)
    console.log('[TEST DATABASE] Performing pre-flight sweep for orphaned test databases (>1 hour old)...');
    const sweepResult = await sweepOrphanedTestDatabases(serverUrl, 3600 * 1000);
    if (sweepResult.swept.length > 0) {
      console.log(`[TEST DATABASE] Purged ${sweepResult.swept.length} orphaned test database(s):`, sweepResult.swept);
    } else {
      console.log('[TEST DATABASE] Pre-flight sweep complete. No stale databases found.');
    }

    // 3. Create template database and apply migrations once
    const templateName = `test_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    activeTemplateName = templateName;
    console.log(`[TEST DATABASE] Creating template database "${templateName}"...`);
    const templateUrl = await createTemplateDatabase(serverUrl, templateName);

    console.log(`[TEST DATABASE] Applying Drizzle migrations from ./drizzle to "${templateName}"...`);
    const templateDb = drizzle(templateUrl);
    await migrate(templateDb, { migrationsFolder: './drizzle' });
    await templateDb.$client.end();
    console.log(`[TEST DATABASE] Drizzle migrations applied successfully to "${templateName}".`);

    // 4. Lock template database so parallel forks can clone via TEMPLATE without connection collisions
    await lockTemplateDatabase(serverUrl, templateName);
    console.log(`[TEST DATABASE] Template database "${templateName}" locked for parallel cloning.`);

    // 5. Expose template name in environment for forked child processes
    process.env.TEST_TEMPLATE_DB_NAME = templateName;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorBanner =
      '\n============================================================\n' +
      `[TEST DATABASE HALT] TEST_DATABASE_SERVER error: ${message}\n` +
      'Integration testing immediately halts.\n' +
      '============================================================\n';
    console.error(errorBanner);

    // Clean up template if partially created
    if (activeTemplateName && serverUrl) {
      await dropDatabaseForce(serverUrl, activeTemplateName).catch(() => {});
    }

    throw new Error(errorBanner);
  }
}

export async function teardown(): Promise<void> {
  const serverUrl = activeServerUrl || process.env.TEST_DATABASE_SERVER;
  const templateName = activeTemplateName || process.env.TEST_TEMPLATE_DB_NAME;

  if (serverUrl && templateName) {
    console.log(`[TEST DATABASE] Tearing down template database "${templateName}"...`);
    try {
      await dropDatabaseForce(serverUrl, templateName);
      console.log(`[TEST DATABASE] Template database "${templateName}" successfully dropped.`);
    } catch (err) {
      console.warn(`[TEST DATABASE] Failed to drop template database "${templateName}":`, err);
    }
  }
}
