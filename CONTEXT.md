# Repository Backup Platform

A platform enabling users to connect their GitHub organizations with read-only permissions to selected repositories, backing up complete git history to S3 storage on a regular or on-demand schedule.

## Language

**Installation**:
A GitHub App installation granted by an organization owner or account owner, scoped to specific selected repositories with read-only access.
_Avoid_: Integration, connection, org link

**Repository**:
A GitHub git repository belonging to an Installation that has been authorized for read access and registered for backups.
_Avoid_: Project, codebase, repo target

**Backup Bundle**:
A self-contained Git bundle file (`.bundle`) encapsulating all branches, commits, and tags of a Repository, stored in S3 object storage.
_Avoid_: Zip archive, code snapshot, export tarball

**Backup Job**:
A point-in-time execution that authenticates via an Installation token, creates a Backup Bundle, uploads it to S3, and records execution metadata.
_Avoid_: Sync task, backup pipeline, crawler run

**Retention Window**:
The rolling maximum number of recent Backup Bundles retained for a single Repository, after which the oldest bundles are pruned.
_Avoid_: Expiration policy, backup TTL, clean-up rule

**Enrolled Repository**:
A Repository explicitly activated by the user for scheduled or manual backups.
_Avoid_: Watched repo, tracked repo, enabled project

**Restoration Guide**:
The operational instructions and canonical command (`git clone <bundle-file>`) provided to users to reconstruct a working repository from a downloaded Backup Bundle.
_Avoid_: Unpack steps, extraction script

**Disconnected Installation**:
An Installation whose authorization has been severed from the platform, halting all scheduled backup operations while preserving historical Backup Bundles in storage.
_Avoid_: Deleted integration, removed org, cancelled account

**Disconnection**:
The administrative action of revoking GitHub App access and deactivating an Installation from active backup management.
_Avoid_: Delete org, remove connection

**Archive Purge**:
The intentional, permanent deletion of historical Backup Bundles from S3 object storage and cascading removal of associated database records for a Disconnected Installation or Repository.
_Avoid_: Remove archive, wipe backups, clear history
