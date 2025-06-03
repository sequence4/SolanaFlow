import { flushOldContainers } from "../utils/container/cleanupQueue";
import { APP_CONFIG } from "../config/appConfig";

export function startCleanupWorker(): void {
  const poll   = APP_CONFIG.CLEANUP_POLL_MS;
  const stale  = APP_CONFIG.CLEANUP_STALE_MS;

  console.log(`[cleanup-worker] runs every ${Math.round(poll/60000)} min; purges containers older than ${Math.round(stale/3600000)} h`);

  const timer = setInterval(() => flushOldContainers(stale)
      .catch(e => console.error('[cleanup-worker] flush error:', e)),
    poll);

  timer.unref();            // allow clean shutdown
} 