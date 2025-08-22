import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { FileNode } from "../fileUtils";
import { readFileFromContainer } from "../docker/readFileFromContainer";
import { createTask, updateTaskStatus } from "../taskUtils";

/** Directories to completely skip during traversal */
const SKIP_DIRS = new Set([
  '.next',
  'node_modules', 
  '.yarn',
  '.git',
  'target',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target/debug',
  'target/release'
]);

/** File extensions we want to show in the code editor */
const CODE_EXTENSIONS = new Set([
  'rs', 'ts', 'tsx', 'js', 'jsx',
  'toml', 'json', 'md', 'css', 'scss',
  'html', 'yml', 'yaml', 'sol', 'move',
  'py', 'go', 'java', 'c', 'cpp', 'h',
  'sh', 'bash', 'zsh', 'fish', 'dockerfile',
  'txt', 'cfg', 'ini', 'env'
]);

/** RegExp that rejects typical non-text assets. */
const BIN_PATTERN = /\.(png|jpe?g|gif|ico|wasm|so|ttf|woff2?)$/i;

/**
 * Optimized file content attachment that skips heavy directories early
 * and only processes source code files users actually want to see.
 * 
 * @param nodes Array of FileNode objects to process
 * @param absRoot Absolute path to the root directory
 * @param containerName Optional container name for docker operations
 * @param skipContent If true, will not attach file contents to reduce console bloat
 * @param skipLogging If true, will not log file contents to console (default: true)
 */
export async function attachFileContents(
  nodes: FileNode[],
  absRoot: string,
  containerName?: string,
  skipContent?: boolean,
  skipLogging: boolean = true
): Promise<void> {
  for (const node of nodes) {
    // CRITICAL: Skip entire directory trees early
    if (node.type === "directory") {
      // Skip blacklisted directories entirely
      if (SKIP_DIRS.has(node.name)) {
        // Remove children to prevent traversal but keep the directory node
        // so frontend knows it exists
        node.children = [];
        if (!skipLogging) {
          console.log(`[attachFileContents] Skipped heavy directory: ${node.name}`);
        }
        continue;
      }
      
      // Only traverse allowed directories
      if (node.children) {
        await attachFileContents(node.children, absRoot, containerName, skipContent, skipLogging);
      }
      continue;
    }

    // For files, only attach content for source code files
    const ext = node.name.split('.').pop()?.toLowerCase();
    
    // Skip if not a code file extension we care about
    if (!ext || !CODE_EXTENSIONS.has(ext)) {
      node.content = `<non-source file>`;
      continue;
    }

    // Skip if binary-looking 
    if (BIN_PATTERN.test(node.name)) {
      node.content = `<binary file>`;
      continue;
    }

    // Skip large files early
    const abs = path.join(absRoot, node.path);
    try {
      const stat = await fs.promises.stat(abs);
      if (stat.size > 100_000) { // 100KB limit for code files (much smaller than 1MB)
        node.content = `<file too large: ${Math.round(stat.size / 1024)}KB>`;
        continue;
      }
      
      // Read the file content
      const text = await fs.promises.readFile(abs, "utf8");
      
      // Check if it contains non-printable characters (likely binary)
      if (!/^[\u0009\u000A\u000D\u0020-\u007E\u00A0-\uFFFF]*$/.test(text)) {
        node.content = `<${Buffer.byteLength(text)} bytes - contains binary data>`;
      } else {
        node.content = text;
        if (!skipLogging) {
          console.log(`[attachFileContents] Attached ${node.path} (${text.length} chars)`);
        }
      }
      
    } catch (err: any) {
      if (err.code !== "ENOENT" || !containerName) {
        node.content = `<error reading file: ${err.message}>`;
        continue;
      }

      // Only try Docker read for important source files
      const rootFolder = process.env.ROOT_FOLDER!;
      const relRoot = path.relative(rootFolder, absRoot);
      const dockerPath = `/usr/src/${relRoot}/${node.path}`;
      
      try {
        const dockerContent = await readFileFromContainer(containerName, dockerPath);
        
        // Same binary check for docker content
        if (!/^[\u0009\u000A\u000D\u0020-\u007E\u00A0-\uFFFF]*$/.test(dockerContent)) {
          node.content = `<${Buffer.byteLength(dockerContent)} bytes - contains binary data>`;
        } else {
          node.content = dockerContent;
          if (!skipLogging) {
            console.log(`[attachFileContents] Attached from container: ${node.path} (${dockerContent.length} chars)`);
          }
        }
      } catch (dockerErr) {
        node.content = `<file not accessible in container>`;
      }
    }
  }
}

/**
 * Batch read multiple files from container to reduce Docker exec overhead
 */
export async function batchReadFromContainer(
  containerName: string,
  filePaths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  if (filePaths.length === 0) return results;
  
  // Create a script that reads multiple files at once
  const script = filePaths.map((filePath, idx) => 
    `echo "FILE_START_${idx}"; if [ -f "${filePath}" ]; then cat "${filePath}" 2>/dev/null || echo "ERROR_READING"; else echo "FILE_NOT_FOUND"; fi; echo "FILE_END_${idx}";`
  ).join(' ');
  
  try {
    const output = execSync(
      `docker exec ${containerName} bash -c '${script}'`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 } // 10MB buffer, 30s timeout
    );
    
    // Parse the batched output
    filePaths.forEach((filePath, idx) => {
      const startMarker = `FILE_START_${idx}`;
      const endMarker = `FILE_END_${idx}`;
      const startIdx = output.indexOf(startMarker);
      const endIdx = output.indexOf(endMarker);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const content = output.substring(
          startIdx + startMarker.length + 1,
          endIdx
        ).trim();
        
        if (content && content !== "ERROR_READING" && content !== "FILE_NOT_FOUND") {
          results.set(filePath, content);
        }
      }
    });
  } catch (error) {
    console.error('[BATCH_READ] Error reading from container:', error);
  }
  
  return results;
}

/**
 * Reads a file directly from the container and stores it in the database.
 * Used for copying build artifacts from the container to the host.
 */
export async function readContainerFile(
  containerName: string,
  path: string,
  projectId: string,
  userId: string
): Promise<void> {
  const taskId = await createTask('Read Container File', userId, projectId);
  
  // Skip paths we know are enormous & irrelevant
  const IGNORE = [/\/\.next\//, /\/node_modules\//, /\/\.yarn\/releases\//];
  if (IGNORE.some(rx => rx.test(path))) {
   // console.log(`[readContainerFile] Skipped heavyweight path ${path}`);
    await updateTaskStatus(taskId, 'succeed', 'skipped');
    return;
  }

  try {
    const contents = await readFileFromContainer(containerName, path);
    await updateTaskStatus(taskId, 'succeed', contents);
  } catch (error: any) {
    console.error(`[readContainerFile] Error reading ${path} from container:`, error);
    await updateTaskStatus(taskId, 'failed', `Error reading file: ${error.message || String(error)}`);
  }
} 