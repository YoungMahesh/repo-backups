import { runScheduledBackups } from "./scheduler";

declare global {
  var __devCronRunnerTimer: NodeJS.Timeout | null | undefined;
}

const DEFAULT_DEV_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * Starts an in-process timer in local development to automatically check
 * and execute due scheduled backups periodically.
 */
export function startLocalDevCronRunner(
  intervalMs: number = DEFAULT_DEV_INTERVAL_MS,
): boolean {
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_DEV_CRON === "true";

  if (!isDev) {
    return false;
  }

  // Avoid creating multiple timers during development hot-reloading
  if (globalThis.__devCronRunnerTimer) {
    return false;
  }

  console.log(
    `[LocalDevCronRunner] Starting background scheduled backup runner (interval: ${intervalMs}ms)...`,
  );

  const timer = setInterval(async () => {
    try {
      const summary = await runScheduledBackups();
      if (summary.dueCount > 0) {
        console.log(
          `[LocalDevCronRunner] Processed ${summary.processedCount} scheduled backup(s):`,
          summary.results.map((r) => `${r.fullName}: ${r.success ? "success" : "failed"}`).join(", "),
        );
      }
    } catch (err) {
      console.error("[LocalDevCronRunner] Error during scheduled backup execution:", err);
    }
  }, intervalMs);

  // Unref the timer so it doesn't block Node.js process shutdown
  if (timer.unref) {
    timer.unref();
  }

  globalThis.__devCronRunnerTimer = timer;
  return true;
}

/**
 * Stops the active in-process development timer.
 */
export function stopLocalDevCronRunner(): boolean {
  if (globalThis.__devCronRunnerTimer) {
    clearInterval(globalThis.__devCronRunnerTimer);
    globalThis.__devCronRunnerTimer = null;
    console.log("[LocalDevCronRunner] Stopped background scheduled backup runner.");
    return true;
  }
  return false;
}

export function isLocalDevCronRunnerActive(): boolean {
  return !!globalThis.__devCronRunnerTimer;
}
