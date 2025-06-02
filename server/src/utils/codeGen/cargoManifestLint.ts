import { startGetFileContentTask } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';
import type { WorkspaceHandle } from '../deploy/prepEnv';

interface LintContext {
  projectId: string;
  userId: string;
  workspace: WorkspaceHandle;
}

// Define the required features that must exist
const REQUIRED_HELPER_FEATURES = [
  'cpi',
  'no-entrypoint',
  'no-idl',
  'no-log-ix-name',
  'anchor-debug',
  'custom-heap',
  'custom-panic',
  'idl-build'
];

// Define the required [lib] settings
const REQUIRED_LIB_SETTINGS = [
  'crate-type = ["cdylib"]',
  'test = false',
  'doctest = false'
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
async function findProgramManifests(projectId: string, userId: string): Promise<string[]> {
  try {
    // Get the workspace root Cargo.toml
    const rootManifest = 'Cargo.toml';
    
    // Read the content to find workspace members
    const rootContent = await getFileContentBlocking(projectId, rootManifest, userId);
    
    // Parse for workspace members
    const members: string[] = [];
    const lines = rootContent.split('\n');
    
    // Look for [workspace.members] section
    let inMembersSection = false;
    for (const line of lines) {
      if (line.trim() === '[workspace.members]' || line.includes('members = [')) {
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
    
    // Fallback if no members found: look in programs/ directory
    if (members.length === 0) {
      console.log('[LINT] No workspace members found, trying programs/ directory');
      return ['programs/*/Cargo.toml'];
    }
    
    // Return paths to all member Cargo.toml files
    return members.map(member => `${member}/Cargo.toml`);
  } catch (error) {
    console.error('[LINT] Error finding program manifests:', error);
    return ['programs/*/Cargo.toml']; // Fallback
  }
}

/**
 * Validate a single Cargo.toml file
 */
function validateManifest(content: string, path: string, isRoot: boolean): string[] {
  const issues: string[] = [];
  const lines = content.split('\n');
  
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
    
    // Check for correct profile settings if they exist
    if (hasReleaseProfile && (!content.includes('opt-level = "s"') || 
                             !content.includes('debug = false') ||
                             !content.includes('overflow-checks = false'))) {
      issues.push(`${path}: [profile.release] is missing one or more optimization settings`);
    }
    
    if (hasTestProfile && (!content.includes('opt-level = "s"') || 
                          !content.includes('debug = false') ||
                          !content.includes('overflow-checks = false'))) {
      issues.push(`${path}: [profile.test] is missing one or more optimization settings`);
    }
  } else {
    // Program crates should NOT have profile sections
    if (content.includes('[profile.')) {
      issues.push(`${path}: Contains [profile.*] section which should only be in root Cargo.toml`);
    }
    
    // Program crates should have [lib] with required settings
    let libSectionStart = -1;
    let libSectionEnd = -1;
    
    // Find the [lib] section
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '[lib]') {
        libSectionStart = i;
        break;
      }
    }
    
    if (libSectionStart === -1) {
      issues.push(`${path}: Missing [lib] section`);
    } else {
      // Find the end of the [lib] section
      for (let i = libSectionStart + 1; i < lines.length; i++) {
        if (/^\[.*\]/.test(lines[i].trim())) {
          libSectionEnd = i;
          break;
        }
      }
      
      if (libSectionEnd === -1) {
        libSectionEnd = lines.length;
      }
      
      // Check for required [lib] settings
      const libSection = lines.slice(libSectionStart, libSectionEnd).join('\n');
      for (const setting of REQUIRED_LIB_SETTINGS) {
        const key = setting.split('=')[0].trim();
        if (!new RegExp(`^\\s*${key}\\s*=`, 'm').test(libSection)) {
          issues.push(`${path}: [lib] section missing required setting: ${setting}`);
        }
      }
    }
    
    // Check for [features] section with required helper features
    let featuresSectionStart = -1;
    let featuresSectionEnd = -1;
    
    // Find the [features] section
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '[features]') {
        featuresSectionStart = i;
        break;
      }
    }
    
    if (featuresSectionStart === -1) {
      issues.push(`${path}: Missing [features] section`);
    } else {
      // Find the end of the [features] section
      for (let i = featuresSectionStart + 1; i < lines.length; i++) {
        if (/^\[.*\]/.test(lines[i].trim())) {
          featuresSectionEnd = i;
          break;
        }
      }
      
      if (featuresSectionEnd === -1) {
        featuresSectionEnd = lines.length;
      }
      
      // Check for required helper features
      const featuresSection = lines.slice(featuresSectionStart, featuresSectionEnd).join('\n');
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
export async function lintWorkspaceManifests(context: LintContext): Promise<void> {
  const { projectId, userId } = context;
  console.log('[LINT] Starting static Cargo.toml validation');
  
  const issues: string[] = [];
  
  try {
    // Validate the root Cargo.toml
    const rootPath = 'Cargo.toml';
    try {
      const rootContent = await getFileContentBlocking(projectId, rootPath, userId);
      const rootIssues = validateManifest(rootContent, rootPath, true);
      issues.push(...rootIssues);
    } catch (error) {
      console.error(`[LINT] Error reading root Cargo.toml:`, error);
      issues.push(`Failed to read ${rootPath}: ${error}`);
    }
    
    // Find all program Cargo.toml files
    const programManifests = await findProgramManifests(projectId, userId);
    console.log(`[LINT] Found ${programManifests.length} program manifests to check`);
    
    // Validate each program Cargo.toml
    for (const manifestPath of programManifests) {
      try {
        const content = await getFileContentBlocking(projectId, manifestPath, userId);
        const manifestIssues = validateManifest(content, manifestPath, false);
        issues.push(...manifestIssues);
      } catch (error) {
        console.error(`[LINT] Error reading ${manifestPath}:`, error);
        issues.push(`Failed to read ${manifestPath}: ${error}`);
      }
    }
    
    // If any issues were found, throw an error
    if (issues.length > 0) {
      const errorMessage = `Cargo manifest validation failed with ${issues.length} issues:\n${issues.join('\n')}`;
      console.error('[LINT] ' + errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('[LINT] All Cargo manifests passed validation');
  } catch (error) {
    console.error('[LINT] Validation failed:', error);
    throw error;
  }
} 