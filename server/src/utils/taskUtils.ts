import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import fs from 'fs';

export async function createTask(
  name: string,
  creatorId: string | null,
  projectId: string
): Promise<string> {
  const client = await pool.connect();
  try {
    const id = uuidv4();
    await client.query(
      `INSERT INTO task
       (id,name,creator_id,project_id,status,created_at)
       VALUES ($1,$2,$3,$4,'queued',NOW())`,
      [id, name, creatorId, projectId]
    );
    return id;
  } finally {
    client.release();
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: 'queued' | 'doing' | 'finished' | 'failed' | 'succeed' | 'warning',
  result?: string
): Promise<void> {
  const client = await pool.connect();
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');
  console.log(`[DEBUG_TASK_BACKEND] Updating task status to ${status} for taskId: ${sanitizedTaskId}`);
  try {
    await client.query(
      'UPDATE task SET status = $1, result = $2 WHERE id = $3',
      [status, result, sanitizedTaskId]
    );
    console.log(`[DEBUG_TASK_BACKEND] Task status updated to ${status} for taskId: ${sanitizedTaskId}`);
    console.log(`[DEBUG_TASK_BACKEND] Result: ${result?.substring(0, 100)}${result && result.length > 100 ? '...' : ''}`);
  } catch (error) {
    console.error('[DEBUG_TASK_BACKEND] Error updating task status:', error);
  } finally {
    client.release();
  }
}

export async function getTaskById(
  id: string
): Promise<{ status: string; result: string | null }> {
  const client = await pool.connect();
  try {
    const sanitizedTaskId = id.trim().replace(/,$/, '');
    const result = await client.query(
      'SELECT status, result FROM task WHERE id = $1',
      [sanitizedTaskId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Task with ID ${sanitizedTaskId} not found`);
    }
    
    return { 
      status: result.rows[0].status,
      result: result.rows[0].result 
    };
  } finally {
    client.release();
  }
}

export async function ensureDirectoryExists(
  dirPath: string,
  containerName?: string
): Promise<boolean> {
  console.log(`[DEBUG_DIR] Ensuring directory exists: ${dirPath}${containerName ? ` in container ${containerName}` : ''}`);
  
  try {
    if (containerName) {
      const mkdirCmd = `docker exec ${containerName} mkdir -p "${dirPath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(mkdirCmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`[DEBUG_DIR] Error creating directory in container: ${error.message}`);
            reject(error);
          } else {
            console.log(`[DEBUG_DIR] Successfully created directory in container: ${dirPath}`);
            resolve();
          }
        });
      });
    } else {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[DEBUG_DIR] Created local directory: ${dirPath}`);
      } else {
        console.log(`[DEBUG_DIR] Local directory already exists: ${dirPath}`);
      }
    }
    return true;
  } catch (error) {
    console.error(`[DEBUG_DIR] Failed to ensure directory exists: ${dirPath}`, error);
    return false;
  }
}

export async function waitForTaskCompletion(
  taskId: string,
  maxRetries: number = 60,
  intervalMs: number = 2000
): Promise<string> {
  const finalStates = ['succeed', 'finished', 'failed', 'warning'];
  let retries = 0;
  
  console.log(`[DEBUG_TASK_BACKEND] waitForTaskCompletion started for taskId=${taskId}, maxRetries=${maxRetries}, intervalMs=${intervalMs}`);
  
  while (retries < maxRetries) {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT status, result FROM task WHERE id = $1',
          [taskId]
        );
        
        if (result.rows.length === 0) {
          console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} not found during waitForTaskCompletion`);
          return 'failed';
        }
        
        const status = result.rows[0].status;
        const hasResult = result.rows[0].result !== null;
        
        console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} status: ${status}, has result: ${hasResult} (attempt ${retries + 1}/${maxRetries})`);
        
        if (finalStates.includes(status)) {
          console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} reached final state: ${status} with result`);
          return status;
        }
      } finally {
        client.release();
      }
      
      console.log(`[DEBUG_TASK_BACKEND] Waiting ${intervalMs}ms before next poll for taskId=${taskId}`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      retries++;
    } catch (error) {
      console.error(`[DEBUG_TASK_BACKEND] Error checking task status for ${taskId}:`, error);
      await new Promise(resolve => setTimeout(resolve, intervalMs * 2));
      retries++;
    }
  }
  
  console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} did not complete within the maximum retries (${maxRetries})`);
  return 'timeout';
}

/**
 * Repeatedly queries the `task` table until the task reaches
 * one of the final states or we run out of retries.
 *
 * Returns the full row as `{ task: { status: string; result: string } }`
 * so it's a drop-in replacement for the client's pollTaskStatus3.
 */
export async function pollTaskStatus(
  taskId: string,
  maxRetries = 60,         // 2 min @ 2 s interval
  intervalMs = 2_000,
): Promise<{ task: { status: string; result: string } }> {
  const finals = ['succeed', 'failed', 'finished', 'warning'];

  for (let n = 0; n < maxRetries; n++) {
    const { rows } = await pool.query<{ status: string; result: string }>(
      'SELECT status, result FROM task WHERE id = $1',
      [taskId],
    );

    if (rows.length === 0) {
      throw new Error(`pollTaskStatus: task ${taskId} not found`);
    }

    const task = rows[0];

    if (finals.includes(task.status)) return { task };

    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error(
    `pollTaskStatus: task ${taskId} did not finish within ${maxRetries * intervalMs /
      1000}s`,
  );
}

export async function markWriteDone(projectId: string) {
  const id = await createTask(`WRITE_SRCS_${projectId}`, null, projectId);
  await updateTaskStatus(id, "succeed", "UI+SRC files written");
}
