import type { WorkspaceHandle } from '../deploy/prepEnv';
// import toml from 'toml'; // Would be needed for actual TOML parsing
// import { readFileFromContainer, updateFileInContainer } from '../fileUtils'; // Assuming these exist

// Mocked file operations for demonstration as actual implementations are not provided
async function readFileFromContainer(ws: WorkspaceHandle, filePath: string): Promise<string> {
  console.log(`[MOCK_ENSURE_CONFIG] Reading ${filePath} from ${ws.containerName}`);
  if (filePath === 'Anchor.toml') {
    return `[features]\nskip-lint = false\n[programs.localnet]\n# my_program = "placeholder"\n[provider]\ncluster = "Localnet"`;
  }
  if (filePath === 'Cargo.toml') {
    return `[workspace]\n# members = [\"programs/*\"]\n`;
  }
  return '';
}

async function updateFileInContainer(ws: WorkspaceHandle, filePath: string, content: string): Promise<void> {
  console.log(`[MOCK_ENSURE_CONFIG] Updating ${filePath} in ${ws.containerName} with content:\n${content}`);
}


export async function ensureAnchorTomlProgram(
    ws: WorkspaceHandle, 
    programName: string, 
    programId: string
): Promise<void> {
  const anchorTomlPath = 'Anchor.toml';
  try {
    let anchorTomlContent = await readFileFromContainer(ws, anchorTomlPath);
    // const parsedToml = toml.parse(anchorTomlContent); // Actual parsing
    const parsedToml: any = { programs: { localnet: {} }, provider: {}, features: {} }; // Mock parsing
    
    const cluster = parsedToml.provider?.cluster?.toLowerCase() || 'localnet';
    const programsClusterKey = `programs.${cluster}`;

    if (!parsedToml.programs) parsedToml.programs = {};
    if (!parsedToml.programs[cluster]) parsedToml.programs[cluster] = {};

    let changed = false;
    if (parsedToml.programs[cluster][programName] !== programId) {
      parsedToml.programs[cluster][programName] = programId;
      changed = true;
      console.log(`[ENSURE_CONFIG] Updated Anchor.toml: ${programsClusterKey}.${programName} = ${programId}`);
    }

    if (changed) {
      // This is a simplified way to reconstruct TOML. A proper library should be used.
      let newTomlContent = '';
      if (parsedToml.features) {
        newTomlContent += `[features]\n`;
        for (const key in parsedToml.features) newTomlContent += `${key} = ${parsedToml.features[key]}\n`;
        newTomlContent += '\n';
      }
      newTomlContent += `[programs.${cluster}]\n`;
      for (const key in parsedToml.programs[cluster]) newTomlContent += `${key} = "${parsedToml.programs[cluster][key]}"\n`;
      if (parsedToml.provider) {
        newTomlContent += '\n[provider]\n';
        for (const key in parsedToml.provider) newTomlContent += `${key} = "${parsedToml.provider[key]}"\n`;
      }
      // ... (add other sections like [scripts] if they exist and need to be preserved)
      await updateFileInContainer(ws, anchorTomlPath, newTomlContent);
    }
  } catch (error) {
    console.error(`[ENSURE_CONFIG] Error processing Anchor.toml:`, error);
    // Decide if to throw or continue
  }
}

export async function ensureRootWorkspaceMembers(ws: WorkspaceHandle): Promise<void> {
  const cargoTomlPath = 'Cargo.toml'; // Assuming at the root of the workspace
  try {
    let cargoTomlContent = await readFileFromContainer(ws, cargoTomlPath);
    const workspaceMemberEntry = 'programs/*';
    let changed = false;

    // Simplified check/update - a proper TOML parser/writer is better
    if (!cargoTomlContent.includes('[workspace.members]') && !cargoTomlContent.includes('[workspace]\nmembers')) {
        cargoTomlContent += '\n[workspace]\nmembers = ["programs/*"]\n';
        changed = true;
        console.log('[ENSURE_CONFIG] Added [workspace] members to Cargo.toml');
    } else if (cargoTomlContent.match(/^members\s*=\s*\[(.*)\]/m)) {
        const membersLine = cargoTomlContent.match(/^members\s*=\s*\[(.*)\]/m)![0];
        const currentMembers = cargoTomlContent.match(/^members\s*=\s*\[(.*)\]/m)![1]
            .split(',').map(m => m.trim().replace(/"/g, ''));
        if (!currentMembers.includes(workspaceMemberEntry)) {
            currentMembers.push(workspaceMemberEntry);
            const newMembersLine = `members = [${currentMembers.map(m => `"${m}"`).join(', ')}]`;
            cargoTomlContent = cargoTomlContent.replace(membersLine, newMembersLine);
            changed = true;
            console.log('[ENSURE_CONFIG] Updated Cargo.toml workspace members');
        }
    } else {
        // Case where [workspace] exists but members might be missing or in a different format
        // This simplistic approach might not cover all TOML syntax variations.
        if (!cargoTomlContent.includes(`members = ["${workspaceMemberEntry}"]`)){
             // Attempt to add it, could be risky without proper parsing
            cargoTomlContent = cargoTomlContent.replace('[workspace]', `[workspace]\nmembers = ["${workspaceMemberEntry}"]`);
            changed = true;
            console.log('[ENSURE_CONFIG] Attempted to add members to existing [workspace] in Cargo.toml');
        }
    }

    if (changed) {
      await updateFileInContainer(ws, cargoTomlPath, cargoTomlContent);
    }
  } catch (error) {
    console.error(`[ENSURE_CONFIG] Error processing Cargo.toml:`, error);
    // Decide if to throw or continue
  }
} 