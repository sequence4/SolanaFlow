import fs from "fs";
import path from "path";
import { FileNode } from "../fileUtils";
import { readFileFromContainer } from "../docker/readFileFromContainer";
import { createTask, updateTaskStatus } from "../taskUtils";

/** RegExp that rejects typical non-text assets. */
const BIN_PATTERN = /\.(png|jpe?g|gif|ico|wasm|so|ttf|woff2?)$/i;

/**
 * Recursively attaches UTF-8 text to every FileNode that:
 *  • is a leaf (no children) AND
 *  • is smaller than 1 MiB AND
 *  • does not match BIN_PATTERN
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
    if (node.type === "directory" && node.children) {
      await attachFileContents(node.children, absRoot, containerName, skipContent, skipLogging);
      continue;
    }

    // Skip content attachment if skipContent is true
    if (skipContent) {
      node.content = "<content omitted>";
      continue;
    }

    // Skip if binary-looking or already too large
    if (BIN_PATTERN.test(node.name)) continue;

    const abs = path.join(absRoot, node.path);
    try {
      const stat = await fs.promises.stat(abs);
      if (stat.size > 1_048_576) continue;          // >1 MiB ➜ skip
      let text = await fs.promises.readFile(abs, "utf8");
      // If the text contains non‑printable characters, it is likely binary.
      // Store a stub with the byte size instead of corrupting the DB.
      if (!/^[\u0009\u000A\u000D\u0020-\u007E]*$/.test(text)) {
        node.content = `<${Buffer.byteLength(text)} bytes omitted>`;
      } else {
        node.content = text;
        
        // Log file path but not content
        if (!skipLogging) {
          console.log(`[attachFileContents] Attached content for ${node.path} (${Buffer.byteLength(text)} bytes)`);
        }
      }
    } catch (err: any) {
      // Host path not present ➜ pull it straight from the workspace container
      if (err.code !== "ENOENT" || !containerName) throw err;

      const rootFolder  = process.env.ROOT_FOLDER!;
      const relRoot     = path.relative(rootFolder, absRoot);   // keeps nested dirs
      const dockerPath  = `/usr/src/${relRoot}/${node.path}`;

      // Skip paths we know are enormous & irrelevant
      const IGNORE = [/\/\.next\//, /\/node_modules\//, /\/\.yarn\/releases\//];
      if (IGNORE.some(rx => rx.test(dockerPath))) {
        console.log(`[attachFileContents] Skipped heavyweight path ${dockerPath}`);
        continue;
      }

      node.content = await readFileFromContainer(containerName, dockerPath);
      
      // Log file path but not content
      if (!skipLogging) {
        console.log(`[attachFileContents] Attached content for ${node.path} from container (${Buffer.byteLength(node.content)} bytes)`);
      }
    }
  }
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
    console.log(`[readContainerFile] Skipped heavyweight path ${path}`);
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