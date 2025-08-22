/* eslint-disable no-useless-escape */
import { runCommand } from './command-execution/runCommand';
import { updateTaskStatus } from './taskUtils';



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
  //console.log(`[DEBUG] Checking ${paths.length} key project files`);
  
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