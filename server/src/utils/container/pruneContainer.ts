import { execSync } from 'child_process';

/**
 * Removes the container <name> **and** any anonymous volumes / networks
 * that carry the matching project label.
 *
 * The function is **idempotent** – calling it twice does no harm.
 */
export function pruneContainerResources(name: string, projectId: string) {
  const label = `solanaflow.project=${projectId}`;

  // 1 ─ stop & delete the primary container (ignore "No such container")
  try { execSync(`docker rm -f ${name}`, { stdio: 'ignore' }); } catch {}

  // 2 ─ remove dangling containers that still carry the label
  try { execSync(`docker container prune -f --filter "label=${label}"`, { stdio: 'inherit' }); } catch {}

  // 3 ─ remove anonymous & named volumes with the same label
  try { execSync(`docker volume prune -f --filter "label=${label}"`, { stdio: 'inherit' }); } catch {}

  // 4 ─ remove unused networks with the label (rare, but safe)
  try { execSync(`docker network prune -f --filter "label=${label}"`, { stdio: 'inherit' }); } catch {}
} 