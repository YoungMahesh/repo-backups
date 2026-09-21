# 0007: Isolated Remote PostgreSQL Test Databases with Template Cloning

## Status
accepted

## Context and Decision
Integration tests require an authentic PostgreSQL environment matching production schema and constraints without polluting development data or causing concurrency collisions during parallel test runs.

We decided to use a dedicated remote PostgreSQL server specified by `TEST_DATABASE_SERVER`. In `globalSetup`, a template database is provisioned and migrated once, then locked against new connections. Parallel test suites run in separate child processes (`pool: 'forks'`) where each suite clones an isolated database via PostgreSQL `TEMPLATE` cloning (~550ms vs ~3.8s for fresh network migrations) and injects its dynamic URL into `process.env.DATABASE_URL`. Databases are gracefully drained and dropped in `afterAll`, with pre-flight sweeps purging orphaned databases older than 1 hour. Integration test runs halt immediately if `TEST_DATABASE_SERVER` cannot be accessed.

## Consequences
- Integration tests execute with 100% Postgres schema fidelity and zero cross-suite data interference.
- Unit and UI component tests run in-memory without remote database provisioning overhead.
- Template cloning minimizes remote DDL round-trips from ~40s cumulative to sub-second per suite.
- Orphaned databases from interrupted test runs are automatically swept up in `globalSetup` and `globalTeardown`.
