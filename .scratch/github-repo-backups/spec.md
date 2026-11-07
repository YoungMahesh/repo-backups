# Spec: GitHub Organization Repository Backup Platform

Status: ready-for-agent

## Problem Statement

Engineering teams and organizations rely heavily on GitHub to host their core intellectual property, configurations, and documentation. However, relying solely on GitHub introduces a single point of failure: accidental deletions, account suspensions, organization compromise, rogue credentials, or platform outages can jeopardize access to source code.

Existing backup solutions often demand broad, intrusive administrative permissions across an entire GitHub account or organization, violating the principle of least privilege. Furthermore, many tools only export flat zip snapshots of the default branch, throwing away commit logs, branches, tags, and cryptographic signatures required to restore an operational git repository.

Users need a simple, trusted platform that requests strictly read-only access to specifically selected organization repositories, regularly creates immutable, self-contained Git bundles, securely stores them in isolated S3 storage, and provides effortless restoration instructions.

## Solution

A repository backup platform where authenticated users connect their GitHub organizations via a fine-grained GitHub App, granting read-only access strictly to specific repositories of their choice.

Once connected, the platform inventories available repositories and allows users to enroll repositories for automated or manual backups. The platform runs scheduled and on-demand Backup Jobs that generate standalone Git bundles (`.bundle`), complete with all branches, commits, and tags. These bundles are streamed to dedicated S3 storage with server-side encryption at rest, governed by a rolling retention window that prunes older archives automatically. Users can monitor backup statuses in a unified warm-canvas dashboard, download backups via temporary pre-signed S3 links, and view exact one-line restoration instructions for disaster recovery.

## User Stories

1. As a user, I want to authenticate into the platform using email and password, so that my repository connections and backups remain private to my account.
2. As an organization administrator, I want to click a "Connect GitHub Organization" button, so that I can initiate the GitHub App installation flow on GitHub.
3. As an organization administrator, I want GitHub to let me choose "Only select repositories" during the app installation, so that our platform never receives access to unselected repositories.
4. As an organization administrator, I want the platform to only request read-only permissions (`Contents: read`, `Metadata: read`), so that my organization's code is secure against unauthorized modifications.
5. As a user, I want to be redirected back to the platform dashboard after completing the GitHub App installation, so that I immediately see my connected organization.
6. As a user, I want the connection callback to be cryptographically validated with a signed state parameter, so that my account cannot be linked to malicious third-party installations.
7. As a user, I want to see a clear inventory of all repositories authorized by my GitHub App Installation, so that I know exactly which codebases the platform can back up.
8. As a user, I want to see repository metadata (repository name, organization name, private/public visibility, default branch), so that I can easily identify each codebase.
9. As a user, I want to explicitly enroll a repository by toggling "Enable Backup", so that only the repositories I designate consume storage resources.
10. As a user, I want to configure the backup schedule per Enrolled Repository (Daily, Weekly, or Manual only), so that critical repositories are backed up more frequently than low-priority ones.
11. As a user, I want to click "Backup Now" on any Enrolled Repository, so that I can trigger an immediate on-demand Backup Job without waiting for the scheduled window.
12. As a user, I want to click a "Sync from GitHub" button on my connected Installation, so that recently granted or revoked repositories are reflected immediately in my inventory.
13. As a user, I want incoming GitHub webhooks (`installation_repositories` added/removed) to automatically update the available repository inventory in real time, so that changes on GitHub sync without manual effort.
14. As a user, I want scheduled Backup Jobs to run automatically via a secure cron trigger, so that my repository backups occur reliably in the background.
15. As a developer running the platform locally, I want an in-process timer runner, so that scheduled backups execute during local testing without requiring external cron infrastructure.
16. As a user, I want each Backup Job to generate a complete Git bundle (`.bundle`), so that 100% of my branches, commit histories, and tags are preserved intact.
17. As an operator, I want Backup Bundles to be streamed directly to S3 storage with server-side AES-256 encryption (`SSE-S3`), so that data is secure at rest.
18. As an operator, I want the platform to auto-create the dedicated S3 backup bucket on startup if it does not already exist, so that initial setup requires no manual cloud console intervention.
19. As a user, I want Backup Jobs to automatically retry up to 2 times if a transient network glitch or rate limit occurs, so that temporary hiccups do not cause false alarms.
20. As a user, I want to see the status of each Backup Job (Pending, Running, Success, Failed) clearly indicated on my dashboard, so that I have complete visibility into backup health.
21. As a user, I want failed Backup Jobs to record actionable error details and present a "Retry Backup" button, so that I can diagnose and remediate issues quickly.
22. As a user, I want each Enrolled Repository to enforce a rolling Retention Window (keeping the 10 most recent successful Backup Bundles), so that historical recovery points are available without unbounded storage consumption.
23. As an operator, I want expired Backup Bundles beyond the Retention Window to be pruned immediately from S3 and marked in the database post-backup, so that storage limits are strictly maintained.
24. As a user, I want to click on a repository to open a slide-over Backup History drawer, so that I can inspect all past Backup Bundles with their timestamps, commit SHAs, and file sizes.
25. As a user, I want to click "Download" on any completed Backup Bundle to receive a 15-minute temporary pre-signed S3 URL, so that I can download the bundle directly from storage without loading the application server.
26. As a user, I want to view a Restoration Guide modal showing the exact one-line command (`git clone <bundle-file> <target-folder>`), so that I can instantly restore a full working git repository during an emergency.
27. As a user, I want the entire user interface to adhere strictly to the warm-canvas editorial design system (cream canvas `#faf9f5`, serif typography, warm coral CTAs, dark product cards), so that the platform feels exceptionally polished, trustworthy, and pleasant to use.
28. As an administrator, I want to see a clear setup banner if GitHub App environment variables are not yet configured in `.env`, so that I know what credentials are required to activate GitHub connectivity.

## Implementation Decisions

### Core Modules & Architecture

1. **GitHub Integration Module**:
   - Manages GitHub App authentication using JSON Web Tokens (JWT) signed with the App's private key.
   - Generates short-lived GitHub Installation Access Tokens with scoped read-only repository permissions.
   - Handles the OAuth installation callback, decoding and validating HMAC-signed state parameters to correlate installations to the logged-in user.
   - Implements a webhook receiver verifying HMAC-SHA256 signatures (`X-Hub-Signature-256`) to handle repository grant and revocation events (`installation_repositories`).
   - Implements on-demand synchronization to pull the latest repository inventory via the GitHub App REST API (`GET /installation/repositories`).

2. **Backup Execution Engine Module**:
   - Executes git operations in isolated temporary directories: initiates an authenticated bare mirror clone (`git clone --mirror`) using the short-lived installation token.
   - Creates a complete, self-contained Git bundle via `git bundle create <path> --all`.
   - Extracts the latest commit SHA and bundle file size.
   - Streams the bundle to S3 storage with SSE-S3 encryption and cleans up temporary local files.
   - Enforces an automated retry policy with exponential backoff (up to 2 retries) before recording job failure.

3. **Storage & Retention Module**:
   - Interfaces with AWS S3-compatible storage via `@aws-sdk/client-s3`.
   - Auto-checks and provisions the configured backup bucket on initialization.
   - Stores backup bundles under structured namespaced keys: `backups/{userId}/{owner}/{repo}/{timestamp}-{commitSha}.bundle`.
   - Generates 15-minute pre-signed download URLs via `@aws-sdk/s3-request-presigner`.
   - Executes inline retention pruning post-backup, deleting oldest excess S3 objects when the bundle count for an Enrolled Repository exceeds 10.

4. **Scheduling & Cron Module**:
   - Exposes a protected Next.js API route (`GET /api/cron/backups`) guarded by bearer `CRON_SECRET`.
   - Identifies Enrolled Repositories due for backup based on schedule type (`daily` requiring >= 24h since last backup, `weekly` requiring >= 7d, or `manual`).
   - Dispatches backup jobs sequentially or boundedly to avoid resource starvation.
   - Runs an in-process interval in local development to drive periodic executions out-of-the-box.

5. **User Interface Module (Warm-Canvas Editorial)**:
   - Built on Next.js App Router and Tailwind CSS with custom editorial design tokens (`#faf9f5` canvas, `#cc785c` primary coral, serif headings, dark product cards).
   - Unified Operations Dashboard containing:
     - Top navigation and connection status banner.
     - Connected Installations card showing GitHub organization details and manual sync action.
     - Repository inventory table with search, privacy badges, schedule selectors, "Enable Backup" toggles, and "Backup Now" triggers.
     - Slide-over Backup History drawer displaying historical backup jobs, commit hashes, download actions, and copyable `git clone` restoration guides.

### Database Schema Changes (Drizzle ORM & Postgres)

1. **`github_installations`**:
   - Stores connected GitHub App installations mapped to `userId`.
   - Columns: `id` (UUID, primary key), `userId` (FK to `user.id`), `installationId` (bigint, unique), `accountLogin` (text), `accountType` (text: "Organization" | "User"), `avatarUrl` (text, nullable), `targetType` (text), `createdAt` (timestamp), `updatedAt` (timestamp).

2. **`github_repositories`**:
   - Stores repositories authorized under each installation.
   - Columns: `id` (UUID, primary key), `installationId` (FK to `github_installations.id`), `userId` (FK to `user.id`), `githubRepoId` (bigint, unique), `name` (text), `fullName` (text), `isPrivate` (boolean), `defaultBranch` (text), `backupEnabled` (boolean, default false), `backupSchedule` (text: "daily" | "weekly" | "manual", default "daily"), `lastBackupAt` (timestamp, nullable), `lastBackupStatus` (text: "success" | "failed" | "pending", nullable), `createdAt` (timestamp), `updatedAt` (timestamp).

3. **`backup_jobs`**:
   - Stores individual backup execution records.
   - Columns: `id` (UUID, primary key), `repositoryId` (FK to `github_repositories.id`), `userId` (FK to `user.id`), `status` (text: "pending" | "running" | "completed" | "failed"), `triggerType` (text: "manual" | "scheduled"), `s3Bucket` (text), `s3Key` (text), `bundleSizeBytes` (bigint, nullable), `commitSha` (text, nullable), `errorMessage` (text, nullable), `retryCount` (integer, default 0), `startedAt` (timestamp, nullable), `completedAt` (timestamp, nullable), `createdAt` (timestamp).

## Testing Decisions

### What Makes a Good Test
- Tests must focus exclusively on external behavior and public HTTP/API contracts rather than private internal implementation details.
- Avoid asserting on internal function call chains; instead, assert on HTTP response codes, JSON payloads, database state transitions, and mocked external network interactions.

### Proposed Testing Seams
1. **API / Route Handler Seam (Primary High-Level Seam)**:
   - Tests execute against Next.js route handlers (`/api/github/sync`, `/api/repositories`, `/api/repositories/[id]/backup`, `/api/cron/backups`, `/api/backups/[id]/download`).
   - External dependencies (GitHub API calls and S3 commands) are mocked at the HTTP/SDK boundary.
   - Verifies end-to-end request-response flow, session authentication validation, database persistence, and cron schedule evaluations.
2. **UI Component Seam**:
   - Render and interaction tests for core dashboard components (Repository Inventory table, Installation Card, History Drawer, and Restoration Modal).
   - Validates that UI components conform to the warm-canvas design system tokens without visual regressions.

### Prior Art
- Unit and path alias tests in `tests/smoke.test.ts`.
- Server-side component render tests in `tests/components.test.tsx` verifying design system tokens and HTML rendering.

## Out of Scope

- Bi-directional git syncing (pushing backups back into GitHub or alternative git hosts).
- Granular file-level browsing inside a Git bundle via the web UI (restoration is designed via `git clone <bundle-file>`).
- Multi-user team workspace permissions (all installations and repositories belong directly to the authenticated user in Phase 1).
- Non-GitHub git providers (GitLab, Bitbucket, self-hosted Gitea).
- Git LFS object hosting beyond standard bundle references.

## Further Notes

- All database schema updates will be generated via `pnpm run db-generate` and applied via `pnpm run db-migrate` in adherence to project rules.
- Design tokens and component styling will strictly adhere to `DESIGN.md` and ADR 0001.
- All domain terminology aligns with `GLOSSARY.md`.
