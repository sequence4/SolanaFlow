import { startGetFileContentTask } from '../fileUtils';          // helper that blocks until content is ready
import { startUpdateFileTask } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';

/**
 * Helper function to block until file content is ready and return it
 */
async function getFileContentBlocking(
  projectId: string,
  filePath:  string,
  userId:    string,
): Promise<string> {
  const taskId = await startGetFileContentTask(projectId, filePath, userId);
  const { task } = await pollTaskStatus(taskId);           // waits until succeed|failed
  if (task.status !== 'succeed' || typeof task.result !== 'string') {
    throw new Error(`getFileContentBlocking: ${filePath} read failed (${task.status})`);
  }
  return task.result;
}

interface AmendResult {
  anchorStatus: string;
  anchorTaskId: string;
}

/**
 * Ensures Anchor.toml has the correct cluster settings (Devnet).
 * Returns the task-id and final status of the update operation.
 */
export const amendConfigFiles = async (
  projectId: string,
  userId:    string,
): Promise<AmendResult> => {
  /* ------------------------------------------------------------------ *
   * 1. Read Anchor.toml (blocking helper waits for actual content)
   * ------------------------------------------------------------------ */
  const anchorSrc = await getFileContentBlocking(projectId, 'Anchor.toml', userId);
  console.log('[AMEND] Loaded Anchor.toml bytes:', anchorSrc.length);

  /* ------------------------------------------------------------------ *
   * 2. Patch Anchor.toml
   * ------------------------------------------------------------------ */
  let anchorLines = anchorSrc.split('\n').map(l =>
    l.trim() === '[programs.localnet]' ? '[programs.devnet]' : l,
  );

  let providerStart = anchorLines.findIndex(l => l.trim() === '[provider]');
  if (providerStart === -1) {
    anchorLines.push('', '[provider]', 'cluster = "Devnet"', '');
  } else {
    let providerEnd = anchorLines.length;
    for (let i = providerStart + 1; i < anchorLines.length; i++) {
      if (/^\[.*\]/.test(anchorLines[i].trim())) {
        providerEnd = i;
        break;
      }
    }
    const hasCluster = anchorLines
      .slice(providerStart + 1, providerEnd)
      .some(l => l.trim().startsWith('cluster ='));
    if (!hasCluster) {
      anchorLines.splice(providerStart + 1, 0, 'cluster = "Devnet"');
    } else {
      for (let i = providerStart + 1; i < providerEnd; i++) {
        if (anchorLines[i].trim().startsWith('cluster =')) {
          anchorLines[i] = 'cluster = "Devnet"';
        }
      }
    }
  }

  const newAnchor    = anchorLines.join('\n');
  // 🔎 preview – first 20 lines of the outgoing Anchor.toml
  console.log('[AMEND] ─ Anchor.toml preview ───────────');
  console.log(newAnchor.split('\n').slice(0, 20).join('\n'));
  console.log('[AMEND] ────────────────────────────────');

  const anchorTaskId = await startUpdateFileTask(projectId, 'Anchor.toml', newAnchor, userId);
  const anchorStatus = (await pollTaskStatus(anchorTaskId)).task.status;
  console.log(`[AMEND] Anchor.toml write → ${anchorStatus}`);

  /* ------------------------------------------------------------------ */
  return { anchorStatus, anchorTaskId };
};
