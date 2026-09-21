# 04: Reconnection Reconciliation for Previously Disconnected Installations

**What to build:**
When a user re-connects an installation through the GitHub App installation flow that was previously marked as disconnected or suspended, the OAuth/App callback reconciles the record instead of failing or creating duplicates. The installation record transitions back to `status: "active"`, clears `disconnected_at`, updates authorization metadata, and syncs the authorized repository inventory. Existing repository records and their historical backup jobs are preserved and seamlessly re-linked to active management.

**Blocked by:** 01: User-Initiated Disconnection with Confirmation Modal & Remote GitHub Revocation

**Status:** ready-for-agent

- [ ] GitHub App callback route (`/api/github/callback`) detects existing installation records for the same `installationId` or account login.
- [ ] Reconnecting updates the installation record with `status = "active"`, `disconnected_at = null`, and refreshed account metadata.
- [ ] Existing repository records for the reconnected installation are preserved along with their historical backup jobs and S3 references.
- [ ] Any newly authorized repositories from GitHub are inserted into `github_repositories`, while existing repositories have their metadata updated.
- [ ] Automated tests simulate the connection callback for an already disconnected installation, verifying status restoration and data reconciliation.
