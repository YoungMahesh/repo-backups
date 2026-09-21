# 05: User-Initiated Archive Purge for Disconnected Backups

**What to build:**
Users can permanently purge preserved disaster-recovery archives for disconnected accounts and repositories directly from the "Archived Backups" section. The user can choose to purge an entire disconnected installation (erasing all associated repository records and S3 backup bundles) or purge an individual repository's archives. To protect against catastrophic data loss, purging is restricted to disconnected installations, requires typing confirmation (matching the account login or repository name), deletes all corresponding Git bundles from S3 object storage via `DeleteObjectCommand`, and cascade-deletes the PostgreSQL records.

**Blocked by:** 03: Collapsible Archived Backups Section & Historical Restoration Access

**Status:** done

- [x] `DELETE /api/installations/[id]/archive` verifies authentication, ownership, and disconnected status, deletes all associated S3 bundles for the installation's repositories, and cascade-deletes the installation record.
- [x] `DELETE /api/repositories/[id]/archive` verifies authentication, ownership, and that the parent installation is disconnected, deletes all S3 bundles for the repository, and deletes the repository record.
- [x] S3 bundle deletion is idempotent and resilient, handling missing S3 objects (`NoSuchKey`) gracefully and ensuring database records are cleaned up.
- [x] A warm-canvas `PurgeArchiveModal` requires the user to type the exact account login (for installation purge) or repository name (for repository purge) with clear warnings of permanent S3 data destruction.
- [x] `ArchivedBackupsSection` displays a "Purge Archive" button in the account header and a "Purge" button on each repository row.
- [x] Purging displays a feedback toast and revalidates dashboard state so purged items immediately disappear from the view.
- [x] Automated tests verify the installation and repository archive purge API routes, S3 object deletion calls, authorization boundaries, and UI confirmation modal interactions.
