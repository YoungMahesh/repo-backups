# 05: Scheduled Backup Runner and Rolling Retention Window Pruning

**What to build:**
Automate periodic repository backups and enforce rolling retention limits to prevent unbounded S3 storage consumption. Implement a protected cron route (`/api/cron/backups` guarded by `CRON_SECRET`) that finds Enrolled Repositories whose scheduled intervals (Daily or Weekly) have elapsed and triggers backup execution, paired with an in-process timer runner for seamless local development. Immediately after each backup succeeds, the system enforces the Retention Window: if a repository has more than 10 completed Backup Bundles, the oldest excess S3 objects are deleted via `DeleteObjectCommand` and updated in the database.

**Blocked by:** 03: On-Demand Backup Execution and S3 Bundle Storage

**Status:** ready-for-agent

- [ ] A protected route (`/api/cron/backups`) requires a bearer `CRON_SECRET` and executes scheduled backup checks
- [ ] Due repositories are identified based on `backupSchedule` ("daily" needing >= 24h since `lastBackupAt`, "weekly" needing >= 7d)
- [ ] An in-process development timer automatically checks and executes due backups periodically in local development
- [ ] Immediately after a backup succeeds, the system evaluates the total completed backups for that repository
- [ ] If completed backups exceed the Retention Window limit (10), the oldest excess S3 objects are permanently deleted from S3 storage
- [ ] The pruned backup records in the database are updated or purged to reflect their deletion
- [ ] The dashboard indicates next scheduled run time and current retention count per repository
- [ ] Automated tests verify cron eligibility queries, secret authorization, and retention pruning of S3 objects
