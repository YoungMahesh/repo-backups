# Spec: GitHub Installation Disconnection and Historical Backup Retention

Status: ready-for-agent

## Problem Statement

Engineering teams and organization administrators who connect their GitHub organizations or personal accounts to the repository backup platform currently have no way to remove or disconnect an installation once added. When an organization offboards from the platform, undergoes corporate restructuring, or no longer requires automated repository backups, users are left with the installation permanently occupying their operations dashboard. This causes unnecessary scheduled backup attempts, log noise, and cluttered repository inventories.

Furthermore, in standard backup systems, deleting an integration frequently introduces catastrophic data loss by cascade-deleting historical backup archives, commit history, and disaster-recovery points stored in object storage. Users need an explicit, safe, and controlled mechanism to sever GitHub authorization and halt active backup schedules, while guaranteeing that existing disaster-recovery Git bundles remain completely intact, accessible, and downloadable.

## Solution

A complete installation disconnection workflow adhering to the platform's warm-canvas editorial design system, domain glossary, and bidirectional GitHub synchronization:

1. **User-Initiated Disconnection with Confirmation Safeguards**: Authenticated users can trigger a "Disconnect" action directly from their active installation view. A warm-canvas modal requires users to type the exact account login name to prevent accidental clicks, and provides explicit assurance that past backup bundles stored in S3 remain safe and downloadable.
2. **Bi-directional GitHub Synchronization**: When disconnected from the platform, the system calls GitHub's REST API to uninstall the GitHub App on the remote account (treating 404 responses as remote success and providing a resilient local-disconnect fallback). Conversely, if an organization administrator uninstalls or suspends the App directly within GitHub's settings, incoming GitHub webhooks (`installation.deleted` and `installation.suspend`) automatically synchronize the local state.
3. **In-Flight Job Abortion and Schedule Deactivation**: Any backup jobs currently running for the installation's repositories are immediately terminated and marked cancelled, freeing operational resources. Future backup schedules for all associated repositories are deactivated.
4. **Historical Backup Preservation & Schema Integrity**: Rather than hard-deleting records and triggering foreign-key cascades across repositories and backup jobs, the installation record transitions to a `disconnected` state with an audit timestamp (`disconnectedAt`). Historical Git bundles in S3 storage and their metadata remain untouched.
5. **Dashboard Clarity & Archived Backups Access**: Disconnected installations and their repositories are removed from active dashboard management, uncluttering the workspace. A subtle, collapsible "Archived Backups" section at the bottom of the dashboard allows users to browse past repositories and instantly generate pre-signed S3 download links for historical backup bundles.
6. **Reconnection Reconciliation**: If an organization is re-connected in the future, the platform automatically re-activates the installation record and reconciles existing repositories and backup history seamlessly.

## User Stories

1. As an organization administrator, I want to see a "Disconnect" option on my active Installation card, so that I can initiate offboarding when backups are no longer needed for that account.
2. As a user, I want the disconnect button to open a warm-canvas confirmation modal, so that I cannot accidentally sever access with a single errant click.
3. As a user, I want the confirmation modal to display a clear explanation that scheduled backups will stop and GitHub access will be revoked, but all past backup bundles in S3 will remain safe and downloadable.
4. As an organization administrator, I want the modal to require typing the exact GitHub account login before enabling the confirm button, so that destructive actions require deliberate human intent.
5. As a user, I want any in-flight backup jobs running during disconnection to be cleanly aborted and marked cancelled, so that server resources and temporary clone directories are freed immediately.
6. As a user, I want the platform to call GitHub's API to uninstall the GitHub App on GitHub remotely, so that our organization's third-party app permissions stay clean on GitHub without requiring separate manual navigation.
7. As a user, I want remote 404 Not Found responses from GitHub's uninstallation API to be handled gracefully as success, so that pre-existing remote removals do not block local disconnection.
8. As a user, I want a resilient fallback option to disconnect locally if GitHub's API is temporarily unreachable or returning server errors, so that I am never trapped in an un-disconnectable state.
9. As an organization administrator who uninstalls the GitHub App directly within GitHub's settings, I want an incoming `installation.deleted` webhook to automatically disconnect the installation locally, so that state remains synchronized regardless of where the action was initiated.
10. As an organization administrator who suspends the GitHub App on GitHub, I want an incoming `installation.suspend` webhook to pause scheduled backups automatically, so that background cron jobs do not fail repeatedly against suspended credentials.
11. As a security-conscious administrator, I want disconnection requests to verify that the requesting user owns the installation, so that unauthorized users cannot disconnect someone else's installation.
12. As a compliance officer, I want historical Git backup bundles stored in S3 to remain completely preserved upon disconnection, so that our disaster-recovery and legal archival records are never silently erased.
13. As a user, I want the database records of past backup jobs (commit SHAs, file sizes, timestamps, S3 keys) to remain intact after disconnection, so that the historical audit trail is preserved.
14. As a user, I want the disconnected installation and its repositories to be removed from the active operations dashboard, so that my daily view only displays currently active and enrolled repositories.
15. As a user, I want a collapsible "Archived Backups" section at the bottom of my dashboard, so that I can still inspect and access repositories from disconnected installations.
16. As a user, I want to click "Download" on any past backup bundle in the archived backups view to generate a secure, short-lived pre-signed S3 URL, so that I can restore repositories from past archives whenever required.
17. As a user, I want to view the Restoration Guide modal from the archived backups view, so that I have exact `git clone` instructions to reconstruct repositories from downloaded bundles.
18. As a user, I want the option to reconnect a previously disconnected organization via the standard "Connect Organization" flow, so that I can resume backups without having to rebuild repository history from scratch.
19. As a user, I want re-connecting an installation to reconcile existing repositories and their past backup history, so that previous backup points remain seamlessly linked.
20. As a user, I want the entire disconnection and archival experience to strictly follow the warm-canvas editorial design system (cream canvas, serif typography, muted archival styling, and coral accents), so that the UI remains coherent, elegant, and reassuring.

## Implementation Decisions

### Domain & Architectural Model

- **Domain Glossary Alignment**: The entity is an **Installation** (which may be owned by an Organization or a personal User account). The operation is **Disconnection**, resulting in a **Disconnected Installation**. All active backup enrollments and schedules cease, while **Backup Bundles** are preserved.
- **Bi-Directional Synchronization**: Disconnection operations can originate from either the platform UI (calling GitHub's App REST API `DELETE /app/installations/{installation_id}`) or from GitHub itself (handling the `installation` webhook with actions `deleted` and `suspend`).
- **Orphan Protection Policy**: S3 storage objects are immutable disaster-recovery archives and are never deleted when an installation is disconnected.

### Database Schema Changes

- Extend the `github_installations` table with two new attributes:
  - `status`: text, non-null, default `"active"` (allowed values: `"active"`, `"disconnected"`, `"suspended"`).
  - `disconnected_at`: timestamp with timezone, nullable.
- When an installation is disconnected:
  - `status` is updated to `"disconnected"`.
  - `disconnected_at` is set to the current timestamp.
  - All associated `github_repositories` records have `backup_enabled` set to `false`.
  - No records in `github_installations`, `github_repositories`, or `backup_jobs` are deleted, eliminating database foreign-key cascade deletions.
- When an installation is re-installed:
  - `status` is updated to `"active"`.
  - `disconnected_at` is cleared to `null`.
  - Existing repositories are reconciled against the newly authorized repository list.

### Modules and Interfaces

1. **GitHub Client Module**:
   - Add an uninstallation function that generates an RS256 JWT using the GitHub App credentials and issues a `DELETE` request to `https://api.github.com/app/installations/{installation_id}`.
   - Handle response status codes: 204 No Content (success), 404 Not Found (success/already removed), and error responses.
   - Provide a mock client adapter interface to support deterministic, offline unit and integration testing.

2. **Installation Management API Routes**:
   - Extend the installations endpoint to support `DELETE /api/installations/[id]` (or `DELETE /api/installations` with query/body):
     - Authenticates user session.
     - Verifies user ownership of the targeted installation.
     - Queries for any in-flight backup jobs (`status: "running"`) belonging to repositories of this installation, cancels them, and logs cancellation details.
     - Calls the GitHub Client uninstallation function.
     - Executes a database transaction to update installation status, timestamp, and disable repository backup schedules.
   - Update the `GET /api/installations` route to support status filtering (`?status=active|disconnected|all`), defaulting to active installations for the primary dashboard and allowing retrieval of disconnected installations for archival views.

3. **GitHub Webhook Ingestion Module**:
   - Enhance the webhook handler to process incoming `installation` events:
     - On `action: "deleted"`: Locate the installation by GitHub installation ID, cancel in-flight jobs, mark status as `"disconnected"`, set `disconnected_at`, and disable backup schedules.
     - On `action: "suspend"`: Update status to `"suspended"` and pause backup schedules.
     - On `action: "unsuspend"`: Restore status to `"active"`.

4. **OAuth / App Callback Reconciliation Module**:
   - In the callback handler, when upserting an installation upon connection, ensure that if a record previously existed with `status: "disconnected"`, it transitions back to `status: "active"` and resets `disconnected_at` to `null`.

5. **UI Components (Warm-Canvas Editorial System)**:
   - **Organization Card**: Add a secondary destructive "Disconnect" action button styled with `text-error` and subtle hover states next to existing card actions.
   - **Disconnect Confirmation Modal**: Implement a modal using the warm-canvas design tokens (`surface-card`, serif heading, muted body text, informative alert on S3 data preservation, input field requiring typed account login, and a disabled-until-matched "Disconnect Installation" button).
   - **Archived Backups Section**: A collapsible component placed beneath the active dashboard, rendered in muted styling, listing disconnected accounts, authorized repositories, completed backup counts, and providing direct access to the Backup History drawer for pre-signed downloads.

## Testing Decisions

### What Makes a Good Test

Tests must verify external behavioral contracts across clean module seams without coupling to private internal implementation details. Good tests verify:
- End-to-end HTTP response status codes, payload structures, and database state transitions.
- Security constraints (preventing unauthenticated or unauthorized users from disconnecting foreign installations).
- Resilient error handling (such as remote 404s and mock network failures).
- UI state machines (modal open/close transitions, disabled button states until input matches, and post-action state updates).

### Testing Seams & Coverage

1. **HTTP Route Handler Seam (Primary Backend Seam)**:
   - Exercise the `DELETE` endpoint using synthetic `NextRequest` objects against a real test database.
   - Use the existing mock GitHub client adapter to verify that the remote GitHub uninstallation endpoint is invoked.
   - Verify that running backup jobs are transitioned to cancelled.
   - Verify that database records remain intact with `status = "disconnected"` and `backupEnabled = false`.
   - Verify status filtering on `GET /api/installations`.
2. **Webhook Seam (Event Ingestion Seam)**:
   - Post simulated GitHub webhook payloads with valid HMAC-SHA256 signatures for `installation.deleted` and `installation.suspend`.
   - Verify that local database records transition properly without human intervention.
3. **UI Component Seam (User Interaction Seam)**:
   - Render `OrganizationCard` and the confirmation modal using Vitest and React Testing Library.
   - Test that the confirm button remains disabled until the account login is typed exactly.
   - Test that confirming triggers the disconnect API call and refreshes dashboard state.
   - Test rendering and interactions in the Archived Backups section.

### Prior Art in Codebase

- `tests/github-routes.test.ts`: Established pattern for testing authenticated Next.js route handlers with in-memory mock GitHub clients and Postgres test databases.
- `tests/github-webhook.test.ts`: Pattern for generating HMAC signatures and posting synthetic GitHub webhook events.
- `tests/github-components.test.tsx`: Pattern for component unit testing with Vitest, jsdom, and testing-library.

## Out of Scope

- Permanent deletion / purging of S3 backup bundles upon disconnection (reserved for future dedicated retention and storage cleanup controls).
- Individual repository unlinking (handled via GitHub's "Manage Permissions" repository selection flow).
- Multi-factor authentication step on disconnection (the typed organization name confirmation provides appropriate friction).

## Further Notes

- Architecture decision records: [0002-github-app-installation-model.md](file:///root/repo-manage/docs/adr/0002-github-app-installation-model.md) and [0006-installation-disconnection-and-backup-retention.md](file:///root/repo-manage/docs/adr/0006-installation-disconnection-and-backup-retention.md).
- Glossary and language rules: [CONTEXT.md](file:///root/repo-manage/CONTEXT.md).
