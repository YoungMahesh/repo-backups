# 0003: Full Git Bundles as Immutable Backup Artifacts

## Status
accepted

## Context and Decision
We need to store backups of user repositories in S3 storage. 

We decided to produce complete Git bundles (`.bundle`) via `git bundle create --all` (or compressed bare mirrors) rather than source code zip/tar archives. While source archives are lighter to fetch via the GitHub REST API, they discard commit history, commit hashes, branches, and tags. Git bundles produce a single, verifiable, offline-restorable file that can be cloned with `git clone <bundle-file>` to fully restore the repository in the event of disaster recovery.

## Consequences
- The backup worker performs a clone using short-lived installation tokens, generates a Git bundle, and streams it to S3 storage.
- Production container images must include the system `git` CLI and `ca-certificates` in the runner stage to support clone operations over HTTPS and bundle creation.
- Subprocesses execute non-interactively with `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0` to prevent hanging on authentication errors or repository locks.
- Temporary scratch space for bare clones and bundle generation uses `os.tmpdir()` by default, with optional `BACKUP_TEMP_DIR` configuration for dedicated storage volume mounts.
- Restoring a backup requires standard git tooling rather than unzipping source files.
- Backup storage requirements scale with full git repository history size rather than working tree size alone.
