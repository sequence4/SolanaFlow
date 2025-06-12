import fs from "fs";
import path from "path";
import { FileNode } from "../fileUtils";
import { readFileFromContainer } from "../docker/readFileFromContainer";

/** RegExp that rejects typical non-text assets. */
const BIN_PATTERN = /\.(png|jpe?g|gif|ico|wasm|so|ttf|woff2?)$/i;

/**
 * Recursively attaches UTF-8 text to every FileNode that:
 *  • is a leaf (no children) AND
 *  • is smaller than 1 MiB AND
 *  • does not match BIN_PATTERN
 */
export async function attachFileContents(
  nodes: FileNode[],
  absRoot: string,
  containerName?: string
): Promise<void> {
  for (const node of nodes) {
    if (node.type === "directory" && node.children) {
      await attachFileContents(node.children, absRoot, containerName);
      continue;
    }

    // Skip if binary-looking or already too large
    if (BIN_PATTERN.test(node.name)) continue;

    const abs = path.join(absRoot, node.path);
    try {
      const stat = await fs.promises.stat(abs);
      if (stat.size > 1_048_576) continue;          // >1 MiB ➜ skip
      node.content = await fs.promises.readFile(abs, "utf8");
    } catch (err: any) {
      // Host path not present ➜ pull it straight from the workspace container
      if (err.code !== "ENOENT" || !containerName) throw err;

      const rootFolder  = process.env.ROOT_FOLDER!;
      const relRoot     = path.relative(rootFolder, absRoot);   // keeps nested dirs
      const dockerPath  = `/usr/src/${relRoot}/${node.path}`;

      node.content = await readFileFromContainer(containerName, dockerPath);
    }
  }
} 