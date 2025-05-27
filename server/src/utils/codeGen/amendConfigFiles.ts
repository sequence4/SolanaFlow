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
  cargoStatus:  string;
  cargoTaskId:  string;
  anchorStatus: string;
  anchorTaskId: string;
}

/**
 * Ensures Cargo.toml and Anchor.toml have the correct Anchor/cluster settings.
 * Returns the task-ids and final statuses of the two update-file tasks.
 */
export const amendConfigFiles = async (
  projectId: string,
  userId:    string,
): Promise<AmendResult> => {
  /* ------------------------------------------------------------------ *
   * 1. Read both files (blocking helper waits for actual content)
   * ------------------------------------------------------------------ */
  const cargoSrc  = await getFileContentBlocking(projectId, 'Cargo.toml',  userId);
  const anchorSrc = await getFileContentBlocking(projectId, 'Anchor.toml', userId);

  console.log('[AMEND] Loaded Cargo.toml bytes:', cargoSrc.length);
  console.log('[AMEND] Loaded Anchor.toml bytes:', anchorSrc.length);

  /* ------------------------------------------------------------------ *
   * 2. Patch Cargo.toml
   * ------------------------------------------------------------------ */
  const cargoLines = cargoSrc.split('\n');
  const depHeader  = cargoLines.findIndex(l => l.trim() === '[dependencies]');

  if (depHeader === -1) {
    // Dependencies header missing → can't patch Cargo.toml, but still push anchor changes
    const anchorTaskId = await startUpdateFileTask(projectId, 'Anchor.toml', anchorSrc, userId);
    const anchorStatus = (await pollTaskStatus(anchorTaskId)).task.status;
    return { cargoStatus: 'failed', cargoTaskId: '', anchorStatus, anchorTaskId };
  }

  const filtered = cargoLines.filter((l, idx) => {
    if (idx <= depHeader) return true;
    const t = l.trim();
    return !t.startsWith('anchor-lang') && !t.startsWith('anchor-spl');
  });

  filtered.splice(
    depHeader + 1,
    0,
    'anchor-spl = "0.30.1"',
    'anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }',
  );

  const newCargo    = filtered.join('\n');
  const cargoTaskId = await startUpdateFileTask(projectId, 'Cargo.toml', newCargo, userId);
  const cargoStatus = (await pollTaskStatus(cargoTaskId)).task.status;

  /* ------------------------------------------------------------------ *
   * 3. Patch Anchor.toml
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
  const anchorTaskId = await startUpdateFileTask(projectId, 'Anchor.toml', newAnchor, userId);
  const anchorStatus = (await pollTaskStatus(anchorTaskId)).task.status;

  /* ------------------------------------------------------------------ */
  return { cargoStatus, cargoTaskId, anchorStatus, anchorTaskId };
};
