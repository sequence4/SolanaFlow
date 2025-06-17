import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import fs from 'fs';

const MAX_WRITE_RETRIES = Number(process.env.MAX_WRITE_RETRIES) || 90;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

/**
 * Create a row in the `task` table.
 * If **customId** is given we use it verbatim (handy for sentinel tasks
 * like WRITE_SRCS_42).  Otherwise we generate a uuid.
 */
export async function createTask(
  name: string,
  creatorId: string | null,
  projectId: string,
  taskType: string | null = null,
  customId?: string,
): Promise<string> {
  const client = await pool.connect();
  try {
    const id = customId ?? uuidv4();
    await client.query(
      `INSERT INTO task (id,name,creator_id,project_id,status,created_at,task_type)
       VALUES ($1,$2,$3,$4,'queued',NOW(),$5)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, creatorId, projectId, taskType],
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
  maxRetries: number = MAX_WRITE_RETRIES,
  intervalMs: number = POLL_INTERVAL_MS
): Promise<string> {
  let retries = 0;
  let status = '';

  while (retries < maxRetries) {
    const result = await getTaskById(taskId);
    status = result.status;

    if (status === 'succeed' || status === 'finished' || status === 'warning') {
      console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} completed with status: ${status}`);
      return status;
    }

    if (status === 'failed') {
      console.error(`[DEBUG_TASK_BACKEND] Task ${taskId} failed with status: ${status}`);
      return status;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
    retries++;
    console.log(`[DEBUG_TASK_BACKEND] Waiting for task ${taskId} (attempt ${retries}/${maxRetries})`);
  }

  return status;
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
  maxRetries = MAX_WRITE_RETRIES,         // e.g. 3 min @ 2 s interval by default
  intervalMs = POLL_INTERVAL_MS,
): Promise<{ task: { status: string; result: string | null } }> {
  let retries = 0;
  
  console.log(`[DEBUG_TASK_BACKEND] Starting poll for task ${taskId}`);
  
  while (retries < maxRetries) {
    try {
      const result = await getTaskById(taskId);
      console.log(`[DEBUG_TASK_BACKEND] Polled task ${taskId}, status: ${result.status}`);
      
      // For successfully completed (or failed) tasks, return immediately
      if (['succeed', 'finished', 'failed', 'warning'].includes(result.status)) {
        console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} completed with status: ${result.status}`);
        return { task: result };
      }
      
      // For all other statuses (queued, doing), wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error(`[DEBUG_TASK_BACKEND] Error polling task ${taskId}:`, error);
      // For errors like "task not found", wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    retries++;
    console.log(`[DEBUG_TASK_BACKEND] Attempt ${retries} of ${maxRetries} for task ${taskId}`);
  }
  
  // If maxRetries reached, throw the appropriate error
  throw new Error(`Polling timed out after ${maxRetries} attempts for task ${taskId}`);
}

export async function markWriteDone(projectId: string) {
  // Generate a real UUID and keep the human-readable tag in "title"
  const id = uuidv4();                         // ✅ valid uuid
  await createTask(`WRITE_SRCS_${projectId}`, null, projectId, null, id);
  await updateTaskStatus(id, "succeed", "UI + SRC files written");
}
