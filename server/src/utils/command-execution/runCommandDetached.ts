import { spawn, SpawnOptions } from 'child_process';
import { updateTaskStatus } from '../taskUtils';

/**
 * Runs a command in a detached process, not waiting for completion.
 * Useful for long-running processes like dev servers.
 */
export async function runCommandDetached(
    command: string,
    cwd: string,
    taskId: string,
    options: { shell?: string } = {}
  ): Promise<void> {
    //console.log(`[DETACHED] Running command: ${command} in ${cwd}`);
    
    const spawnOptions: SpawnOptions = {
      cwd,
      detached: true,
      stdio: 'ignore',
      shell: options.shell || '/bin/bash'  // guarantees a shell is available inside the tool-chain image
    };
    
    try {
      const child = spawn(command, [], spawnOptions);
      
      // Unref the child to allow the parent process to exit independently
      child.unref();
      
      //console.log(`[DETACHED] Process started with PID ${child.pid}`);
      
      // Log the start but don't wait for completion
      await updateTaskStatus(
        taskId, 
        'doing', 
        `Started detached process: ${command} (PID: ${child.pid})`
      );
    } catch (error: any) {
      console.error(`[DETACHED] Failed to start command: ${error.message}`);
      await updateTaskStatus(
        taskId, 
        'failed', 
        `Failed to start detached process: ${error.message}`
      );
      throw error;
    }
  }