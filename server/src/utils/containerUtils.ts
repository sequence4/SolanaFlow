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
    docker exec ${containerName} bash -c '
      find /usr/src/${rootPath} \\( ${prune} \\) -prune -o -maxdepth 3 -print |
      sed "s#/usr/src/${rootPath}##" |
      awk -F"/" "
        NF==1{print \$0;next}
        {printf \"%*s└── %s\\n\", (NF-1)*2, \"\", \$NF}
      "
    '
  `;
  const output = await runCommand(cmd, '.', taskId);
  console.log('[TREE DUMP]\n' + output);
} 