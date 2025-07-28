import { startGetFileContentTask } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';
import { runCommand } from '../projectUtils';
import type { WorkspaceHandle } from '../deploy/prepEnv';

interface LintContext {
  projectId: string;
  userId: string;
  workspace: WorkspaceHandle;
}

// Define the required features that must exist
// Note: idl-build is intentionally excluded as it's optional
const REQUIRED_HELPER_FEATURES = [
  'cpi',
  'no-entrypoint',
  'no-idl',
  'no-log-ix-name',
  'anchor-debug',
  'custom-heap',
  'custom-panic'
];

// Define the required [lib] settings
const REQUIRED_LIB_SETTINGS = [
  'crate-type = ["cdylib"]',
  'test = false',
  'doctest = false'
];

// Required optimization settings for profiles
const REQUIRED_PROFILE_SETTINGS = [
  'opt-level = "s"',
  'debug = false',
  'overflow-checks = false'
];

/**
 * Helper function to get file content and wait for it
 */
async function getFileContentBlocking(
  projectId: string,
  filePath: string,
  userId: string
): Promise<string> {
  const taskId = await startGetFileContentTask(projectId, filePath, userId);
  const { task } = await pollTaskStatus(taskId);
  if (task.status !== 'succeed' || typeof task.result !== 'string') {
    throw new Error(`Failed to read ${filePath}: ${task.status}`);
  }
  return task.result;
}

/**
 * Finds all program Cargo.toml files in the workspace
 */
async function findProgramManifests(
  projectId: string, 
  userId: string, 
  context: LintContext
): Promise<string[]> {
  try {
    // Get the workspace root Cargo.toml
    const rootManifest = 'Cargo.toml';
    
    // Read the content to find workspace members
    const rootContent = await getFileContentBlocking(projectId, rootManifest, userId);
    
    // Parse for workspace members - both [workspace.members] format and [workspace] members = [...] format
    const members: string[] = [];
    const lines = rootContent.split('\n');
    
    // Case 1: Look for [workspace] with members = [...] (canonical form)
    let inWorkspaceSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '[workspace]') {
        inWorkspaceSection = true;
      } else if (inWorkspaceSection && trimmed.startsWith('[')) {
        inWorkspaceSection = false;
      }
      
      // Extract member paths from members = [...] format
      if (inWorkspaceSection && trimmed.startsWith('members')) {
        const membersPart = trimmed.substring(trimmed.indexOf('=') + 1).trim();
        if (membersPart.includes('[') && membersPart.includes(']')) {
          // Extract everything between [ and ]
          const arrayPart = membersPart.substring(
            membersPart.indexOf('[') + 1, 
            membersPart.lastIndexOf(']')
          );
          
          // Split by commas and handle quoted paths
          const memberPaths = arrayPart.split(',').map(p => p.trim());
          for (const path of memberPaths) {
            // Remove quotes if present
            const cleanPath = path.replace(/^["']|["']$/g, '');
            if (cleanPath) members.push(cleanPath);
          }
        }
      }
    }
    
    // Case 2: Look for [workspace.members] section (non-canonical but sometimes used)
    let inMembersSection = false;
    for (const line of lines) {
      if (line.trim() === '[workspace.members]') {
        inMembersSection = true;
      } else if (inMembersSection && line.trim().startsWith('[')) {
        inMembersSection = false;
      }
      
      // Extract member paths
      if (inMembersSection && line.includes('"')) {
        const matches = line.match(/"([^"]+)"/g);
        if (matches) {
          matches.forEach((match: string) => {
            const member = match.replace(/"/g, '');
            members.push(member);
          });
        }
      }
    }
    
    // If members were found, return their Cargo.toml paths
    if (members.length > 0) {
      return members.map(member => `${member}/Cargo.toml`);
    }
    
    // Fallback: Find Cargo.toml files in programs/ directory using docker exec
    try {
      const { containerName, rootPath } = context.workspace;
      
      const findCmd = `docker exec ${containerName} find /usr/src/${rootPath}/programs -name Cargo.toml -maxdepth 2`;
      const result = await runCommand(findCmd, '.', 'find-cargo-files');
      
      // Parse results and convert to relative paths
      const manifestPaths = result
        .split('\n')
        .filter(Boolean)
        .map((path: string) => path.replace(`/usr/src/${rootPath}/`, ''));
      
      if (manifestPaths.length > 0) {
        return manifestPaths;
      }
    } catch (error) {
      console.warn(`[LINT] Error finding Cargo.toml files via docker exec:`, error);
      // Continue to next fallback
    }
    
    // Final fallback: Just return programs/*/Cargo.toml for amendConfigFiles to find
    return ['programs/*/Cargo.toml'];
  } catch (error) {
    console.error('[LINT] Error finding program manifests:', error);
    throw new Error(`Failed to find program manifests: ${error}`);
  }
}

/**
 * Helper to remove comments from a line of TOML
 */
function removeComments(line: string): string {
  // Handle # comments and // comments, but skip URLs like http://example.com
  const commentIndex = line.search(/(?<!(https?:|ftp:))\/\/|#/);
  if (commentIndex >= 0) {
    return line.substring(0, commentIndex).trim();
  }
  return line.trim();
}

/**
 * Validate a single Cargo.toml file
 */
export function validateManifest(content: string, path: string, isRoot: boolean): string[] {
  const issues: string[] = [];
  
  // Remove comments and empty lines for more reliable parsing
  const cleanLines = content
    .split('\n')
    .map(removeComments)
    .filter(Boolean);
    
  // Check for duplicate feature keys
  try {
    const parsedToml = require('@iarna/toml').parse(content);
    if (parsedToml.features && new Set(Object.keys(parsedToml.features)).size !== Object.keys(parsedToml.features).length) {
      throw new Error(`duplicate feature keys in ${path}`);
    }
  } catch (error) {
    issues.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Validate different things based on whether it's the root or a crate
  if (isRoot) {
    // Root manifest should have [profile.release] and [profile.test] with correct settings
    const hasReleaseProfile = content.includes('[profile.release]');
    const hasTestProfile = content.includes('[profile.test]');
    
    if (!hasReleaseProfile) {
      issues.push(`${path}: Missing [profile.release] section`);
    }
    
    if (!hasTestProfile) {
      issues.push(`${path}: Missing [profile.test] section`);
    }
    
    // Check for required profile settings if sections exist
    // Note: We only check for presence of each setting, not exact matches
    if (hasReleaseProfile) {
      // Find the [profile.release] section content
      let inReleaseSection = false;
      let releaseSection = '';
      for (const line of cleanLines) {
        if (line === '[profile.release]') {
          inReleaseSection = true;
          continue;
        }
        if (inReleaseSection && line.startsWith('[')) {
          inReleaseSection = false;
          continue;
        }
        if (inReleaseSection) {
          releaseSection += line + '\n';
        }
      }
      
      // Check each required setting is present
      for (const setting of REQUIRED_PROFILE_SETTINGS) {
        const key = setting.split('=')[0].trim();
        const hasKey = new RegExp(`^\\s*${key}\\s*=`, 'm').test(releaseSection);
        if (!hasKey) {
          issues.push(`${path}: [profile.release] missing required setting: ${setting}`);
        }
      }
    }
    
    if (hasTestProfile) {
      // Find the [profile.test] section content
      let inTestSection = false;
      let testSection = '';
      for (const line of cleanLines) {
        if (line === '[profile.test]') {
          inTestSection = true;
          continue;
        }
        if (inTestSection && line.startsWith('[')) {
          inTestSection = false;
          continue;
        }
        if (inTestSection) {
          testSection += line + '\n';
        }
      }
      
      // Check each required setting is present
      for (const setting of REQUIRED_PROFILE_SETTINGS) {
        const key = setting.split('=')[0].trim();
        const hasKey = new RegExp(`^\\s*${key}\\s*=`, 'm').test(testSection);
        if (!hasKey) {
          issues.push(`${path}: [profile.test] missing required setting: ${setting}`);
        }
      }
    }
  } else {
    // Program crates should NOT have profile sections or includes
    // Check entire content to catch profile.* in any context
    const hasProfileSection = cleanLines.some(line => 
      line.startsWith('[profile.') || 
      (line.includes('profile.') && line.includes('include'))
    );
    
    if (hasProfileSection) {
      issues.push(`${path}: Contains [profile.*] section or include which should only be in root Cargo.toml`);
    }
    
    // Program crates should have [lib] with required settings
    let libSection = '';
    let inLibSection = false;
    
    for (const line of cleanLines) {
      if (line === '[lib]') {
        inLibSection = true;
        continue;
      }
      if (inLibSection && line.startsWith('[')) {
        inLibSection = false;
        continue;
      }
      if (inLibSection) {
        libSection += line + '\n';
      }
    }
    
    if (!inLibSection && libSection === '') {
      issues.push(`${path}: Missing [lib] section`);
    } else {
      // Check for required [lib] settings
      for (const setting of REQUIRED_LIB_SETTINGS) {
        const key = setting.split('=')[0].trim();
        if (!new RegExp(`^\\s*${key}\\s*=`, 'm').test(libSection)) {
          issues.push(`${path}: [lib] section missing required setting: ${setting}`);
        }
      }
    }
    
    // Check for [features] section with required helper features
    let featuresSection = '';
    let inFeaturesSection = false;
    
    for (const line of cleanLines) {
      if (line === '[features]') {
        inFeaturesSection = true;
        continue;
      }
      if (inFeaturesSection && line.startsWith('[')) {
        inFeaturesSection = false;
        continue;
      }
      if (inFeaturesSection) {
        featuresSection += line + '\n';
      }
    }
    
    if (!inFeaturesSection && featuresSection === '') {
      issues.push(`${path}: Missing [features] section`);
    } else {
      // Check for required helper features with whitespace-tolerant regex
      for (const feature of REQUIRED_HELPER_FEATURES) {
        if (!new RegExp(`^\\s*${feature}\\s*=`, 'm').test(featuresSection)) {
          issues.push(`${path}: [features] section missing required feature: ${feature}`);
        }
      }
    }
  }
  
  return issues;
}

/**
 * Main linting function that checks all Cargo.toml files in the workspace
 */
export async function lintWorkspaceManifests(
  { projectId, userId, workspace }: {
    projectId: string;
    userId: string;
    workspace: WorkspaceHandle;
  }
): Promise<void> {
  console.log('[LINT] Starting Cargo.toml validation');
  
  const issues: string[] = [];
  
  try {
    // Validate the root Cargo.toml
    const rootPath = 'Cargo.toml';
    try {
      const rootContent = await getFileContentBlocking(projectId, rootPath, userId);
      const rootIssues = validateManifest(rootContent, rootPath, true);
      issues.push(...rootIssues);
    } catch (error) {
      console.warn(`[LINT] Error reading root Cargo.toml: ${error}`);
      issues.push(`Failed to read ${rootPath}: ${error}`);
    }
    
    // Find all program Cargo.toml files
    const programManifests = await findProgramManifests(projectId, userId, { projectId, userId, workspace });
    console.log(`[LINT] Found ${programManifests.length} program manifests to check`);
    
    // Validate each program Cargo.toml
    for (const manifestPath of programManifests) {
      try {
        const content = await getFileContentBlocking(projectId, manifestPath, userId);
        const manifestIssues = validateManifest(content, manifestPath, false);
        issues.push(...manifestIssues);
      } catch (error) {
        console.warn(`[LINT] Error reading ${manifestPath}: ${error}`);
        issues.push(`Failed to read ${manifestPath}: ${error}`);
      }
    }
    
    // If any issues were found, throw an error
    if (issues.length > 0) {
      throw new Error(`Cargo manifest validation found ${issues.length} issues`);
    }
    
    console.log('[LINT] All Cargo manifests passed validation');
  } catch (error) {
    console.warn('[LINT] Validation warning:', error);
    throw error;
  }
} 