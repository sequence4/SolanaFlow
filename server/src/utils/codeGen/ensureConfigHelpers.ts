import type { WorkspaceHandle } from '../deploy/prepEnv';
import { parse as parseToml, stringify as iarnaTomlStringify } from '@iarna/toml';
import { startGetFileContentTask, startUpdateFileTask } from '../fileUtils'; // Assuming these are the actual helpers
import { pollTaskStatus } from '../taskUtils'; // For waiting on file tasks

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
    if (clusterPrograms[programName] !== programId) {
      clusterPrograms[programName] = programId;
      changed = true;
      console.log(`[ENSURE_CONFIG] Anchor.toml: Setting ${programsClusterKey}.${programName} = ${programId}`);
    }

    if (changed) {
      console.log(`[ENSURE_CONFIG] Updating ${anchorTomlPath}`);
      await updateFile(ws, anchorTomlPath, iarnaTomlStringify(parsedToml), projectId, creatorId);
    } else {
      console.log(`[ENSURE_CONFIG] ${anchorTomlPath} already up-to-date for program ${programName}.`);
    }
  } catch (error) {
    console.error(`[ENSURE_CONFIG] Error processing ${anchorTomlPath}:`, error);
  }
}

export async function ensureRootWorkspaceMembers(
    ws: WorkspaceHandle,
    projectId: string, // projectId needed for file operations
    creatorId: string | null = null // creatorId for file operations
): Promise<void> {
  const cargoTomlPath = 'Cargo.toml'; 
  try {
    const cargoTomlContent = await getFileContent(ws, cargoTomlPath, projectId, creatorId);
    if (cargoTomlContent === null) {
        console.error(`[ENSURE_CONFIG] Could not read ${cargoTomlPath}. Aborting ensureRootWorkspaceMembers.`);
        return;
    }

    const parsedToml: any = parseToml(cargoTomlContent); // Use any for parsedToml
    const workspaceMemberEntry = 'programs/*';
    let changed = false;

    if (!parsedToml.workspace) {
      parsedToml.workspace = { members: [workspaceMemberEntry] };
      changed = true;
      console.log(`[ENSURE_CONFIG] Cargo.toml: Added [workspace] with members = ["${workspaceMemberEntry}"]`);
    } else {
      if (!parsedToml.workspace.members) {
        parsedToml.workspace.members = [workspaceMemberEntry];
        changed = true;
        console.log(`[ENSURE_CONFIG] Cargo.toml: Initialized members = ["${workspaceMemberEntry}"] under [workspace]`);
      } else if (Array.isArray(parsedToml.workspace.members) && !parsedToml.workspace.members.includes(workspaceMemberEntry)) {
        parsedToml.workspace.members.push(workspaceMemberEntry);
        changed = true;
        console.log(`[ENSURE_CONFIG] Cargo.toml: Added "${workspaceMemberEntry}" to workspace.members`);
      }
    }

    if (changed) {
      console.log(`[ENSURE_CONFIG] Updating ${cargoTomlPath}`);
      await updateFile(ws, cargoTomlPath, iarnaTomlStringify(parsedToml), projectId, creatorId);
    } else {
      console.log(`[ENSURE_CONFIG] ${cargoTomlPath} already includes "${workspaceMemberEntry}" in workspace.members.`);
    }
  } catch (error) {
    console.error(`[ENSURE_CONFIG] Error processing ${cargoTomlPath}:`, error);
  }
} 