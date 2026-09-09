# 0004: In-Route Next.js Cron Architecture for Scheduled Backups

## Status
accepted

## Context and Decision
Scheduled repository backups require a trigger mechanism to invoke backup jobs for due repositories.

We decided to implement a protected Next.js API Route handler (`/api/cron/backups` guarded by a bearer `CRON_SECRET`) paired with an in-process local development timer, rather than requiring an external message queue or dedicated worker daemon (such as Redis/BullMQ or Celery). In production, this route can be invoked by standard HTTP cron providers (Vercel Cron, GitHub Actions, system crontab, or cloud schedulers).

## Consequences
- The application remains a unified single-deployment Next.js service without external worker processes or queue dependencies.
- Individual backup runs must complete within HTTP request timeouts; very large repositories are processed asynchronously by kicking off jobs or bounded sequential tasks.
- For local development, an instrumentation background interval triggers the check periodically without manual webhook intervention.
