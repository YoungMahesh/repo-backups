# 0010: On-Demand Bundle Export and Rolling Quota

## Status
accepted

## Context and Decision
Users occasionally need to export their backed-up Git repositories in bulk for offline storage, multi-cloud redundancy, or disaster recovery drills. In Repo Backups, backups exist as self-contained Git binary bundles (`.bundle` files) in S3. Generating bulk archives across multiple repositories introduces bandwidth, server memory, and storage resource demands.

We decided to introduce an asynchronous **Bundle Export** pipeline scoped exclusively to binary Git Backup Bundles:
1. **Scope and Selection**: The export targets binary `.bundle` files from S3 rather than account profile metadata. By default, it packages the most recent successful Backup Bundle per selected repository within the chosen period (defaulting to the last 30 days) to prevent redundant historical snapshots, with an optional toggle to export all point-in-time bundles.
2. **Rolling 30 GB Quota**: To safeguard infrastructure resources and S3 egress costs, users are constrained to a maximum of 30 GB of downloaded export data per rolling 24-hour window. The UI reflects total selected gigabytes in real time and disables the download action if the quota would be breached. Only completed export jobs count toward the quota.
3. **Asynchronous Packaging & Ephemeral Storage**: Exports execute in the background, assembling bundles into a structured `.zip` archive (`<account_login>/<repo_name>-<timestamp>.bundle`) alongside a `README.md` restoration guide and machine-readable `export-manifest.json`. Completed archives are stored in temporary S3 storage and automatically purged after 24 hours.
4. **Concurrency & UX**: Each user is restricted to a single in-flight export job. The dashboard modal polls export progress and auto-initiates download upon completion, while preserving the presigned download link in a "Recent Exports" view for 24 hours.

## Consequences
- Protects server runtime from memory exhaustion by processing large binary bundles asynchronously.
- Enforces predictable S3 storage and egress limits via the 30 GB rolling quota.
- Clean separation between Git bundle bulk portability and database account records.
- Export archives are strictly ephemeral (24-hour retention window).
