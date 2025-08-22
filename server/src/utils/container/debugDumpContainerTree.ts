import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";

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
    //console.log('[DEBUG] Running directory tree dump command');
  
    let treeDump = '';
    try {
      treeDump = await runCommand(treeCmd, '.', taskId);
    } catch (err) {
      console.error('[DEBUG] Tree dump command failed');
      await updateTaskStatus(taskId, 'failed', 
        'Tree dump failed – see server logs for details');
      throw err;
    }
  
    //console.log('[DEBUG] Directory tree structure generated');
  }