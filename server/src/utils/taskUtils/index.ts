import { createTask, updateTaskStatus, waitForTaskCompletion, pollTaskStatus, getTaskById, ensureDirectoryExists } from "./taskUtils";
import { v4 as uuidv4 } from 'uuid';

// Re-export all functions from taskUtils so they can be imported from the index
export { createTask, updateTaskStatus, waitForTaskCompletion, pollTaskStatus, getTaskById, ensureDirectoryExists };

export async function markWriteDone(projectId: string) {
  const id = uuidv4();
  
  await createTask(
    `Write files for ${projectId}`, 
    null, 
    projectId,
    'WRITESRCS',
    id
  );
  await updateTaskStatus(id, "succeed", "UI+SRC files written");
  return id;
} 