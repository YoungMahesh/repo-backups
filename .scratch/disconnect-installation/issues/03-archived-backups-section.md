# 03: Collapsible Archived Backups Section & Historical Restoration Access

**What to build:**
Users can inspect and restore preserved historical backups from disconnected installations through a subtle, collapsible "Archived Backups" section at the bottom of the operations dashboard. Active dashboard views filter out disconnected accounts and their repositories, keeping daily operations clean and focused. In the archived section, users can browse disconnected accounts, view associated repositories with completed backup counts, generate pre-signed S3 download links for historical Git bundles, and access the Restoration Guide modal for disaster recovery.

**Blocked by:** 01: User-Initiated Disconnection with Confirmation Modal & Remote GitHub Revocation

**Status:** done

- [x] `GET /api/installations` endpoint supports a `status` query filter (`active` | `disconnected` | `all`), defaulting to `active` to keep active dashboard queries focused.
- [x] Active dashboard filters out disconnected installations and hides their repositories from the active repository inventory table.
- [x] A dedicated `ArchivedBackupsSection` component renders at the bottom of the dashboard in a subtle, collapsible card adhering to the warm-canvas design system (`DESIGN.md`).
- [x] The archived view displays disconnected account identity, disconnection date, repository list, and count of preserved backup bundles.
- [x] Users can click a repository in the archived view to open the Backup History drawer, generate 15-minute temporary pre-signed S3 download links, and view the Restoration Guide modal.
- [x] Automated tests verify filtering on the installations API and component rendering/interaction for the archived backups view.
