import { flushOldContainers } from "../utils/container/cleanupQueue";
import { APP_CONFIG } from "../config/appConfig";

export function startCleanupWorker(): void {
  const every = APP_CONFIG.CLEANUP_POLL_MS;
  console.log(`[cleanup-worker] enabled – runs every ${every/60000} min`);
  setInterval(() => {
    flushOldContainers(every)
      .catch(e => console.error("[cleanup-worker] flush error:", e));
  }, every);
} 