import { exec, execSync, ExecException } from 'child_process';
import { updateTaskStatus } from '../taskUtils';
import { hasWarning } from '../projectUtils';

export async function runCommand(
  command: string,
  cwd: string,
  taskId: string,
  options: { skipSuccessUpdate?: boolean, ensureDir?: string, silent?: boolean } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.ensureDir) {
      try {
        const mkdirCmd = `mkdir -p "${options.ensureDir}"`;
        //console.log(`[DEBUG_DIR] Creating directory: ${options.ensureDir}`);
        execSync(mkdirCmd, { stdio: 'pipe' });
      } catch (dirError) {
        console.error(`[DEBUG_DIR] Error creating directory ${options.ensureDir}:`, dirError);
      }
    }

    exec(
      command,
      { cwd },
      async (error: ExecException | null, stdout: string, stderr: string) => {
        let result = '';

        /*
        if (!options.silent) {
          console.log('!COMMAND:', command);
          console.log('STDOUT:', stdout);
          console.log('STDERR:', stderr);
        }
        */

        if (error) {
          result = `Error: ${error.message}\n\nStdout: ${stdout}\n\nStderr: ${stderr}`;
          await updateTaskStatus(taskId, 'failed', result);
          return reject(new Error(result));
        }

        if (!options.skipSuccessUpdate) {
          if (hasWarning(stdout) || (stderr && hasWarning(stderr))) {
            result = `Warning detected:\n\nStdout: ${stdout.trim()}\n\nStderr: ${stderr.trim()}`;
            await updateTaskStatus(taskId, 'warning', result);
          } else {
            result = `Success`;
            await updateTaskStatus(taskId, 'succeed', result);
          }
        }

        resolve(stdout.trim());
      }
    );
  });
};