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
  /**
   * - limit depth to 3
   * - skip noisy dirs (node_modules, .git, target, etc.)
   * - show a pretty tree-like indent so it's readable in one glance
   */
  const prune = "-path '*/node_modules*' -o -path '*/.git*' -o -path '*/target*'";
  const cmd = `
    docker exec ${containerName} bash -c '\n      find /usr/src/${rootPath} \\( ${prune} \\) -prune -o -maxdepth 3 -print |\n      sed "s#/usr/src/${rootPath}##" |\n      awk -F"/" "\n        NF==1{print \$0;next}\n        {printf \"%%*s└── %s\\n\", (NF-1)*2, \"\", \$NF}\n      "\n    '\n  `;
  const output = await runCommand(cmd, '.', taskId);
  console.log('[TREE DUMP]\n' + output);
}

/**
 * Print the contents of each file in `paths` (relative to rootPath) so we can
 * eyeball that they were written exactly as expected.
 */
export async function debugPrintFiles(
  containerName: string,
  rootPath: string,
  paths: string[],
  taskId: string,
): Promise<void> {
  for (const rel of paths) {
    const full = `/usr/src/${rootPath}/${rel.replace(/^\.?\/?/, "")}`;
    const cmd = `docker exec ${containerName} bash -c "printf '\\n===== ${rel} =====\\n'; cat ${full}"`;
    await runCommand(cmd, ".", taskId);
  }
} 