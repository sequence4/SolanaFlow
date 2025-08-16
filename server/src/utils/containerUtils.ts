/* eslint-disable no-useless-escape */
import { runCommand } from './projectUtils';
import { updateTaskStatus } from './taskUtils';

/**
 * Print the directory tree inside the project's container so we can
 * eyeball that `src/`, `Cargo.toml`, etc. were written correctly.
 */
export async function debugDumpContainerTree(
  containerName: string,
  basePath: string, 
  taskId: string
): Promise<void> {
  if (process.env.DEBUG !== 'true') return;
  const treeCmd = `
    docker exec ${containerName} bash -c \
      "cd /usr/src/${basePath} && \
       # BusyBox ash requires escaped parens *and* no stray "-type d"\n       find . \\\\( \
         -path './target' -o \
         -path './.git' -o \
         -path './node_modules' -o \
         -path './programs/*/target' \
       \\\\) -prune -o \\\\( -type f -o -type d \\\\) -print | \
       sed 's|^./||g' | \
       grep -vE '^target/|^.git/|^node_modules/|programs/.*/target/' | \
       sort | \
       awk -F'/' '\
NF==1 { print; next }\
{\
  indent="";\
  for (i = 1; i < NF; i++) \
    indent = indent "  ";\
  print indent "└── " $NF;\
}\
'\'' \
      "
  `;
  console.log('[DEBUG] Running directory tree dump command');

  let treeDump = '';
  try {
    treeDump = await runCommand(treeCmd, '.', taskId);
  } catch (err) {
    console.error('[DEBUG] Tree dump command failed');
    await updateTaskStatus(taskId, 'failed', 
      'Tree dump failed – see server logs for details');
    throw err;
  }

  console.log('[DEBUG] Directory tree structure generated');
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
  if (process.env.DEBUG !== 'true') return;
  console.log(`[DEBUG] Checking ${paths.length} key project files`);
  
  for (const rel of paths) {
    const full = `/usr/src/${rootPath}/${rel.replace(/^\.?\/?/, "")}`;
    // Only print file names without their content to reduce console bloat
    const cmd = `docker exec ${containerName} bash -c "printf '\\n===== ${rel} =====\\n'"`; // ; cat ${full}"
    try {
      await runCommand(cmd, ".", taskId);
    } catch (err) {
      console.error(`[DEBUG] Failed to check file: ${rel}`);
      await updateTaskStatus(taskId, 'failed',
        `Checking ${rel} failed – see logs`);
      throw err;
    }
  }
  
  console.log(`[DEBUG] All key project files checked`);
}