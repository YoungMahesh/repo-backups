# Spec: GitHub Installation Disconnection, Historical Retention, and Archive Purge

Status: ready-for-agent

## Problem Statement

Engineering teams and organization administrators who connect their GitHub organizations or personal accounts to the repository backup platform face two distinct lifecycle challenges when offboarding or managing inactive accounts:

1. **Inability to Disconnect Defunct Installations**: Users currently have no way to remove or disconnect an installation once added. When an organization offboards from the platform, undergoes corporate restructuring, or no longer requires automated repository backups, users are left with the installation permanently occupying their active dashboard. This causes unnecessary scheduled backup attempts, log noise, and cluttered repository inventories.
2. **Data Retention vs. Storage Cost Tension**: Standard backup systems frequently force an all-or-nothing choice: either keep paying storage costs indefinitely for retained archives of disconnected accounts, or delete the integration and risk silent, catastrophic data loss across all disaster-recovery points in object storage. Users need an explicit, safe, two-stage lifecycle:
   - **Stage 1 (Disconnection)**: Safely sever GitHub authorization and halt active backup schedules while strictly preserving historical disaster-recovery Git bundles in S3 storage.
   - **Stage 2 (Archive Purge)**: Intentionally and permanently purge historical disaster-recovery Git bundles from S3 object storage and remove associated database records when archives are obsolete or must be destroyed for compliance or cost control.

## Solution

A complete installation lifecycle adhering to the platform's warm-canvas editorial design system, domain glossary, and bidirectional GitHub synchronization:

1. **User-Initiated Disconnection with Confirmation Safeguards**: Authenticated users can trigger a "Disconnect" action directly from their active installation view. A warm-canvas modal requires users to type the exact account login name to prevent accidental clicks, and provides explicit assurance that past backup bundles stored in S3 remain safe and downloadable.
2. **Bi-directional GitHub Synchronization**: When disconnected from the platform, the system calls GitHub's REST API to uninstall the GitHub App on the remote account (treating 404 responses as remote success and providing a resilient local-disconnect fallback). Conversely, if an organization administrator uninstalls or suspends the App directly within GitHub's settings, incoming GitHub webhooks (`installation.deleted` and `installation.suspend`) automatically synchronize the local state.
3. **In-Flight Job Abortion and Schedule Deactivation**: Any backup jobs currently running for the installation's repositories are immediately terminated and marked cancelled, freeing operational resources. Future backup schedules for all associated repositories are deactivated.
4. **Historical Backup Preservation & Schema Integrity**: Rather than hard-deleting records upon disconnection, the installation record transitions to a `disconnected` state with an audit timestamp (`disconnectedAt`). Historical Git bundles in S3 storage and their metadata remain untouched.
5. **Dashboard Clarity & Archived Backups Access**: Disconnected installations and their repositories are removed from active dashboard management, uncluttering the workspace. A subtle, collapsible "Archived Backups" section at the bottom of the dashboard allows users to browse past repositories and instantly generate pre-signed S3 download links for historical backup bundles.
6. **Reconnection Reconciliation**: If an organization is re-connected in the future, the platform automatically re-activates the installation record and reconciles existing repositories and backup history seamlessly.
7. **User-Initiated Archive Purge (Permanent S3 Storage Erasure & DB Cascade)**: Users can permanently purge preserved disaster-recovery archives directly from the "Archived Backups" section. Users can purge an entire disconnected installation or an individual repository under a disconnected installation. Purging permanently deletes the Git `.bundle` files from S3 object storage via delete commands, cascade-deletes the PostgreSQL database records, requires typed confirmation matching the account or repository name, and provides toast notifications with instant dashboard state revalidation.

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
21. As an organization administrator with obsolete preserved backups, I want to purge an entire disconnected account archive from the Archived Backups section, so that I can permanently eliminate unwanted data and stop incurring S3 storage costs.
22. As an organization administrator, I want to purge an individual repository's archives within a disconnected account, so that I can selectively prune decommissioned repositories while keeping disaster-recovery archives for other repositories in the same organization.
23. As a user, I want the purge action to open a dedicated warm-canvas confirmation modal, so that irreversible data destruction cannot happen by accident.
24. As a user, I want the purge confirmation modal to explicitly warn me that all Git backup bundles stored in S3 will be permanently deleted and cannot be recovered.
25. As an organization administrator purging an account archive, I want the modal to require typing the exact GitHub account login name to enable the purge button, so that catastrophic account deletion requires explicit deliberate intent.
26. As a user purging a repository archive, I want the modal to require typing the exact repository name to enable the purge button, so that repo deletion is safeguarded.
27. As a user, I want the purge process to delete the actual `.bundle` objects from S3 object storage via S3 delete commands, so that storage is freed immediately in AWS.
28. As a user, I want S3 object deletions during a purge to be resilient and idempotent, so that if an S3 object is already missing (`NoSuchKey`), the purge continues gracefully rather than stranding me with undeletable database records.
29. As a user, I want the database records for purged installations or repositories to be cascade-deleted from PostgreSQL upon successful S3 purge, so that no orphaned or broken records remain.
30. As a user, I want Archive Purge to be strictly forbidden on active installations and active repositories, so that active production backup pipelines cannot be accidentally purged without first disconnecting.
31. As a security-conscious administrator, I want purge endpoints to enforce authentication and strict user ownership, returning 401 for unauthenticated requests and 403 for unauthorized requests.
32. As a user, I want a clear feedback toast notification when an archive purge completes, so that I have immediate confirmation of successful data destruction.
33. As a user, I want the dashboard state to revalidate immediately after an archive purge, so that purged repositories or accounts disappear from the Archived Backups section without requiring a full page refresh.
34. As a user who purges all repositories in a disconnected account one-by-one, I want the disconnected account shell to remain visible with 0 repositories and 0 bundles preserved, so that I can still choose to purge the account shell or re-connect the organization later.
35. As a user who reconnects a previously purged organization via the GitHub App flow, I want the platform to treat it as a fresh, clean installation with zero prior backup jobs, so that there are no stale references or integrity issues.
36. As a user, I want the purge trigger buttons on the account header and repository rows to be styled with subtle warm-canvas destructive accents, so that destructive actions are discoverable yet visually distinct from routine restore actions.

## Implementation Decisions

### Domain & Architectural Model

- **Two-Stage Lifecycle**: The platform establishes an explicit two-stage lifecycle for account offboarding:
  - **Stage 1 (Disconnection)**: Non-destructive revocation. Sever GitHub authorization and cancel scheduled runs while strictly preserving all historical Backup Bundles in S3 object storage and maintaining database metadata (ADR-0006).
  - **Stage 2 (Archive Purge)**: Destructive, permanent storage erasure. User-initiated deletion of all preserved Git `.bundle` files from S3 and cascade-deletion of PostgreSQL database records (ADR-0008).
- **Ubiquitous Language**: The domain term is **Archive Purge** (verb: **Purge**). We avoid ambiguous terms like "remove archive", "wipe backups", or "clear history" (GLOSSARY.md).
- **Eligibility Barrier**: Archive Purge is strictly restricted to disconnected installations and their repositories. Active installations must be disconnected first before any archive can be purged.

### Storage & Database Deletion Semantics

- **S3 Bundle Deletion**:
  - When an account archive is purged, all completed backup jobs across all repositories of that installation are identified, and their corresponding S3 objects (`s3Bucket`, `s3Key`) are deleted using the S3 storage delete client.
  - When a repository archive is purged, only the backup jobs belonging to that specific repository have their S3 objects deleted.
  - S3 deletion operations are idempotent: missing objects (e.g. `NoSuchKey` / 404) are treated as successful deletions, ensuring database cleanups are never permanently blocked by transient storage anomalies.
- **PostgreSQL Cascade Deletion**:
  - Database schema foreign keys are configured with `onDelete: "cascade"`. Deleting a `github_installations` record automatically cascades to delete all child `github_repositories` and `backup_jobs`.
  - Deleting a `github_repositories` record automatically cascades to delete all child `backup_jobs`.
  - Database deletions occur immediately following the S3 deletion step.
- **Reconnection After Purge**:
  - Because database records are hard-deleted, if a user re-installs the GitHub App for a previously purged organization, the OAuth/App callback treats it as a brand-new installation, generating fresh records with no stale backup references.

### API Route Contracts

- **Installation Archive Purge Endpoint**:
  - Route: `DELETE /api/installations/[id]/archive`
  - Verifies user authentication session (401 if unauthenticated).
  - Verifies installation existence and user ownership (404 if missing, 403 if not owner).
  - Verifies installation `status === "disconnected"` (400 if active or suspended).
  - Collects all S3 bucket and key pairs from completed backup jobs across all repositories of the installation.
  - Deletes all S3 objects using the S3 client.
  - Cascade-deletes the `github_installations` database record.
  - Returns `{ success: true, purgedRepositoriesCount, purgedBundlesCount }`.
- **Repository Archive Purge Endpoint**:
  - Route: `DELETE /api/repositories/[id]/archive`
  - Verifies user authentication session (401 if unauthenticated).
  - Verifies repository existence and user ownership (404 if missing, 403 if not owner).
  - Verifies parent installation `status === "disconnected"` (400 if parent installation is active).
  - Collects all S3 bucket and key pairs from completed backup jobs of the repository.
  - Deletes all S3 objects using the S3 client.
  - Cascade-deletes the `github_repositories` database record.
  - Returns `{ success: true, repositoryId, purgedBundlesCount }`.

### UI Components & Editorial Design (Warm-Canvas)

- **Archive Purge Confirmation Modal**:
  - Warm-canvas styling adhering to `DESIGN.md` (warm paper canvas, serif headings, hairline borders, soft coral/destructive accents).
  - Explicit destructive callout alerting the user that all preserved backup bundles in S3 will be permanently deleted and cannot be restored.
  - Interactive input field requiring the user to type the exact account login (for installation purge) or repository name (for repository purge).
  - Destructive action button remains disabled until the input exactly matches the target string.
  - Displays a loading spinner and disables controls during the purge network request.
- **Archived Backups Section Controls**:
  - **Account Header**: A "Purge Archive" outline button styled with subtle warm-canvas destructive hover accents, placed on the right side of the disconnected account header.
  - **Repository Row**: A "Purge" button placed alongside "Guide" and "Backups & Restore" on each repository row.
- **Toast Notifications & State Revalidation**:
  - Displays an immediate success toast upon completion (e.g., "Successfully purged archived backups for {name}").
  - Invokes dashboard data revalidation / refresh callbacks to remove purged entities from the view without requiring a full browser reload.

## Testing Decisions

### What Makes a Good Test

Tests must verify external behavioral contracts across clean module seams without coupling to private internal implementation details. Good tests verify:
- End-to-end HTTP response status codes, payload structures, and database state transitions.
- Security constraints (preventing unauthenticated or unauthorized users from purging foreign installations or repositories).
- Business rule enforcement (rejecting purge requests on active installations with 400 Bad Request).
- S3 object deletion calls (verifying the S3 client receives delete commands for every associated bundle).
- Idempotency and resiliency (verifying that missing S3 objects do not fail the database purge).
- UI state machines (modal open/close transitions, disabled button states until input matches, toast triggering, and post-action state revalidation).

### Testing Seams & Coverage

1. **HTTP Route Handler Seam (Primary Backend Seam)**:
   - Exercise `DELETE /api/installations/[id]/archive` and `DELETE /api/repositories/[id]/archive` using synthetic `NextRequest` objects against a real test database.
   - Use mock S3 storage to verify that delete calls are dispatched for all tracked bundle keys.
   - Verify that 401 is returned when unauthenticated, 403 when unauthorized, 404 when not found, and 400 when attempting to purge active installations.
   - Verify that database records are cleanly cascade-deleted.
   - Verify status filtering on `GET /api/installations`.
2. **UI Component Seam (User Interaction Seam)**:
   - Render `ArchivedBackupsSection` and `PurgeArchiveModal` using Vitest and React Testing Library.
   - Verify that "Purge Archive" and "Purge" buttons render properly with warm-canvas styling.
   - Verify that clicking a purge button opens the confirmation modal with accurate target details.
   - Verify that the confirm button remains disabled until the exact account login or repo name is typed.
   - Verify that submitting the modal dispatches the archive delete request, triggers a success toast, and invokes the refresh callback.

### Prior Art in Codebase

- `tests/github-routes.test.ts`: Pattern for testing authenticated Next.js route handlers with in-memory mock clients and test database records.
- `tests/backup-download-routes.test.ts`: Pattern for verifying S3 storage mock interactions and pre-signed URL behaviors.
- `tests/archived-backups.test.tsx`: Pattern for component unit testing of the Archived Backups section using Vitest and React Testing Library.
- `tests/installation-disconnection.test.tsx`: Pattern for testing typed confirmation modals and state updates.

## Out of Scope

- Purging active installations or repositories without disconnecting first (they must be disconnected first to protect active backup pipelines).
- Individual point-in-time backup bundle deletion from the Backup History drawer (fine-grained bundle pruning is handled via rolling retention window policies).
- Automated S3 bucket lifecycle expiration rules (archive purge is an explicit, intentional user-driven action).
- Multi-factor authentication prompt on purge (the typed confirmation provides sufficient intentional friction).

## Further Notes

- Architecture decision records:
  - [0002-github-app-installation-model.md](../../docs/adr/0002-github-app-installation-model.md)
  - [0006-installation-disconnection-and-backup-retention.md](../../docs/adr/0006-installation-disconnection-and-backup-retention.md)
  - [0008-user-initiated-archive-purge.md](../../docs/adr/0008-user-initiated-archive-purge.md)
- Domain glossary and language rules: [GLOSSARY.md](../../GLOSSARY.md).
