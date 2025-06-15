import { createTask, updateTaskStatus } from "../taskUtils";

export async function markWriteDone(projectId: string) {
  const id = await createTask(`WRITE_SRCS_${projectId}`, null, projectId);
  await updateTaskStatus(id, "succeed", "UI+SRC files written");
} 