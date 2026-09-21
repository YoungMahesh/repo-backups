# 01: Isolated Remote PostgreSQL Test Databases with Template Cloning

**What to build:**
Implement isolated dynamic PostgreSQL database provisioning for parallel integration tests using a dedicated remote server specified by `TEST_DATABASE_SERVER`. In `globalSetup`, the test runner validates server connectivity and permissions (failing fast if inaccessible), executes a pre-flight sweep of orphaned test databases older than 1 hour, provisions a template database (`test_tpl_<timestamp>`), applies Drizzle migrations once, and locks connections. Each integration test suite runs in an isolated child process (`pool: 'forks'`), clones an isolated database (`test_db_<timestamp>_<rand>`) from the template in sub-second time, and injects its dynamic URL into `process.env.DATABASE_URL`. In `afterAll`, the worker drains its connection pool and drops the database with force. `globalTeardown` cleans up the template. Vitest is configured with separated `unit` and `integration` projects, and a `pnpm test:unit` script is added for offline testing.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Administrative database helper (`tests/setup/db-admin.ts`) implements connection resolution, fail-fast accessibility checking, template creation, connection locking (`ALLOW_CONNECTIONS = false`), template cloning, force dropping (`DROP DATABASE ... WITH (FORCE)`), and timestamp-based orphan sweeping.
- [x] Vitest global setup (`tests/setup/global-setup.ts`) connects to `TEST_DATABASE_SERVER`, halts immediately with diagnostic error if inaccessible, executes pre-flight sweep of databases older than 1 hour, provisions template database `test_tpl_<timestamp>`, applies all Drizzle migrations from `./drizzle`, and locks the template database.
- [x] Vitest worker setup (`tests/setup/db-worker.ts`) clones `test_db_<timestamp>_<rand>` from the template, sets `process.env.DATABASE_URL`, drains the connection pool on suite completion (`afterAll`), drops the database, and registers process signal handlers (`SIGINT`/`SIGTERM`) for best-effort cleanup.
- [x] Vitest global teardown cleans up the template database and sweeps any remaining databases.
- [x] Vitest configuration (`vitest.config.mts`) defines `unit` and `integration` workspace projects, using `pool: 'forks'` and `setupFiles` for integration suites.
- [x] `package.json` includes `test:unit` script for offline in-memory test execution.
- [x] Automated harness test (`tests/database-isolation.test.ts`) verifies schema availability, environment variable isolation, pre-flight sweep timestamp parsing, and fail-fast behavior.
- [x] All existing test suites pass cleanly in parallel without cross-test record collisions or connection leaks.
