import { runCommand } from './projectUtils';

/**
 * Print the directory tree inside the project's container so we can
 * eyeball that `src/`, `Cargo.toml`, etc. were written correctly.
 *
 * It uses `find` so we don't need the `tree` package in the image.
 * Depth is limited to 3 levels to keep logs readable.
 */
export async function debugDumpContainerTree(
  containerName: string,
  rootPath: string,
  taskId: string,
): Promise<void> {
  const cmd = `
    docker exec ${containerName} bash -c \
    "find /usr/src/${rootPath} -maxdepth 3 -printf '%y %P\\n' | sort"
  `;
  // We reuse runCommand so output is attached to the same task log.
  const output = await runCommand(cmd, '.', taskId);
  console.log('[TREE DUMP]\n' + output);
} 