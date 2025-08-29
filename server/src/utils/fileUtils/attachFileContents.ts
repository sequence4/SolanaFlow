import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readFileFromContainer } from "../docker/readFileFromContainer";
import { createTask, updateTaskStatus } from "../taskUtils";
import { FileNode } from "./data";
import { CODE_EXTENSIONS, SKIP_DIRS, BIN_PATTERN } from "./data";

export async function attachFileContents(
  nodes: FileNode[],
  absRoot: string,
  containerName?: string,
  skipContent?: boolean,
  skipLogging: boolean = true
): Promise<void> {
  for (const node of nodes) {
    if (node.type === "directory") {
      if (SKIP_DIRS.has(node.name)) {
        node.children = [];
        if (!skipLogging) {
          console.log(`[attachFileContents] Skipped heavy directory: ${node.name}`);
        }
        continue;
      }
      
      if (node.children) {
        await attachFileContents(node.children, absRoot, containerName, skipContent, skipLogging);
      }
      continue;
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    
    if (!ext || !CODE_EXTENSIONS.has(ext)) {
      node.content = `<non-source file>`;
      continue;
    }

    if (BIN_PATTERN.test(node.name)) {
      node.content = `<binary file>`;
      continue;
    }

    const abs = path.join(absRoot, node.path);
    try {
      const stat = await fs.promises.stat(abs);
      if (stat.size > 100_000) { 
        node.content = `<file too large: ${Math.round(stat.size / 1024)}KB>`;
        continue;
      }
      
      const text = await fs.promises.readFile(abs, "utf8");
      
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

      const rootFolder = process.env.ROOT_FOLDER!;
      const relRoot = path.relative(rootFolder, absRoot);
      const dockerPath = `/usr/src/${relRoot}/${node.path}`;
      
      try {
        const dockerContent = await readFileFromContainer(containerName, dockerPath);
        
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

export async function batchReadFromContainer(
  containerName: string,
  filePaths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  if (filePaths.length === 0) return results;
  
  const script = filePaths.map((filePath, idx) => 
    `echo "FILE_START_${idx}"; if [ -f "${filePath}" ]; then cat "${filePath}" 2>/dev/null || echo "ERROR_READING"; else echo "FILE_NOT_FOUND"; fi; echo "FILE_END_${idx}";`
  ).join(' ');
  
  try {
    const output = execSync(
      `docker exec ${containerName} bash -c '${script}'`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 } // 10MB buffer, 30s timeout
    );
    
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

export async function readContainerFile(
  containerName: string,
  path: string,
  projectId: string,
  userId: string
): Promise<void> {
  const taskId = await createTask('Read Container File', userId, projectId);
  
  const IGNORE = [/\/\.next\//, /\/node_modules\//, /\/\.yarn\/releases\//];
  if (IGNORE.some(rx => rx.test(path))) {
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