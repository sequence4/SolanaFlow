import type { WorkspaceHandle } from '../deploy/prepEnv';
import { parse as parseToml, stringify as iarnaTomlStringify } from '@iarna/toml';
import { startGetFileContentTask, startUpdateFileTask } from '../fileUtils'; // Assuming these are the actual helpers
import { pollTaskStatus } from '../taskUtils'; // For waiting on file tasks
import fs from 'fs';
import path from 'path';

// Helper to get file content using task system
async function getFileContent(ws: WorkspaceHandle, filePath: string, projectId: string, creatorId: string | null): Promise<string | null> {
  const taskId = await startGetFileContentTask(projectId, filePath, creatorId);
  const result = await pollTaskStatus(taskId);
  if (result.task.status === 'succeed') {
    return result.task.result;
  }
  console.error(`[ENSURE_CONFIG] Failed to get content of ${filePath} for project ${projectId}. Task status: ${result.task.status}`);
  return null;
}

// Helper to update file content using task system
async function updateFile(ws: WorkspaceHandle, filePath: string, content: string, projectId: string, creatorId: string | null): Promise<boolean> {
  const taskId = await startUpdateFileTask(projectId, filePath, content, creatorId);
  const result = await pollTaskStatus(taskId);
  if (result.task.status === 'succeed') {
    return true;
  }
  console.error(`[ENSURE_CONFIG] Failed to update ${filePath} for project ${projectId}. Task status: ${result.task.status}`);
  return false;
}

export async function ensureAnchorTomlProgram(
    ws: WorkspaceHandle, 
    programName: string, 
    programId: string,
    projectId: string, // projectId needed for file operations
    creatorId: string | null = null // creatorId for file operations
): Promise<void> {
  const anchorTomlPath = 'Anchor.toml';
  try {
    const anchorTomlContent = await getFileContent(ws, anchorTomlPath, projectId, creatorId);
    if (anchorTomlContent === null) {
        console.error(`[ENSURE_CONFIG] Could not read ${anchorTomlPath}. Aborting ensureAnchorTomlProgram.`);
        return;
    }

    const parsedToml: any = parseToml(anchorTomlContent); // Use any for parsedToml as @iarna/toml type might be broad
    
    const cluster = parsedToml.provider?.cluster?.toLowerCase() || 'localnet';
    const programsClusterKey = `programs.${cluster}`;

    if (!parsedToml.programs) parsedToml.programs = {};
    let clusterPrograms = parsedToml.programs[cluster];
    if (typeof clusterPrograms !== 'object' || clusterPrograms === null) {
        clusterPrograms = {};
        parsedToml.programs[cluster] = clusterPrograms;
    }

    let changed = false;
    // Only set program ID if not using placeholder on non-localnet clusters
    if (programId === '11111111111111111111111111111111' && cluster !== 'localnet') {
      //console.log(`[ENSURE_CONFIG] Skipping program ID for ${cluster}: will use new key at deploy time`);
    } else {
      if (clusterPrograms[programName] !== programId) {
        clusterPrograms[programName] = programId;
        changed = true;
        //console.log(`[ENSURE_CONFIG] Anchor.toml: Setting ${programsClusterKey}.${programName} = ${programId}`);
      }
    }

    if (changed) {
      //console.log(`[ENSURE_CONFIG] Updating ${anchorTomlPath}`);
      await updateFile(ws, anchorTomlPath, iarnaTomlStringify(parsedToml), projectId, creatorId);
    } else {
      //console.log(`[ENSURE_CONFIG] ${anchorTomlPath} already up-to-date for program ${programName}.`);
    }
  } catch (error) {
    //console.error(`[ENSURE_CONFIG] Error processing ${anchorTomlPath}:`, error);
  }
}

export async function ensureRootWorkspaceMembers(
    ws: WorkspaceHandle,
    projectId: string, // projectId needed for file operations
    creatorId: string | null = null // creatorId for file operations
): Promise<void> {
  // --- 1. locate the real programs folder ---------------------------------
  const rootPath   = ws.rootPath;                 // e.g. "/usr/src/<proj>"
  const programsDir = path.join(rootPath, 'programs');

  // If the directory is missing (new project), just keep the wildcard entry.
  let memberDirs: string[] = [];
  if (fs.existsSync(programsDir)) {
    memberDirs = fs
      .readdirSync(programsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      // —— drop the legacy scaffold ——
      .filter(name => name !== 'anchor-template');
  }

  // Build an explicit member list like ["programs/my_program", …]
  // Fallback to wildcard if nothing found (rare but safe).
  const programDirs =
    memberDirs.length ? memberDirs.map(d => `programs/${d}`) : ['programs/*'];

  // --- 2. read Cargo.toml --------------------------------------------------
  const cargoTomlPath = 'Cargo.toml';
  const cargoTomlContent = await getFileContent(ws, cargoTomlPath, projectId, creatorId);
  if (cargoTomlContent === null) {
    //console.error(`[ENSURE_CONFIG] Could not read ${cargoTomlPath}.`);
    return;
  }
  
  let rootLines = cargoTomlContent.split('\n');
  
  const newMembersBlock = [
    'members = [',
    ...programDirs.map((p, idx) => {
      const comma = idx === programDirs.length - 1 ? '' : ',';
      return `    "${p}"${comma}`;
    }),
    ']',
  ];

  let wsIdx = rootLines.findIndex(l => l.trim() === '[workspace]');
  if (wsIdx === -1) {
    rootLines.unshift('[workspace]', ...newMembersBlock, '');
  } else {
    let wsEnd = rootLines.length;
    for (let i = wsIdx + 1; i < rootLines.length; i++) {
      if (/^\[.*\]/.test(rootLines[i].trim())) { wsEnd = i; break; }
    }

    // wipe any previous `members = [` block (one‑ or multi‑line)
    let scan = wsIdx + 1;
    while (scan < wsEnd) {
      if (rootLines[scan].trim().startsWith('members')) {
        let j = scan;
        while (j < wsEnd && !rootLines[j].trim().endsWith(']')) j++;
        if (j < wsEnd) j++;
        rootLines.splice(scan, j - scan);
        wsEnd -= (j - scan);
        continue;
      }
      scan++;
    }
    // strip leftover wildcard / bracket pair
    rootLines = rootLines.filter((ln, idx, arr) => {
      if (ln.trim() === '"programs/*"') return false;
      if (ln.trim() === ']' && idx > 0 && arr[idx - 1].trim() === '"programs/*"') return false;
      return true;
    });

    rootLines.splice(wsIdx + 1, 0, ...newMembersBlock);
  }
  
  //console.log('[ENSURE_CONFIG] Cargo.toml: updated workspace.members with multi-line format');
  
  // --- 4. write back modified content --------------------------------------
  await updateFile(ws, cargoTomlPath, rootLines.join('\n'), projectId, creatorId);
} 