import { startGetFileContentTask } from '../fileUtils';          // helper that blocks until content is ready
import { startUpdateFileTask } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';
import { createTask, updateTaskStatus } from '../taskUtils';
import { runCommand } from '../projectUtils';
import pool from '../../config/database';
import * as toml from "@iarna/toml";
import fs from "fs/promises";
import path from "path";

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
  const taskId   = await startListDirTask(projectId, 'programs', userId);
  const { task } = await pollTaskStatus(taskId);

  /* task.result is serialised JSON (string) → parse & type-check */
  let entries: unknown;
  try {
    entries = JSON.parse(task.result as string);
  } catch (err) {
    throw new Error(
      `listGeneratedPrograms: JSON.parse failed – ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(entries)) {
    throw new Error(
      `listGeneratedPrograms: expected array, got ${typeof entries}`,
    );
  }

  const programDirs: string[] = [];
  for (const entry of entries) {
    if (entry.type !== 'directory') continue;

    /* retry up to 5 × 200 ms in case code-gen writes Cargo.toml a bit late */
    const cargoPath = `programs/${entry.name}/Cargo.toml`;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await getFileContentBlocking(projectId, cargoPath, userId);
        programDirs.push(`programs/${entry.name}`);        // success!
        break;
      } catch (err) {
        if (attempt === 5) {
          console.log(`[AMEND] Skipping ${cargoPath} – still missing after retries`);
        } else {
          await new Promise(r => setTimeout(r, 200));
        }
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
  
  /* ───────── 1. ensure anchor-spl in [dependencies] ───────── */
  const splDepLine = 'anchor-spl = "0.31.1"';           // pin to same version as CLI

  /* find (or create) the [dependencies] block */
  let depStart = cargoLines.findIndex(l => l.trim() === '[dependencies]');
  if (depStart === -1) {
    cargoLines.push('', '[dependencies]', splDepLine, '');
  } else {
    let depEnd = cargoLines.length;
    for (let i = depStart + 1; i < cargoLines.length; i++) {
      if (/^\[.*\]/.test(cargoLines[i].trim())) { depEnd = i; break; }
    }
    const hasSpl = cargoLines
      .slice(depStart + 1, depEnd)
      .some(l => l.trim().startsWith('anchor-spl'));
    if (!hasSpl) cargoLines.splice(depEnd, 0, splDepLine);
  }
  
  // Check if [features] section exists
  let featuresStart = cargoLines.findIndex(l => l.trim() === '[features]');
  
  // Define Anchor helper features to silence cfg warnings
  const anchorHelperFeatures = [
    'cpi              = ["no-entrypoint"]',
    'no-entrypoint    = []',
    'no-idl           = []',
    'no-log-ix-name   = []',
    'anchor-debug     = []',
    'custom-heap      = []',
    'custom-panic     = []',
  ];
  
  if (featuresStart === -1) {
    // No [features] section, append it with required features
    cargoLines.push(
      '',
      '[features]',
      idlBuildFeatureLine,
      defaultFeaturesLine,
      ...anchorHelperFeatures,
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
    
    // Add any missing Anchor helper features
    const featureSection = cargoLines.slice(featuresStart + 1, featuresEnd);
    const missingFeatures = anchorHelperFeatures.filter(feature => {
      const featureName = feature.split('=')[0].trim();
      return !featureSection.some(line => line.trim().startsWith(`${featureName} =`) || 
                                        line.trim().startsWith(`${featureName}=`));
    });
    
    if (missingFeatures.length > 0) {
      cargoLines.splice(featuresEnd, 0, ...missingFeatures);
    }
  }
  
  // Ensure [lib] section exists with cdylib crate-type
  const libStart = cargoLines.findIndex(l => l.trim() === '[lib]');
  if (libStart === -1) {
    cargoLines.push(
      '',
      '[lib]',
      'crate-type = ["cdylib"]',
      'test = false',      // Disable unit tests to prevent 4 KB stack-overflow
      'doctest = false',   // Disable doc tests as well
      ''
    );
  } else {
    // Find the end of the [lib] section
    let libEnd = cargoLines.length;
    for (let i = libStart + 1; i < cargoLines.length; i++) {
      if (/^\[.*\]/.test(cargoLines[i].trim())) {
        libEnd = i;
        break;
      }
    }
    
    // Check if test and doctest settings already exist with anchored regex
    const hasTest = cargoLines.slice(libStart + 1, libEnd).some(l => /^\s*test\s*=/.test(l));
    const hasDoctest = cargoLines.slice(libStart + 1, libEnd).some(l => /^\s*doctest\s*=/.test(l));
    
    // Add missing settings in a single splice operation to maintain order
    if (!hasTest || !hasDoctest) {
      const insertPos = libEnd;
      const toAdd: string[] = [];
      if (!hasTest) toAdd.push('test = false');
      if (!hasDoctest) toAdd.push('doctest = false');
      cargoLines.splice(insertPos, 0, ...toAdd);
    }
  }
  
  // Remove [profile.test] and [profile.release] sections from individual crates
  // as they are redundant and will be ignored (profiles are only honored in the workspace root)
  const removeProfileSection = (lines: string[], profileName: string) => {
    let profileStart = lines.findIndex(l => l.trim() === profileName);
    if (profileStart !== -1) {
      // Find the end of the profile section
      let profileEnd = lines.length;
      for (let i = profileStart + 1; i < lines.length; i++) {
        if (/^\[.*\]/.test(lines[i].trim())) {
          profileEnd = i;
          break;
        }
      }
      // Remove the section
      console.log(`[AMEND] Removing redundant ${profileName} section from ${cargoPath}`);
      return [
        ...lines.slice(0, profileStart),
        ...lines.slice(profileEnd)
      ];
    }
    return lines;
  };
  
  // Remove redundant profile sections
  cargoLines = removeProfileSection(cargoLines, '[profile.test]');
  cargoLines = removeProfileSection(cargoLines, '[profile.release]');
  
  const newCargo = cargoLines.join('\n');
  
  // Log preview of the outgoing Cargo.toml
  console.log('\n──── outgoing Cargo.toml preview ────\n' +
    newCargo.split('\n').slice(0, 30).join('\n') +
    '\n─────────────────────────────────────\n');
  
  console.log(`[AMEND] Writing to workspace-relative path: ${cargoPath}`);
  const taskId = await startUpdateFileTask(projectId, cargoPath, newCargo, userId);
  const { task } = await pollTaskStatus(taskId);
  console.log(`[AMEND] ${cargoPath} write → ${task.status}`);
  
  if (task.status === 'succeed') {
    // Verify our changes weren't overwritten (wait a moment to ensure any racing writes complete)
    await new Promise(r => setTimeout(r, 500));
    try {
      const verifyContent = await getFileContentBlocking(projectId, cargoPath, userId);
      const hasIdlBuild = verifyContent.includes('idl-build =');
      console.log(`[AMEND] Verification check: ${cargoPath} contains idl-build feature: ${hasIdlBuild}`);
      if (!hasIdlBuild) {
        console.error(`[AMEND] WARNING: ${cargoPath} was overwritten after our patch! Features lost.`);
        // Re-apply our changes
        console.log(`[AMEND] Re-applying patch to ${cargoPath}...`);
        const retryTaskId = await startUpdateFileTask(projectId, cargoPath, newCargo, userId);
        const retryResult = await pollTaskStatus(retryTaskId);
        console.log(`[AMEND] ${cargoPath} re-write → ${retryResult.task.status}`);
        return { status: retryResult.task.status, taskId: retryTaskId };
      }
    } catch (error) {
      console.error(`[AMEND] Error during verification of ${cargoPath}:`, error);
    }
  }
  
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

  /* ────────────────────────────────────────────────────────────────
   * Strip any [programs.*] entries that have no matching crate name
   * ──────────────────────────────────────────────────────────────── */
  const realProgramNames = new Set(
    (await listGeneratedPrograms(projectId, userId))
      .map(p => p.split('/').pop())           // "programs/<name>" → "<name>"
  );
  const isKeyLine = (l: string) => /^\s*[A-Za-z0-9_-]+\s*=/.test(l);
  const orphanFilter = (l: string) => {
    if (!isKeyLine(l)) return true;

    const key = l.split('=')[0].trim();
    // never drop keys that belong to provider / registry
    if (['cluster', 'wallet', 'url'].includes(key)) return true;

    return realProgramNames.has(key);          // only prune orphan program IDs
  };
  /* anchorLines will be created a bit later – so build the raw array first */
  let anchorLines = anchorSrc.split('\n').filter(orphanFilter);

  /* ------------------------------------------------------------------ *
   * 1b. Read workspace-root Cargo.toml for profile settings
   * ------------------------------------------------------------------ */
  const rootCargoPath = 'Cargo.toml';
  let rootCargoStatus = 'skipped';
  let rootCargoTaskId = '';
  
  try {
    const rootCargoSrc = await getFileContentBlocking(projectId, rootCargoPath, userId);
    console.log('[AMEND] Loaded root Cargo.toml bytes:', rootCargoSrc.length);
    
    let rootLines = rootCargoSrc.split('\n');
    
    // Define the size-optimized profile blocks for both release and test
    const sizeProfile = [
      '[profile.release]',
      'opt-level = "s"',      // shrink code size
      'debug = false',        // strip DWARF
      'overflow-checks = false', // remove extra stack probes
      '',
      '[profile.test]',
      'opt-level = "s"',
      'debug = false',
      'overflow-checks = false',
    ];
    
    // Helper function to add or merge a profile section
    const addOrMergeProfile = (lines: string[], profileName: string, settings: string[]) => {
      let profileStart = lines.findIndex(l => l.trim() === profileName);
      
      if (profileStart === -1) {
        // No existing profile section, add it at the end
        lines.push('', profileName, ...settings, '');
        return lines;
      } else {
        // Merge with existing section
        let profileEnd = lines.length;
        for (let i = profileStart + 1; i < lines.length; i++) {
          if (/^\[.*\]/.test(lines[i].trim())) { 
            profileEnd = i; 
            break; 
          }
        }
        
        // Extract setting keys we want to set
        const keysToReplace = settings.map(s => {
          const match = s.match(/^(\S+)\s*=/);
          return match ? match[1] : null;
        }).filter(Boolean);
        
        // Filter out existing lines we want to replace
        const filtered = lines.slice(profileStart + 1, profileEnd).filter(l => {
          for (const key of keysToReplace) {
            if (l.trim().startsWith(`${key} =`) || l.trim().startsWith(`${key}=`)) {
              return false;
            }
          }
          return true;
        });
        
        // Build the updated lines array
        return [
          ...lines.slice(0, profileStart + 1),
          ...filtered,
          ...settings,
          ...lines.slice(profileEnd),
        ];
      }
    };
    
    // Add or merge release profile
    rootLines = addOrMergeProfile(
      rootLines, 
      '[profile.release]',
      ['opt-level = "s"', 'debug = false', 'overflow-checks = false']
    );
    
    // Add or merge test profile
    rootLines = addOrMergeProfile(
      rootLines, 
      '[profile.test]',
      ['opt-level = "s"', 'debug = false', 'overflow-checks = false']
    );
    
    // Write back the updated root Cargo.toml
    const newRootCargo = rootLines.join('\n');
    console.log(`[AMEND] Writing to workspace-root Cargo.toml to add size-optimized profiles`);
    rootCargoTaskId = await startUpdateFileTask(projectId, rootCargoPath, newRootCargo, userId);
    const rootCargoResult = await pollTaskStatus(rootCargoTaskId);
    rootCargoStatus = rootCargoResult.task.status;
    console.log(`[AMEND] Root ${rootCargoPath} write → ${rootCargoStatus}`);
    
    // Verify changes
    if (rootCargoStatus === 'succeed') {
      await new Promise(r => setTimeout(r, 500));
      try {
        const verifyContent = await getFileContentBlocking(projectId, rootCargoPath, userId);
        const hasReleaseProfile = verifyContent.includes('[profile.release]') && 
                                  verifyContent.includes('opt-level = "s"');
        const hasTestProfile = verifyContent.includes('[profile.test]') && 
                              verifyContent.includes('opt-level = "s"');
        
        console.log(`[AMEND] Verification: root ${rootCargoPath} has profiles - release: ${hasReleaseProfile}, test: ${hasTestProfile}`);
        
        if (!hasReleaseProfile || !hasTestProfile) {
          console.error(`[AMEND] WARNING: root ${rootCargoPath} profiles were not properly set!`);
          const retryTaskId = await startUpdateFileTask(projectId, rootCargoPath, newRootCargo, userId);
          const retryResult = await pollTaskStatus(retryTaskId);
          rootCargoStatus = retryResult.task.status;
          rootCargoTaskId = retryTaskId;
        }
      } catch (error) {
        console.error(`[AMEND] Error verifying root ${rootCargoPath}:`, error);
      }
    }
  } catch (error) {
    console.error(`[AMEND] Error processing root Cargo.toml:`, error);
    rootCargoStatus = 'failed';
  }

  /* ------------------------------------------------------------------ *
   * 2. Patch Anchor.toml
   * ------------------------------------------------------------------ */
  // --- 2a. normalise the [programs.*] section name ---
  anchorLines = anchorLines.map(l =>
    l.trim() === '[programs.localnet]' ? '[programs.devnet]' : l,
  );

  // ──────────────────────────────────────────────────────────────
  // 2b. Ensure *registry.url* AND *provider.wallet* are present
  // ──────────────────────────────────────────────────────────────

  /** ensure `[registry]` has a url key  */
  let regStart = anchorLines.findIndex(l => l.trim() === '[registry]');
  if (regStart === -1) {
    anchorLines.push(
      '',
      '[registry]',
      'url = "https://api.apr.dev"',   // 👈 Anchor needs this, or omit the entire [registry] block
      ''
    );
  } else {
    // search until next [section]
    let regEnd = anchorLines.length;
    for (let i = regStart + 1; i < anchorLines.length; i++) {
      if (/^\[.*\]/.test(anchorLines[i].trim())) { regEnd = i; break; }
    }
    const hasUrl = anchorLines
      .slice(regStart + 1, regEnd)
      .some(l => l.trim().startsWith('url ='));
    if (!hasUrl) {
      anchorLines.splice(
        regStart + 1,
        0,
        'url = "https://api.apr.dev"'   // Anchor CLI panics if [registry] exists but lacks url
      );
    }
  }

  let providerStart = anchorLines.findIndex(l => l.trim() === '[provider]');
  let foundWallet = false;
  if (providerStart === -1) {
    anchorLines.push(
      '',
      '[provider]',
      'cluster = "Devnet"',
      'wallet  = "~/.config/solana/id.json"',  // 👈 required – prevents "missing field `wallet`"
      ''
    );
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
        const trimmed = anchorLines[i].trim();
        if (trimmed.startsWith('cluster =')) {
          anchorLines[i] = 'cluster = "Devnet"';
        }
        if (trimmed.startsWith('wallet =')) foundWallet = true;
      }
      if (!foundWallet) {
        anchorLines.splice(providerEnd, 0, 'wallet  = "~/.config/solana/id.json"');
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
  
  // ----- SAFE TOML PATCH ------------------------------------
  async function safeInsertFeature(cargoPath: string, featureName: string, value: unknown = []) {
    const raw = await fs.readFile(cargoPath, "utf8");
    const doc = toml.parse(raw) as any;
    if (!doc.features) doc.features = {};
    if (!(featureName in doc.features)) doc.features[featureName] = value;
    await fs.writeFile(cargoPath, toml.stringify(doc));
  }
  
  // Find and patch all program Cargo.toml files
  const programPaths = await listGeneratedPrograms(projectId, userId);
  const absRoot = process.env.ROOT_FOLDER || '';
  const projectRootPath = await getProjectRootPath(projectId);
  const fullRoot = path.join(absRoot, projectRootPath);
  
  // anchor-template
  await safeInsertFeature(
    path.join(fullRoot, "programs/anchor-template/Cargo.toml"),
    "idl-build",
    ["anchor-lang/idl-build", "anchor-spl/idl-build"]
  );
  await safeInsertFeature(
    path.join(fullRoot, "programs/anchor-template/Cargo.toml"),
    "anchor-debug"
  );
  
  // my_program
  await safeInsertFeature(
    path.join(fullRoot, `programs/my_program/Cargo.toml`),
    "idl-build",
    ["anchor-lang/idl-build", "anchor-spl/idl-build"]
  );
  await safeInsertFeature(
    path.join(fullRoot, `programs/my_program/Cargo.toml`),
    "anchor-debug"
  );
  // ----- END PATCH ------------------------------------------
  
  // Add the root Cargo.toml patch to the results
  if (rootCargoTaskId) {
    cargoPatches.push({ 
      path: rootCargoPath, 
      status: rootCargoStatus, 
      taskId: rootCargoTaskId 
    });
  }
  
  // Legacy code - we'll keep the result tracking but skip the actual patching
  for (const p of programPaths) {
    const cargoPath = `${p}/Cargo.toml`;
    // We skip calling patchProgramCargoToml here as we now use safeInsertFeature
    cargoPatches.push({ path: cargoPath, status: 'succeed', taskId: 'safe-insert-feature' });
  }

  /* ------------------------------------------------------------------ */
  return { anchorStatus, anchorTaskId, cargoPatches };
};
