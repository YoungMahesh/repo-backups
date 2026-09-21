# 02: GitHub Webhook Ingestion for Remote App Lifecycle (installation.deleted & installation.suspend)

**What to build:**
When an organization administrator uninstalls or suspends the GitHub App directly within GitHub.com settings, incoming GitHub webhooks (`installation` event with `action: "deleted"`, `action: "suspend"`, and `action: "unsuspend"`) automatically synchronize the local state. On `deleted`, the local installation is transitioned to `disconnected`, any running jobs are aborted, and all repository backup schedules are deactivated while preserving historical backups. On `suspend`, the installation status transitions to `suspended` and backup schedules are paused. On `unsuspend`, status is restored to `active`.

**Blocked by:** 01: User-Initiated Disconnection with Confirmation Modal & Remote GitHub Revocation

**Status:** ready-for-agent

- [ ] Webhook route processes incoming `installation` events verified with `X-Hub-Signature-256`.
- [ ] Handling `action: "deleted"` updates the installation to `status = "disconnected"`, sets `disconnected_at = now()`, disables `backup_enabled = false` for its repositories, and cancels any running backup jobs.
- [ ] Handling `action: "suspend"` updates installation `status = "suspended"` and disables `backup_enabled` on its repositories.
- [ ] Handling `action: "unsuspend"` restores installation `status = "active"`.
- [ ] Gracefully acknowledges unrecognized or already disconnected installations with 200 OK to prevent infinite delivery retries from GitHub.
- [ ] Automated tests simulate signed GitHub webhook payloads for `deleted`, `suspend`, and `unsuspend` actions, verifying database state transitions.
