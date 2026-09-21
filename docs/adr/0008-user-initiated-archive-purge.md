# 0008: User-Initiated Archive Purge for Disconnected Backups

## Status
accepted

## Context and Decision
Under ADR-0006, disconnecting a GitHub App installation halts backups but strictly preserves all historical Backup Bundles in S3 and database metadata for disaster recovery. However, users occasionally need to permanently eliminate obsolete backup data to control S3 storage costs and comply with data retention or right-to-be-forgotten policies.

We decided to introduce an explicit two-stage lifecycle: Disconnection (Stage 1) revokes access and pauses jobs while retaining bundles, and Archive Purge (Stage 2) enables users to intentionally and permanently delete preserved bundles from S3 object storage and cascade-delete associated PostgreSQL records. To prevent accidental data loss on active pipelines, Archive Purge is strictly confined to disconnected installations and their repositories, and requires high-friction typing confirmation matching the account or repository name.

## Consequences
- Permanent bundle deletion is irreversible; Git bundles are deleted from S3 via `DeleteObjectCommand`.
- Database records in `github_repositories` and `github_installations` are cascade-deleted upon successful archive purge.
- Active backup pipelines cannot be purged; an installation must be disconnected first.
- If a user later reconnects a GitHub organization whose archive was purged, it is treated as a clean, brand-new installation.
