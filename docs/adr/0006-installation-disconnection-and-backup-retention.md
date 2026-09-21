# 0006: Installation Disconnection and Backup Retention Policy

## Status
accepted

## Context and Decision
When users disconnect an active GitHub App installation, the platform needs to balance access revocation with data disaster recovery. 

We decided that disconnecting an installation initiates bi-directional revocation with GitHub via `DELETE /app/installations/{id}` and cancels all in-flight jobs and future backup schedules, but strictly preserves all historical Backup Bundles in S3 and their metadata. Disconnecting an installation must never silently purge stored disaster-recovery archives from object storage.

## Consequences
- S3 objects remain untouched upon installation disconnection.
- In-flight backup jobs for the affected repositories are immediately cancelled and cleaned up.
- Re-installing the GitHub App for the same organization will seamlessly reconcile and re-link existing repositories and historical backups.
