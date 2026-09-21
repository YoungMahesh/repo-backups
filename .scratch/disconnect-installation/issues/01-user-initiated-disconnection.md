# 01: User-Initiated Disconnection with Confirmation Modal & Remote GitHub Revocation

**What to build:**
An authenticated user can disconnect an active GitHub App Installation directly from the user interface. Clicking "Disconnect" on the Organization card opens a warm-canvas modal requiring the user to type the account login name to confirm. When confirmed, any running backup jobs for the installation are cleanly aborted, the GitHub App is uninstalled from the remote GitHub account via the GitHub REST API (with graceful handling of 404s and a local fallback for network errors), the database record is transitioned to a disconnected status without cascade-deleting repositories or backup jobs, all backup schedules for its repositories are disabled, and the card is removed from active dashboard management.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Database schema for `github_installations` includes `status` (default `"active"`, values `"active" | "disconnected" | "suspended"`) and `disconnected_at` (nullable timestamp), with database migration generated with `pnpm run db-generate` and applied with `pnpm run db-migrate`.
- [x] GitHub client provides a function to delete an installation via GitHub REST API (`DELETE /app/installations/{installation_id}`) using an RS256 JWT, treating 404 responses as remote success and supporting mock client overrides.
- [x] Disconnection API endpoint verifies authentication and user ownership, rejecting unauthenticated or unauthorized requests with 401 or 403.
- [x] Any in-flight backup jobs (`status: "running"`) for repositories belonging to the disconnected installation are aborted and marked cancelled (`status: "failed"`, `error_message: "Installation disconnected by user"`).
- [x] Disconnecting sets installation `status = "disconnected"`, records `disconnected_at = now()`, sets `backup_enabled = false` across all associated repositories, and preserves all database records and S3 backup bundles.
- [x] `OrganizationCard` displays a destructive "Disconnect" button adhering to the warm-canvas design system (`DESIGN.md`).
- [x] Clicking "Disconnect" opens a warm-canvas confirmation modal requiring the user to type the exact account login to enable the confirmation button.
- [x] Confirmation modal displays an informative alert reassuring the user that historical backup bundles in S3 will remain safe and preserved.
- [x] Automated tests cover the route handler, remote deletion client, in-flight job abort logic, and UI modal confirmation behavior.
