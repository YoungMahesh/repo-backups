# Spec: Isolated Remote PostgreSQL Test Databases with Template Cloning

Status: ready-for-agent

## Problem Statement

Developers and automated CI pipelines running integration tests currently execute queries directly against the live development database (Neon PostgreSQL) specified in the main environment configuration. This shared state creates severe risks and operational friction:

1. **Data Corruption and Cross-Test Interference**: Parallel integration tests insert, mutate, and delete records (such as fixed test user IDs, GitHub installations, and backup jobs). When tests run concurrently or developers run tests while running the local web application, operations collide on unique constraints, causing false test failures, race conditions, and corrupted application state.
2. **Teardown Hazards**: Tests executing cleanup queries (`DELETE FROM ...` or `TRUNCATE`) risk wiping active local development data if connected to a non-isolated database.
3. **Execution Latency & Network Overhead**: Applying migrations from scratch across the network for every test run or test suite is prohibitively slow, taking several seconds per database and consuming remote database resources.
4. **Offline and Unreachable Server Brittleness**: When developers work offline or when the remote test database is unreachable, integration tests hang or emit confusing cascade errors instead of failing fast with clear diagnostic messages.

Engineers need a reliable, fully isolated testing architecture where every test suite runs against its own authentic PostgreSQL database, provisions rapidly without redundant migrations, cleans up automatically, and strictly isolates environment variables across concurrent processes.

## Solution

A dedicated remote PostgreSQL test architecture utilizing template database cloning and Vitest process-level fork isolation:

1. **Dedicated Test Database Server**: Tests connect to a dedicated remote PostgreSQL server specified by `TEST_DATABASE_SERVER` rather than sharing development or production instances.
2. **One-Time Template Provisioning via Global Setup**: Before test workers start, Vitest's global setup script validates server connectivity and permissions, creates a timestamped template database (`test_tpl_<timestamp>`), programmatically applies all Drizzle migrations once, closes all active connections, and sets `ALLOW_CONNECTIONS = false` on the template to prevent session lock conflicts.
3. **Sub-Second Suite-Level Database Cloning**: Integration test suites execute in isolated child processes (`pool: 'forks'`). Each test suite dynamically clones an isolated database (`test_db_<timestamp>_<rand>`) from the pre-migrated template in ~500ms using PostgreSQL's native `CREATE DATABASE ... TEMPLATE` mechanism, and injects its dedicated connection string into `process.env.DATABASE_URL` prior to suite execution.
4. **Graceful Teardown and Resource Cleanup**: At the end of each test suite (`afterAll`), the worker gracefully drains its connection pool before the administrative connection executes `DROP DATABASE ... WITH (FORCE)`. Worker signal handlers (`SIGINT`, `SIGTERM`) ensure best-effort cleanup on aborted runs.
5. **Automated Orphan Sweep**: Global setup performs a pre-flight sweep querying `pg_database` for any legacy test or template databases older than 1 hour (parsing timestamps from database names) and purges them with force. Global teardown cleans up the template database and any remaining test databases created during the run.
6. **Strict Fail-Fast Enforcement**: If `TEST_DATABASE_SERVER` is missing or inaccessible when running integration tests, execution immediately halts with an actionable diagnostic message and non-zero exit code.
7. **Test Tier Separation**: Vitest workspace projects cleanly separate in-memory unit/UI component tests from remote database integration tests, complemented by an offline `pnpm test:unit` script.

## User Stories

1. As a software engineer running integration tests, I want each test suite to execute against an isolated PostgreSQL database, so that test suites running in parallel never collide on unique constraints or shared rows.
2. As a software engineer, I want test suites to run against a real PostgreSQL 18 server matching production dialect and constraints, so that tests validate authentic database behaviors rather than in-memory mocks.
3. As a developer running the local development server, I want test runs to use `TEST_DATABASE_SERVER` instead of `DATABASE_URL`, so that running tests never mutates, corrupts, or truncates my local development data.
4. As a test runner executing in parallel with `pool: 'forks'`, I want each child process to have its own `process.env.DATABASE_URL`, so that concurrent workers never accidentally point to the same database.
5. As a developer waiting for test runs to complete, I want database provisioning to use template cloning rather than running migrations repeatedly, so that database initialization completes in hundreds of milliseconds rather than several seconds per suite.
6. As an automated test runner, I want `globalSetup` to create and migrate a template database once per test run, so that network DDL overhead is minimized across the entire test execution.
7. As a test harness, I want `globalSetup` to lock the template database with `ALLOW_CONNECTIONS = false` after migrations finish, so that child worker processes can clone from it simultaneously without hitting PostgreSQL session lock errors.
8. As a developer writing tests, I want my existing test files and assertions to work transparently without modifying their database imports or adding manual clone/drop boilerplate in every file.
9. As a test harness, I want the worker teardown hook to drain and close the connection pool before issuing `DROP DATABASE ... WITH (FORCE)`, so that test output remains free of unhandled connection reset and socket error notices.
10. As a developer running tests in terminal, I want the test database to be dropped automatically when all tests in a file complete, so that server storage is immediately reclaimed.
11. As a developer who aborts a test run midway using `Ctrl+C` (SIGINT), I want worker signal handlers to perform best-effort cleanup of the active test database, so that aborted runs leave fewer orphaned databases.
12. As an infrastructure administrator, I want `globalSetup` to run a pre-flight sweep purging all orphaned test databases older than 1 hour, so that aborted or crashed test runs never permanently leak storage on the remote server.
13. As a test runner, I want `globalTeardown` to drop the template database and perform a post-flight cleanup, so that successful test runs leave zero residual databases on the server.
14. As a developer running tests without network connectivity or with an invalid `TEST_DATABASE_SERVER`, I want the test command to halt immediately with an explicit, readable error message, so that I am not left waiting on socket timeouts or confusing cascade failures.
15. As a developer working offline on UI components or cryptographic utilities, I want a `pnpm test:unit` script that runs pure unit and component tests without requiring `TEST_DATABASE_SERVER` or network access.
16. As a developer running `pnpm test`, I want Vitest to automatically route pure unit tests to run in-memory while routing route, webhook, and disconnection tests to isolated database forks.
17. As a maintainer reviewing pull requests, I want parallel CI jobs to generate unique database names using timestamps and random suffixes, so that concurrent CI runs on the same remote server never collide with each other.
18. As a new team member exploring the repository, I want clear architectural documentation in `docs/adr/0007-isolated-remote-postgres-test-databases.md`, so that I understand why the testing database environment is designed with remote template cloning.

## Implementation Decisions

### Test Harness Modules and Lifecycle Boundaries

- **Database Test Administrator Module**:
  - Exposes administrative utilities to connect to the maintenance database (`postgres`) on `TEST_DATABASE_SERVER`.
  - Implements connectivity validation, `CREATEDB` permission checking, template creation, template locking, template cloning, database dropping with force, and age-based orphan scanning.
  - Automatically normalizes the server connection URL, appending the maintenance database path while preserving query parameters and SSL configuration.
- **Global Setup (`globalSetup`)**:
  - Verifies presence of `TEST_DATABASE_SERVER` and validates server connectivity/permissions. If the check fails, prints a descriptive error and throws to halt test execution immediately.
  - Executes the pre-flight sweep: queries `pg_database` for databases matching `test_db_%` and `test_tpl_%`, parses the epoch timestamp from the name, and drops any database older than 3600 seconds (1 hour) using `DROP DATABASE ... WITH (FORCE)`.
  - Creates the template database `test_tpl_<timestamp>`, applies all Drizzle migrations from `./drizzle` programmatically via Drizzle's Node-Postgres migrator, closes the migration client, and executes `ALTER DATABASE ... WITH ALLOW_CONNECTIONS false`.
  - Stores the template database name in process environment so forked worker processes inherit it.
- **Worker Setup (`setupFiles`)**:
  - Executes in each forked child process before test files are evaluated.
  - Generates a unique suite database name: `test_db_<timestamp>_<random>`.
  - Issues `CREATE DATABASE "test_db_..." TEMPLATE "test_tpl_..."` via an administrative connection.
  - Injects `process.env.DATABASE_URL` pointing to the newly cloned database.
  - Registers an `afterAll` hook: gracefully drains the database connection pool (`await db.$client.end()`), then drops the suite database with force via the administrative connection.
  - Registers `process.on('SIGINT')` and `process.on('SIGTERM')` handlers to attempt best-effort cleanup if the process is terminated abruptly.
- **Global Teardown (`globalTeardown`)**:
  - Drops the template database `test_tpl_<timestamp>` with force.
  - Performs a final sweep for any orphaned databases created during the current run.

### Vitest Configuration & Project Separation

- Vitest configuration defines two workspace projects:
  - **Unit Project**: Matches frontend components (`**/*.test.tsx` except installation disconnection), cryptographic utilities (`github-crypto.test.ts`), and baseline smoke checks (`smoke.test.ts`). Runs in-memory with standard module execution without remote database setup.
  - **Integration Project**: Matches database-dependent suites (route handlers, webhooks, cron, and installation disconnection). Configured with `pool: 'forks'`, `setupFiles` pointing to the worker database harness, and global setup/teardown hooks.
- Adds `test:unit` script to `package.json` (`dotenvx run -- vitest run --project unit`) for fast offline test execution.

### Architectural Decision Record

- Context, rationale, and consequences recorded in `docs/adr/0007-isolated-remote-postgres-test-databases.md`.

## Testing Decisions

### What Makes a Good Test for Testing Infrastructure
A good test for the test database harness verifies observable system behaviors rather than internal implementation details:
- It verifies that database queries actually persist and read data from the isolated database.
- It verifies that environment variable `DATABASE_URL` is set to the dynamic database name and not the fallback development database.
- It verifies that concurrent test suites running identical fixture keys (e.g. `TEST_USER_ID`) do not conflict with or observe data from parallel suites.
- It verifies that missing or invalid server configurations halt the runner with exit code 1.
- It verifies that legacy orphaned databases are identified and swept correctly based on age thresholds without deleting active databases.

### Modules Tested
- **Test Database Harness**: Integration test suite verifying dynamic database creation, template cloning, migration fidelity, connection pool drainage, drop behavior, and pre-flight age-filtering logic.
- **Existing Integration Test Suites**: All existing route, webhook, cron, and disconnection suites must pass cleanly without code modifications to their assertions or imports.

### Prior Art in Codebase
- Existing test suites in `tests/` (`github-webhook.test.ts`, `backup-routes.test.ts`, `cron-and-retention.test.ts`, `installation-disconnection.test.tsx`) which perform end-to-end integration tests using Drizzle ORM and Next.js route handlers.

## Out of Scope

- Local Docker container orchestration (e.g. running a local Docker PostgreSQL container during tests).
- Mock database engines or SQLite/PGlite in-memory compatibility drivers.
- Application schema changes or Drizzle migration alterations.
- Modifying test assertion logic or business logic within existing test files.

## Further Notes

- Documented in [ADR 0007](docs/adr/0007-isolated-remote-postgres-test-databases.md).
- Benchmarked performance on `13.140.190.128`: ~550ms per database creation via template cloning vs ~3.83s for fresh migrations across the network.
