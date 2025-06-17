import { createTask, updateTaskStatus } from "../taskUtils";
import { v4 as uuidv4 } from 'uuid';

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