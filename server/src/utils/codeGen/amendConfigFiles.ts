import { startGetFileContentTask } from '../fileUtils';          // helper that blocks until content is ready
import { startUpdateFileTask } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';
import { createTask, updateTaskStatus } from '../taskUtils';
import { runCommand } from '../projectUtils';
import pool from '../../config/database';

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

/**
 * Helper function to list directory contents
 */
async function startListDirTask(
  projectId: string,
  dirPath: string,
  creatorId: string | null,
): Promise<string> {
  const taskId = await createTask('List Directory', creatorId, projectId);
  
  setImmediate(async () => {
    try {
      const containerQuery = await pool.query(
        'SELECT container_name FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
      const projectRootPath = await getProjectRootPath(projectId);
      
      let entries: Array<{name: string, type: 'file' | 'directory'}> = [];
      
      if (containerName) {
        try {
          console.log(`Listing directory ${dirPath} from container ${containerName}`);
          const lsCmd = `docker exec ${containerName} find /usr/src/${projectRootPath}/${dirPath} -maxdepth 1 -mindepth 1 -printf '%y %f\\n'`;
          const output = await runCommand(lsCmd, '.', taskId, { skipSuccessUpdate: true });
          
          entries = output.split('\n')
            .filter(Boolean)
            .map(line => {
              const [typeChar, ...nameParts] = line.split(' ');
              const name = nameParts.join(' ');
              return {
                name,
                type: typeChar === 'd' ? 'directory' : 'file'
              };
            });
          
          await updateTaskStatus(taskId, 'succeed', JSON.stringify(entries));
        } catch (containerError) {
          console.error(`Error listing directory ${dirPath} from container:`, containerError);
          await updateTaskStatus(taskId, 'failed', `Failed to list directory: ${containerError}`);
        }
      } else {
        await updateTaskStatus(taskId, 'failed', 'No container found for this project');
      }
    } catch (error) {
      console.error('Error listing directory:', error);
      await updateTaskStatus(
        taskId,
        'failed',
        `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
  
  return taskId;
}

/**
 * Helper function to get project root path
 */
async function getProjectRootPath(projectId: string): Promise<string> {
  const projectQuery = await pool.query(
    'SELECT root_path FROM solanaproject WHERE id = $1',
    [projectId]
  );
  
  if (projectQuery.rows.length === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }
  
  return projectQuery.rows[0].root_path;
}

/**
 * Finds all program crates that were generated
 */
async function listGeneratedPrograms(
  projectId: string,
  userId: string,
): Promise<string[]> {
  const taskId = await startListDirTask(projectId, 'programs', userId);
  const { task } = await pollTaskStatus(taskId);
  if (task.status !== 'succeed' || !Array.isArray(task.result)) {
    throw new Error(`listGeneratedPrograms: failed to list /programs directory (${task.status})`);
  }
  
  const programDirs: string[] = [];
  for (const entry of task.result) {
    if (entry.type === 'directory') {
      try {
        // Check if directory contains a Cargo.toml
        await getFileContentBlocking(projectId, `programs/${entry.name}/Cargo.toml`, userId);
        programDirs.push(`programs/${entry.name}`);
      } catch (error) {
        // Skip directories without Cargo.toml
        console.log(`[AMEND] Skipping non-program directory: programs/${entry.name}`);
      }
    }
  }
  
  return programDirs;
}

/**
 * Patches a program's Cargo.toml to include idl-build feature
 */
async function patchProgramCargoToml(
  projectId: string,
  cargoPath: string,
  userId: string,
): Promise<{ status: string; taskId: string }> {
  // Read Cargo.toml content
  const cargoSrc = await getFileContentBlocking(projectId, cargoPath, userId);
  console.log(`[AMEND] Loaded ${cargoPath} bytes:`, cargoSrc.length);
  
  let cargoLines = cargoSrc.split('\n');
  const idlBuildFeatureLine = 'idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]';
  const defaultFeaturesLine = 'default   = []';
  
  // Check if [features] section exists
  let featuresStart = cargoLines.findIndex(l => l.trim() === '[features]');
  
  if (featuresStart === -1) {
    // No [features] section, append it with required features
    cargoLines.push(
      '',
      '[features]',
      idlBuildFeatureLine,
      defaultFeaturesLine,
      ''
    );
  } else {
    // [features] section exists, find its end
    let featuresEnd = cargoLines.length;
    for (let i = featuresStart + 1; i < cargoLines.length; i++) {
      if (/^\[.*\]/.test(cargoLines[i].trim())) {
        featuresEnd = i;
        break;
      }
    }
    
    // Check if idl-build feature already exists
    const hasIdlBuild = cargoLines
      .slice(featuresStart + 1, featuresEnd)
      .some(l => l.trim().startsWith('idl-build ='));
    
    if (!hasIdlBuild) {
      // Add idl-build feature at the beginning of the section
      cargoLines.splice(featuresStart + 1, 0, idlBuildFeatureLine);
    } else {
      // Replace existing idl-build line with the correct one
      for (let i = featuresStart + 1; i < featuresEnd; i++) {
        if (cargoLines[i].trim().startsWith('idl-build =')) {
          cargoLines[i] = idlBuildFeatureLine;
        }
      }
    }
    
    // Check if default feature already exists - if not, we don't add it as per requirements
    const hasDefault = cargoLines
      .slice(featuresStart + 1, featuresEnd)
      .some(l => l.trim().startsWith('default ='));
      
    if (!hasDefault) {
      // Find where to insert default feature (after idl-build)
      const idlBuildIndex = cargoLines.findIndex(l => l.trim().startsWith('idl-build ='));
      if (idlBuildIndex !== -1) {
        cargoLines.splice(idlBuildIndex + 1, 0, defaultFeaturesLine);
      } else {
        // This shouldn't happen as we just added or updated idl-build
        cargoLines.splice(featuresStart + 1, 0, defaultFeaturesLine);
      }
    }
  }
  
  const newCargo = cargoLines.join('\n');
  const taskId = await startUpdateFileTask(projectId, cargoPath, newCargo, userId);
  const { task } = await pollTaskStatus(taskId);
  console.log(`[AMEND] ${cargoPath} write → ${task.status}`);
  
  return { status: task.status, taskId };
}

interface AmendResult {
  anchorStatus: string;
  anchorTaskId: string;
  cargoPatches?: Array<{ path: string; status: string; taskId: string }>;
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
  //console.log('[AMEND] ─ Anchor.toml preview ───────────');
  //console.log(newAnchor.split('\n').slice(0, 20).join('\n'));
  //console.log('[AMEND] ────────────────────────────────');

  const anchorTaskId = await startUpdateFileTask(projectId, 'Anchor.toml', newAnchor, userId);
  const anchorStatus = (await pollTaskStatus(anchorTaskId)).task.status;
  console.log(`[AMEND] Anchor.toml write → ${anchorStatus}`);

  /* ------------------------------------------------------------------ *
   * 3. Patch program Cargo.toml files to add idl-build feature
   * ------------------------------------------------------------------ */
  const cargoPatches: Array<{ path: string; status: string; taskId: string }> = [];
  
  // Find and patch all program Cargo.toml files
  const programPaths = await listGeneratedPrograms(projectId, userId);
  for (const p of programPaths) {
    const cargoPath = `${p}/Cargo.toml`;
    const result = await patchProgramCargoToml(projectId, cargoPath, userId);
    cargoPatches.push({ path: cargoPath, status: result.status, taskId: result.taskId });
  }

  /* ------------------------------------------------------------------ */
  return { anchorStatus, anchorTaskId, cargoPatches };
};
