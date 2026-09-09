# 03: On-Demand Backup Execution and S3 Bundle Storage

**What to build:**
Enable users to trigger an immediate, on-demand Backup Job by clicking "Backup Now" on any Enrolled Repository. The platform auto-provisions the dedicated S3 backup bucket if missing, clones a bare mirror of the repository using a scoped GitHub App installation token, generates a complete Git bundle (`.bundle`) preserving all commits, branches, and tags, and streams it to S3 with server-side encryption (`SSE-S3`) under structured keys (`backups/{userId}/{owner}/{repo}/{timestamp}-{commitSha}.bundle`). The backup job tracks execution status (Pending → Running → Success / Failed), captures commit SHA and bundle size, automatically retries transient errors up to 2 times, and updates the repository's last backup timestamp and status badge in the UI.

**Blocked by:** 02: Enroll Repositories and Configure Backup Schedules

**Status:** ready-for-agent

- [ ] Each Enrolled Repository displays an on-demand "Backup Now" action button
- [ ] Clicking "Backup Now" dispatches a backup job and displays an active loading/running state on the repository row
- [ ] The platform automatically verifies and creates the S3 bucket if it does not already exist
- [ ] The backup engine clones a bare mirror of the repository using a short-lived installation access token
- [ ] The engine executes `git bundle create` with `--all` to produce a standalone `.bundle` file containing complete git history
- [ ] The bundle is streamed to S3 with SSE-S3 encryption and structured key naming
- [ ] The database records a completed `Backup Job` record with commit hash, file size in bytes, and execution duration
- [ ] If a failure occurs, the engine retries up to 2 times with backoff before marking the job as failed with actionable error details
- [ ] The UI displays updated backup status badges (Success, Failed, Running) and last backup timestamp
- [ ] High-level tests verify backup dispatch, mock git bundle execution, S3 upload calls, and error retry behavior
