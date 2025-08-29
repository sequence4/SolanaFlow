import { spawn } from "child_process";
import { updateTaskStatus } from "../taskUtils";

function hasWarning(output: string): boolean {
  const lowercasedOutput = output.toLowerCase();
  
  if (lowercasedOutput.includes('no lockfile found') ||
      lowercasedOutput.includes('info no lockfile found')) {
    return false;
  }
  
  if (lowercasedOutput.includes('npm deprecated') && 
      lowercasedOutput.includes('this is not a bug in npm')) {
    return false;
  }
  
  return lowercasedOutput.includes('warning');
}

export async function runSpawn(
  command: string,
  cwd: string,
  taskId: string,
  options: { skipSuccessUpdate?: boolean; sendProgress?: (data: unknown) => void } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    let stdoutData = '';
    let stderrData = '';
    
    /* ----- debounce helper ----- */
    let lastFlush = 0;
    const FLUSH_MS = Number(process.env.SPAWN_FLUSH_MS) || 750;
    const flushIfDue = async () => {
      const now = Date.now();
      if (now - lastFlush > FLUSH_MS) {
        lastFlush = now;
        await updateTaskStatus(taskId, 'doing', stdoutData + stderrData).catch(console.error);
      }
    };
    
    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdoutData += text;
      flushIfDue();
      if (options.sendProgress) {
        options.sendProgress({ message: text });
      }
    });
    
    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderrData += text;
      flushIfDue();
      if (options.sendProgress) {
        options.sendProgress({ message: text });
      }
    });
    
    child.on('error', error => {
      const result = `Error starting process: ${error.message}`;
      updateTaskStatus(taskId, 'failed', result).catch(console.error);
      reject(new Error(result));
    });
    
    child.on('close', async code => {
      if (code !== 0) {
        const result = `Error: process exited with code ${code}\n\nStdout: ${stdoutData}\n\nStderr: ${stderrData}`;
        await updateTaskStatus(taskId, 'failed', result);
        return reject(new Error(result));
      }
      
      // Final flush to ensure latest content is saved
      await updateTaskStatus(taskId, 'doing', stdoutData + stderrData).catch(console.error);
      
      if (!options.skipSuccessUpdate) {
        if (hasWarning(stdoutData) || hasWarning(stderrData)) {
          const result = `Warning detected:\n\nStdout: ${stdoutData.trim()}\n\nStderr: ${stderrData.trim()}`;
          await updateTaskStatus(taskId, 'warning', result);
        } else {
          await updateTaskStatus(taskId, 'succeed', 'Success');
        }
      }
      resolve(stdoutData.trim());
    });
  });
}