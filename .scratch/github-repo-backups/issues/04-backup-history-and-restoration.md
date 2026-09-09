# 04: Backup History Drawer, Pre-Signed Downloads, and Restoration Guide

**What to build:**
Enable users to inspect historical backups and restore their repositories. Clicking any repository in the inventory slides open a warm-canvas Backup History drawer listing all past Backup Bundles with creation date, commit SHA, file size, and status. Each completed backup provides a "Download" button that generates a temporary 15-minute pre-signed S3 URL for direct client download. Clicking "Restore" opens a Restoration Guide modal providing clear instructions and a copyable canonical command (`git clone <bundle-file> <target-folder>`) to reconstruct the full git repository offline.

**Blocked by:** 03: On-Demand Backup Execution and S3 Bundle Storage

**Status:** ready-for-agent

- [ ] Clicking a repository row opens a slide-over drawer showing its historical Backup Jobs
- [ ] The history list shows each backup's timestamp, commit SHA, formatted file size (e.g. MB/GB), trigger type (Manual vs Scheduled), and status
- [ ] Each completed backup features a "Download" button that requests a 15-minute pre-signed S3 URL and triggers browser download
- [ ] A Restoration Guide modal or panel is accessible from each backup entry displaying the exact command (`git clone <bundle-file> <target-folder>`)
- [ ] The modal includes a copy-to-clipboard button and clear guidance explaining that the bundle restores complete git branches and tags offline
- [ ] Failed backup entries in the drawer display error messages and provide a manual "Retry" action
- [ ] High-level route tests verify pre-signed URL generation and authorization checks
- [ ] Drawer and modal styling adhere to the warm-canvas design system tokens (dark elevated surfaces, warm coral highlights, hairline borders)
