import { Client } from 'pg';

export function parseServerUrl(serverUrl: string, dbName: string = 'postgres'): string {
  try {
    const url = new URL(serverUrl);
    url.pathname = `/${dbName}`;
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid TEST_DATABASE_SERVER URL: ${serverUrl} (${error instanceof Error ? error.message : String(error)})`);
  }
}

export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export async function checkServerAccess(serverUrl: string): Promise<{ user: string; canCreateDb: boolean }> {
  if (!serverUrl) {
    throw new Error(
      'TEST_DATABASE_SERVER is not defined. Integration testing immediately halts. Please configure TEST_DATABASE_SERVER in .env.'
    );
  }

  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query<{ current_user: string; rolcreatedb: boolean; rolsuper: boolean }>(
      'SELECT current_user, rolcreatedb, rolsuper FROM pg_roles WHERE rolname = current_user'
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Could not inspect current PostgreSQL user permissions on ${adminUrl}`);
    }

    const canCreateDb = Boolean(row.rolcreatedb || row.rolsuper);
    if (!canCreateDb) {
      throw new Error(
        `User "${row.current_user}" on TEST_DATABASE_SERVER lacks permission to CREATE DATABASE (rolcreatedb: false, rolsuper: false).`
      );
    }

    return { user: row.current_user, canCreateDb };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot access TEST_DATABASE_SERVER at "${adminUrl}": ${message}. Integration testing immediately halts.`
    );
  } finally {
    await client.end().catch(() => {});
  }
}

export async function createTemplateDatabase(serverUrl: string, templateName: string): Promise<string> {
  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query(`CREATE DATABASE ${escapeIdentifier(templateName)}`);
    return parseServerUrl(serverUrl, templateName);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function lockTemplateDatabase(serverUrl: string, templateName: string): Promise<void> {
  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query(`ALTER DATABASE ${escapeIdentifier(templateName)} WITH ALLOW_CONNECTIONS false`);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function cloneDatabaseFromTemplate(
  serverUrl: string,
  templateName: string,
  cloneName: string
): Promise<string> {
  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query(
      `CREATE DATABASE ${escapeIdentifier(cloneName)} TEMPLATE ${escapeIdentifier(templateName)}`
    );
    return parseServerUrl(serverUrl, cloneName);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function dropDatabaseForce(serverUrl: string, dbName: string): Promise<void> {
  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)} WITH (FORCE)`);
  } finally {
    await client.end().catch(() => {});
  }
}

export interface OrphanSweepResult {
  swept: string[];
  skipped: string[];
}

export function extractTimestampFromDbName(dbName: string): number | null {
  const match = dbName.match(/^test_(?:db|tpl)_(\d+)(?:_.*)?$/);
  if (!match) return null;
  const timestamp = parseInt(match[1], 10);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function sweepOrphanedTestDatabases(
  serverUrl: string,
  maxAgeMs: number = 3600 * 1000
): Promise<OrphanSweepResult> {
  const adminUrl = parseServerUrl(serverUrl, 'postgres');
  const client = new Client({ connectionString: adminUrl });
  const swept: string[] = [];
  const skipped: string[] = [];

  try {
    await client.connect();
    const res = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE 'test_db_%' OR datname LIKE 'test_tpl_%'"
    );

    const now = Date.now();
    for (const row of res.rows) {
      const dbName = row.datname;
      const timestamp = extractTimestampFromDbName(dbName);
      if (timestamp !== null && now - timestamp > maxAgeMs) {
        try {
          await client.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)} WITH (FORCE)`);
          swept.push(dbName);
        } catch (dropErr) {
          console.warn(`[db-admin] Failed to drop orphaned database "${dbName}":`, dropErr);
        }
      } else {
        skipped.push(dbName);
      }
    }

    return { swept, skipped };
  } finally {
    await client.end().catch(() => {});
  }
}
