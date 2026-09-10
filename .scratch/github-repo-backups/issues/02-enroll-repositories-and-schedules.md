# 02: Enroll Repositories and Configure Backup Schedules

**What to build:**
Enable users to explicitly enroll repositories into active backups and customize their backup cadence. In the repository inventory table, each repository features an "Enable Backup" toggle switch and a schedule selector (Daily, Weekly, or Manual). When a user toggles backup on or modifies the schedule, the change persists immediately to the database and updates the UI state to reflect the repository as an Enrolled Repository with its active schedule badge.

**Blocked by:** 01: Connect GitHub Organization and List Available Repositories

**Status:** done

- [x] Each repository in the inventory displays an interactive "Enable Backup" toggle control
- [x] Each repository features a schedule selector offering "Daily", "Weekly", and "Manual" options
- [x] Toggling backup status sends an update request and persists the `backupEnabled` state in the database
- [x] Changing the schedule option persists the `backupSchedule` value in the database
- [x] Enrolled Repositories display clear visual distinction (e.g. active schedule badge and enrolled status indicator) adhering to the warm-canvas design system
- [x] Disabling backup retains existing repository history while marking the repository as inactive for automated schedules
- [x] API route tests verify authorized toggle and schedule updates for the authenticated repository owner
